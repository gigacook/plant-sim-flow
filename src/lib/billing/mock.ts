// MOCK payment provider + MOCK backend, used while billing is in "mock" mode.
// Nothing here moves money or sends e-mail. It exercises the same code paths a real integration would use:
// hosted-checkout session → signed webhook (Standard Webhooks) → signature verification → provider-payload
// adapter → idempotent entitlement reducer → server-side access check → transactional e-mail (to a mock outbox).
//
// In production the "backend" half runs server-side (see cloudflare/functions/api/billing-webhook.ts) and the
// "provider" half is the real merchant of record. State is kept in localStorage (browser) or memory (Node tests).

import { applyEvent, effectiveStatus, emptyStore, hasAccess, type EntitlementStatus, type EntitlementStore } from "./entitlements.ts";
import { sign, verifyWebhook } from "./webhook-signature.ts";
import { adaptProviderEvent, PRODUCTS, type ProductKey } from "./adapter.ts";
export { PRODUCTS, type ProductKey } from "./adapter.ts";

/** Public on purpose: it only signs MOCK webhooks. A real secret lives in the server's secret store. */
export const MOCK_WEBHOOK_SECRET = "whsec_" + btoa("taktlab-mock-secret-NOT-for-production");
const STORAGE_KEY = "taktlab-mock-billing-v1";

export interface MockSession {
  id: string;
  product: ProductKey;
  email: string;
  status: "open" | "complete" | "expired";
  lastError: string | null;
  createdAt: string;
  orderId: string | null;
}
export interface MockOrder {
  id: string;
  sessionId: string;
  product: ProductKey;
  email: string;
  amountSek: number;
  status: "paid" | "refunded";
  paidAt: string;
  refundedAt: string | null;
}
export interface Delivery {
  webhookId: string;
  type: string;
  at: string;
  outcome: string;
  raw: string;
  timestamp: string;
}
export interface MockEmail {
  id: string;
  at: string;
  from: string;
  to: string;
  subject: string;
  body: string;
}
export interface MockState {
  sessions: Record<string, MockSession>;
  orders: Record<string, MockOrder>;
  deliveries: Delivery[];
  store: EntitlementStore;
  outbox: MockEmail[];
  clockOffsetMs: number;
  seq: number;
}

const fresh = (): MockState => ({ sessions: {}, orders: {}, deliveries: [], store: emptyStore(), outbox: [], clockOffsetMs: 0, seq: 0 });

