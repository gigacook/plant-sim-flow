// Run: node --experimental-strip-types --no-warnings --test entitlements.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyEvent, effectiveStatus, emptyStore, hasAccess, type BillingEvent, type EntitlementStore } from "./entitlements.ts";
import { sign, verifyWebhook, WebhookVerificationError } from "./webhook-signature.ts";

const ev = (eventId: string, type: BillingEvent["type"], occurredAt: string, extra: Partial<BillingEvent> = {}): BillingEvent => ({
  eventId, type, occurredAt, customer: "c1", product: "teacher-kit", ...extra,
});
const run = (events: BillingEvent[]) => events.reduce<EntitlementStore>((s, e) => applyEvent(s, e).store, emptyStore());
const T = (d: string) => new Date(d);

test("successful one-time payment grants access", () => {
  const s = run([ev("e1", "checkout.created", "2026-10-01T10:00:00Z"), ev("e2", "order.paid", "2026-10-01T10:01:00Z")]);
  assert.equal(hasAccess(s, "c1", "teacher-kit", T("2026-10-02")), true);
});

test("abandoned checkout (pending only) grants nothing", () => {
  const s = run([ev("e1", "checkout.created", "2026-10-01T10:00:00Z")]);
  assert.equal(hasAccess(s, "c1", "teacher-kit"), false);
  assert.equal(effectiveStatus(s, "c1", "teacher-kit"), "pending");
});

test("no events (failed payment, or someone visiting the success URL) → no access", () => {
  assert.equal(hasAccess(emptyStore(), "c1", "teacher-kit"), false);
});

test("duplicate webhook is idempotent", () => {
  const s1 = applyEvent(emptyStore(), ev("e2", "order.paid", "2026-10-01T10:01:00Z")).store;
  const r = applyEvent(s1, ev("e2", "order.paid", "2026-10-01T10:01:00Z"));
  assert.equal(r.outcome, "duplicate");
  assert.deepEqual(r.store, s1);
});

test("out-of-order: late 'checkout.created' does not downgrade a paid entitlement", () => {
  const s = run([ev("e2", "order.paid", "2026-10-01T10:01:00Z"), ev("e1", "checkout.created", "2026-10-01T10:00:00Z")]);
  assert.equal(hasAccess(s, "c1", "teacher-kit", T("2026-10-02")), true);
});

test("refund revokes access, even if delivered before the paid event", () => {
  const s = run([ev("r1", "order.refunded", "2026-10-05T00:00:00Z"), ev("e2", "order.paid", "2026-10-01T10:01:00Z")]);
  assert.equal(hasAccess(s, "c1", "teacher-kit", T("2026-10-06")), false);
  assert.equal(effectiveStatus(s, "c1", "teacher-kit"), "refunded");
});

test("a NEW purchase after a refund re-activates", () => {
  const s = run([ev("e2", "order.paid", "2026-10-01T10:00:00Z"), ev("r1", "order.refunded", "2026-10-02T00:00:00Z"), ev("e3", "order.paid", "2026-11-01T00:00:00Z")]);
  assert.equal(hasAccess(s, "c1", "teacher-kit", T("2026-11-02")), true);
});

test("time-limited access (12 months of updates) expires", () => {
  const s = run([ev("e2", "order.paid", "2026-10-01T00:00:00Z", { periodEnd: "2027-10-01T00:00:00Z" })]);
  assert.equal(hasAccess(s, "c1", "teacher-kit", T("2027-09-30")), true);
  assert.equal(hasAccess(s, "c1", "teacher-kit", T("2027-10-02")), false);
  assert.equal(effectiveStatus(s, "c1", "teacher-kit", T("2027-10-02")), "expired");
});

test("subscription canceled keeps access until period end, then expires", () => {
  const s = run([
    ev("s1", "subscription.active", "2026-10-01T00:00:00Z", { periodEnd: "2026-11-01T00:00:00Z" }),
    ev("s2", "subscription.canceled", "2026-10-15T00:00:00Z"),
  ]);
  assert.equal(effectiveStatus(s, "c1", "teacher-kit", T("2026-10-20")), "canceled");
  assert.equal(hasAccess(s, "c1", "teacher-kit", T("2026-10-20")), true);
  assert.equal(hasAccess(s, "c1", "teacher-kit", T("2026-11-02")), false);
});

test("stale renewal delivered after expiry is ignored", () => {
  const s = run([
    ev("s1", "subscription.active", "2026-10-01T00:00:00Z", { periodEnd: "2026-11-01T00:00:00Z" }),
    ev("s3", "subscription.expired", "2026-11-01T00:00:00Z"),
    ev("s2", "subscription.active", "2026-10-15T00:00:00Z", { periodEnd: "2026-11-01T00:00:00Z" }),
  ]);
  assert.equal(effectiveStatus(s, "c1", "teacher-kit", T("2026-11-02")), "expired");
});

test("customers and products are isolated", () => {
  const s = run([ev("e1", "order.paid", "2026-10-01T00:00:00Z", { customer: "c2" })]);
  assert.equal(hasAccess(s, "c1", "teacher-kit"), false);
  assert.equal(hasAccess(s, "c2", "other-product"), false);
});

// --- webhook signatures ---
const SECRET = "whsec_" + btoa("super-secret-test-key-0123456789");
const body = JSON.stringify({ type: "order.paid", data: { id: "o1" } });

test("valid signature passes", async () => {
  const sig = await sign(SECRET, "msg_1", "1700000000", body);
  await verifyWebhook(SECRET, { id: "msg_1", timestamp: "1700000000", signature: `v1,${sig}` }, body, { nowSec: 1700000010 });
});

test("rotated keys: any matching v1 entry passes", async () => {
  const sig = await sign(SECRET, "msg_1", "1700000000", body);
  await verifyWebhook(SECRET, { id: "msg_1", timestamp: "1700000000", signature: `v1,AAAA v1,${sig}` }, body, { nowSec: 1700000000 });
});

test("tampered body fails", async () => {
  const sig = await sign(SECRET, "msg_1", "1700000000", body);
  await assert.rejects(
    verifyWebhook(SECRET, { id: "msg_1", timestamp: "1700000000", signature: `v1,${sig}` }, body.replace("o1", "o2"), { nowSec: 1700000000 }),
    WebhookVerificationError,
  );
});

test("replayed old message fails timestamp tolerance", async () => {
  const sig = await sign(SECRET, "msg_1", "1700000000", body);
  await assert.rejects(
    verifyWebhook(SECRET, { id: "msg_1", timestamp: "1700000000", signature: `v1,${sig}` }, body, { nowSec: 1700001000 }),
    /tolerance/,
  );
});

test("missing headers fail", async () => {
  await assert.rejects(verifyWebhook(SECRET, { id: null, timestamp: "1", signature: "v1,x" }, body), /missing/);
});

test("matches the published Standard Webhooks/Svix example vector", async () => {
  const sig = await sign("whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw", "msg_p5jXN8AQM9LWM0D4loKWxJek", "1614265330", '{"test": 2432232314}');
  assert.equal(sig, "g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=");
});
