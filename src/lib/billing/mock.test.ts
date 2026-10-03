// Run: npm run test:billing
// End-to-end lifecycle through the MOCK provider → signed webhook → backend → entitlements → outbox.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { abandon, accessStatus, advanceClock, canAccess, createCheckoutSession, deliverForged, deliverLateCheckoutEvent, load, pay, redeliver, refund, reset } from "./mock.ts";

beforeEach(() => reset());
const EMAIL = "larare@example.invalid";

test("successful payment → active access, receipt + welcome mail, no real send", async () => {
  const cs = await createCheckoutSession("teacher-kit", EMAIL);
  assert.equal(accessStatus(EMAIL), "pending");
  const done = await pay(cs.id, "success");
  assert.equal(done.status, "complete");
  assert.equal(canAccess(EMAIL), true);
  const s = load();
  assert.deepEqual(s.outbox.map((m) => m.subject.split(" ")[0]).sort(), ["Kvitto", "Välkommen"]);
  assert.ok(s.outbox.every((m) => m.body.includes("MOCK")));
});

test("abandoned checkout → no order, no access", async () => {
  const cs = await createCheckoutSession("teacher-kit", EMAIL);
  abandon(cs.id);
  assert.equal(load().sessions[cs.id].status, "expired");
  assert.equal(Object.keys(load().orders).length, 0);
  assert.equal(canAccess(EMAIL), false);
});

test("declined card → session stays open with error, no access; retry can succeed", async () => {
  const cs = await createCheckoutSession("teacher-kit", EMAIL);
  const d = await pay(cs.id, "decline");
  assert.equal(d.status, "open");
  assert.match(d.lastError ?? "", /nekades/);
  assert.equal(canAccess(EMAIL), false);
  await pay(cs.id, "success");
  assert.equal(canAccess(EMAIL), true);
});

test("paying twice on the same session creates only one order", async () => {
  const cs = await createCheckoutSession("teacher-kit", EMAIL);
  await pay(cs.id, "success");
  await pay(cs.id, "success");
  assert.equal(Object.keys(load().orders).length, 1);
});

test("duplicate webhook delivery is a no-op (no second welcome mail)", async () => {
  const cs = await createCheckoutSession("teacher-kit", EMAIL);
  await pay(cs.id, "success");
  const paid = load().deliveries.find((d) => d.type === "order.paid")!;
  const mails = load().outbox.length;
  await redeliver(paid.webhookId);
  assert.match(load().deliveries[0].outcome, /duplicate/);
  assert.equal(load().outbox.length, mails);
  assert.equal(canAccess(EMAIL), true);
});

test("late out-of-order checkout.created does not downgrade access", async () => {
  const cs = await createCheckoutSession("teacher-kit", EMAIL);
  await pay(cs.id, "success");
  await deliverLateCheckoutEvent(load().sessions[cs.id].orderId!);
  assert.match(load().deliveries[0].outcome, /stale/);
  assert.equal(canAccess(EMAIL), true);
});

test("forged webhook (bad signature) is rejected and grants nothing", async () => {
  await deliverForged("attacker@example.invalid");
  assert.match(load().deliveries[0].outcome, /^400 rejected/);
  assert.equal(canAccess("attacker@example.invalid"), false);
});

test("refund revokes access and sends a refund notice", async () => {
  const cs = await createCheckoutSession("teacher-kit", EMAIL);
  await pay(cs.id, "success");
  await refund(load().sessions[cs.id].orderId!);
  assert.equal(accessStatus(EMAIL), "refunded");
  assert.equal(canAccess(EMAIL), false);
  assert.ok(load().outbox.some((m) => m.subject.startsWith("Återbetalning")));
});

test("12-month access expires", async () => {
  const cs = await createCheckoutSession("teacher-kit", EMAIL);
  await pay(cs.id, "success");
  advanceClock(11);
  assert.equal(canAccess(EMAIL), true);
  advanceClock(2);
  assert.equal(accessStatus(EMAIL), "expired");
  assert.equal(canAccess(EMAIL), false);
});

test("email is normalised; invalid email is refused", async () => {
  const cs = await createCheckoutSession("teacher-kit", "  Larare@Example.INVALID ");
  await pay(cs.id, "success");
  assert.equal(canAccess(EMAIL), true);
  await assert.rejects(createCheckoutSession("teacher-kit", "not-an-email"), /giltig/);
});