// ---------- storage (localStorage in the browser, memory in Node) ----------
let memory: MockState | null = null;
function hasLocalStorage() {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
}
export function load(): MockState {
  if (hasLocalStorage()) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as MockState;
    } catch {
      /* corrupted or blocked storage → start over */
    }
    return fresh();
  }
  return memory ?? (memory = fresh());
}
function save(s: MockState) {
  if (hasLocalStorage()) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {
      /* storage full/blocked: the demo keeps working for this page view */
    }
    return;
  }
  memory = s;
}
export function reset() {
  if (hasLocalStorage()) {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
  memory = null;
}

const nowOf = (s: MockState) => new Date(Date.now() + s.clockOffsetMs);
const id = (s: MockState, prefix: string) => `${prefix}_${(++s.seq).toString().padStart(4, "0")}${Math.random().toString(36).slice(2, 6)}`;
const addMonths = (d: Date, m: number) => {
  const x = new Date(d);
  x.setMonth(x.getMonth() + m);
  return x;
};
const normEmail = (e: string) => e.trim().toLowerCase();
const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// ---------- MOCK BACKEND (would run server-side) ----------

/** The webhook endpoint. Returns an HTTP-like status. Same logic as the Cloudflare function. */
export async function handleWebhook(s: MockState, headers: { id: string; timestamp: string; signature: string }, raw: string, secret = MOCK_WEBHOOK_SECRET): Promise<{ status: number; outcome: string }> {
  try {
    await verifyWebhook(secret, headers, raw, { nowSec: Math.floor(Date.now() / 1000) });
  } catch (e) {
    return { status: 400, outcome: `rejected: ${(e as Error).message}` };
  }
  const payload = JSON.parse(raw);
  const ev = adaptProviderEvent(payload);
  if (!ev) return { status: 200, outcome: "ignored (unknown event/product)" };
  const before = effectiveStatus(s.store, ev.customer, ev.product, nowOf(s));
  const r = applyEvent(s.store, { ...ev, eventId: headers.id });
  s.store = r.store;
  if (r.outcome === "applied") {
    const after = effectiveStatus(s.store, ev.customer, ev.product, nowOf(s));
    if (ev.type === "order.paid" && before !== "active") sendWelcome(s, ev.customer, ev.product as ProductKey, String(payload.data.access_until ?? ""));
    if (ev.type === "order.refunded" && after === "refunded") sendRefundNotice(s, ev.customer, ev.product as ProductKey);
  }
  return { status: 200, outcome: r.outcome };
}

export function accessStatus(email: string, product: ProductKey = "teacher-kit"): EntitlementStatus | "none" {
  const s = load();
  return effectiveStatus(s.store, normEmail(email), product, nowOf(s));
}
export function canAccess(email: string, product: ProductKey = "teacher-kit"): boolean {
  const s = load();
  return hasAccess(s.store, normEmail(email), product, nowOf(s));
}

// ---------- MOCK E-MAIL (transactional only; nothing is sent) ----------
const SENDER = "Taktlab <no-reply@example.invalid>";
const PROVIDER_SENDER = "Betalningsleverantör (mock) <receipts@example.invalid>";
function mail(s: MockState, from: string, to: string, subject: string, body: string) {
  s.outbox.unshift({ id: id(s, "mail"), at: nowOf(s).toISOString(), from, to, subject, body });
}
function sendReceipt(s: MockState, o: MockOrder) {
  const p = PRODUCTS[o.product];
  const vat = Math.round((o.amountSek - o.amountSek / 1.25) * 100) / 100;
  mail(s, PROVIDER_SENDER, o.email, `Kvitto ${o.id}`, `Tack för ditt köp!\n\n${p.name}  ${o.amountSek.toFixed(2)} kr\nVarav moms (25 %): ${vat.toFixed(2)} kr\n\nOrder: ${o.id}\nSäljs av betalningsleverantören (återförsäljare) för Taktlabs räkning.\n\n[MOCK – inget riktigt kvitto]`);
}
function sendWelcome(s: MockState, to: string, product: ProductKey, until: string) {
  const p = PRODUCTS[product];
  mail(s, SENDER, to, `Välkommen – så kommer du igång med ${p.name.toLowerCase()}et`, `Hej!\n\nTack för att du köpte ${p.name.toLowerCase()}et. Du har tillgång till material och uppdateringar till och med ${until ? until.slice(0, 10) : "–"}.\n\nSnabbstart:\n1. Öppna lärarhandledningen och börja med övningen ”Hitta flaskhalsen”.\n2. Kör studentversionen själv en gång (fem minuter).\n3. Skicka övningslänken till studenterna.\n\nSvara på det här mejlet om något inte fungerar.\n\n[MOCK – skickas inte]`);
}
function sendRefundNotice(s: MockState, to: string, product: ProductKey) {
  mail(s, SENDER, to, `Återbetalning genomförd – ${PRODUCTS[product].name}`, `Hej!\n\nDin återbetalning är genomförd och åtkomsten till materialet har avslutats. Pengarna syns på kontot inom några bankdagar.\n\n[MOCK – skickas inte]`);
}

// ---------- MOCK PROVIDER (would be the merchant of record) ----------

async function emit(s: MockState, type: string, data: Record<string, unknown>, opts: { createdAt?: string; webhookId?: string } = {}) {
  const payload = { type, created_at: opts.createdAt ?? nowOf(s).toISOString(), data };
  const raw = JSON.stringify(payload);
  const webhookId = opts.webhookId ?? id(s, "msg");
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = `v1,${await sign(MOCK_WEBHOOK_SECRET, webhookId, timestamp, raw)}`;
  const res = await handleWebhook(s, { id: webhookId, timestamp, signature }, raw);
  s.deliveries.unshift({ webhookId, type, at: nowOf(s).toISOString(), outcome: `${res.status} ${res.outcome}`, raw, timestamp });
}

export async function createCheckoutSession(product: ProductKey, email: string): Promise<MockSession> {
  if (!PRODUCTS[product]) throw new Error("Okänd produkt");
  const clean = normEmail(email);
  if (!isEmail(clean)) throw new Error("Ange en giltig e-postadress.");
  const s = load();
  const session: MockSession = { id: id(s, "cs"), product, email: clean, status: "open", lastError: null, createdAt: nowOf(s).toISOString(), orderId: null };
  s.sessions[session.id] = session;
  await emit(s, "checkout.created", { checkout_id: session.id, product_id: PRODUCTS[product].providerProductId, customer_email: session.email });
  save(s);
  return session;
}

export type TestCard = "success" | "decline";

/** Pay with a mock test card. Decline keeps the session open (like hosted checkouts do) and creates no order. */
export async function pay(sessionId: string, card: TestCard): Promise<MockSession> {
  const s = load();
  const session = s.sessions[sessionId];
  if (!session) throw new Error("Kassasessionen finns inte.");
  if (session.status !== "open") return session;
  if (card === "decline") {
    session.lastError = "Kortet nekades (testkort). Inget har debiterats.";
    save(s);
    return session;
  }
  const p = PRODUCTS[session.product];
  const paidAt = nowOf(s);
  const order: MockOrder = { id: id(s, "ord"), sessionId, product: session.product, email: session.email, amountSek: p.priceSek, status: "paid", paidAt: paidAt.toISOString(), refundedAt: null };
  s.orders[order.id] = order;
  session.status = "complete";
  session.lastError = null;
  session.orderId = order.id;
  sendReceipt(s, order);
  await emit(s, "order.paid", { order_id: order.id, product_id: p.providerProductId, customer_email: order.email, amount: p.priceSek, access_until: addMonths(paidAt, p.months).toISOString() });
  save(s);
  return session;
}

export function abandon(sessionId: string) {
  const s = load();
  const session = s.sessions[sessionId];
  if (session && session.status === "open") session.status = "expired";
  save(s);
}

export async function refund(orderId: string) {
  const s = load();
  const o = s.orders[orderId];
  if (!o || o.status === "refunded") return;
  o.status = "refunded";
  o.refundedAt = nowOf(s).toISOString();
  await emit(s, "order.refunded", { order_id: o.id, product_id: PRODUCTS[o.product].providerProductId, customer_email: o.email });
  save(s);
}

/** Re-deliver an earlier webhook unchanged (same webhook-id) – providers retry; must be a no-op. */
export async function redeliver(webhookId: string) {
  const s = load();
  const d = s.deliveries.find((x) => x.webhookId === webhookId);
  if (!d) return;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = `v1,${await sign(MOCK_WEBHOOK_SECRET, d.webhookId, timestamp, d.raw)}`;
  const res = await handleWebhook(s, { id: d.webhookId, timestamp, signature }, d.raw);
  s.deliveries.unshift({ ...d, at: nowOf(s).toISOString(), outcome: `${res.status} ${res.outcome} (omleverans)`, timestamp });
  save(s);
}

/** Simulate a late, out-of-order event: an old checkout.created arriving after payment. */
export async function deliverLateCheckoutEvent(orderId: string) {
  const s = load();
  const o = s.orders[orderId];
  if (!o) return;
  const older = new Date(Date.parse(o.paidAt) - 60_000).toISOString();
  await emit(s, "checkout.created", { checkout_id: o.sessionId, product_id: PRODUCTS[o.product].providerProductId, customer_email: o.email }, { createdAt: older });
  save(s);
}

/** Simulate an attacker/forged request: wrong signature must be rejected with 400. */
export async function deliverForged(email: string) {
  const s = load();
  const raw = JSON.stringify({ type: "order.paid", created_at: nowOf(s).toISOString(), data: { order_id: "forged", product_id: "prod_mock_teacher_kit", customer_email: email, access_until: addMonths(nowOf(s), 120).toISOString() } });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const res = await handleWebhook(s, { id: id(s, "msg"), timestamp, signature: "v1,Zm9yZ2VkLXNpZ25hdHVyZQ==" }, raw);
  s.deliveries.unshift({ webhookId: "forged", type: "order.paid (förfalskad)", at: nowOf(s).toISOString(), outcome: `${res.status} ${res.outcome}`, raw, timestamp });
  save(s);
}

/** Time travel for the demo (e.g. to see the 12-month access expire). */
export function advanceClock(months: number) {
  const s = load();
  const target = addMonths(nowOf(s), months);
  s.clockOffsetMs += target.getTime() - nowOf(s).getTime();
  save(s);
}
export function mockNow(): Date {
  return nowOf(load());
}
