// Provider-agnostic entitlement state machine. Pure functions, no I/O → easy to test and to store anywhere
// (Cloudflare KV/D1, SQLite, Postgres). TESTED: see entitlements.test.ts.
//
// Flow: provider webhook → verifyWebhook() → adapter maps provider payload to BillingEvent →
// applyEvent(store) → hasAccess() decides access server-side. Never grant access from a success-URL visit.

export type EntitlementStatus = "pending" | "active" | "canceled" | "expired" | "refunded";

export type BillingEventType =
  | "checkout.created" // pending
  | "order.paid" // one-time purchase paid → active (optionally until periodEnd)
  | "subscription.active" // (re)activated or renewed → active until periodEnd
  | "subscription.canceled" // will not renew → access until periodEnd
  | "subscription.expired" // period ended / revoked → no access
  | "order.refunded"; // refund or chargeback lost → no access (terminal for that order)

export interface BillingEvent {
  /** Provider's unique event id – used for idempotency. */
  eventId: string;
  type: BillingEventType;
  /** When the provider says it happened (ISO string). Used to resolve out-of-order delivery. */
  occurredAt: string;
  /** Stable customer key you control (e.g. your user id) or provider customer id / email. */
  customer: string;
  /** Your internal product key (map provider product ids to these in ONE trusted place). */
  product: string;
  /** For time-limited access (subscriptions, "12 months of updates"). ISO string. */
  periodEnd?: string | null;
}

export interface Entitlement {
  customer: string;
  product: string;
  status: EntitlementStatus;
  periodEnd: string | null;
  /** occurredAt of the last applied event. */
  updatedAt: string;
}

export interface EntitlementStore {
  entitlements: Record<string, Entitlement>;
  processedEventIds: Record<string, true>;
}

export const emptyStore = (): EntitlementStore => ({ entitlements: {}, processedEventIds: {} });
const key = (customer: string, product: string) => `${customer}::${product}`;

const NEXT_STATUS: Record<BillingEventType, EntitlementStatus> = {
  "checkout.created": "pending",
  "order.paid": "active",
  "subscription.active": "active",
  "subscription.canceled": "canceled",
  "subscription.expired": "expired",
  "order.refunded": "refunded",
};

export interface ApplyResult {
  store: EntitlementStore;
  outcome: "applied" | "duplicate" | "stale" | "ignored-after-refund";
}

/**
 * Apply one event. Idempotent (same eventId twice → "duplicate") and order-safe:
 * - an event older than the last applied one is ignored ("stale"), EXCEPT refunds, which always win;
 * - after a refund only a newer `order.paid` (a new purchase) re-activates.
 * - "pending" never downgrades an active/canceled entitlement.
 */
export function applyEvent(store: EntitlementStore, ev: BillingEvent): ApplyResult {
  if (store.processedEventIds[ev.eventId]) return { store, outcome: "duplicate" };
  const next: EntitlementStore = {
    entitlements: { ...store.entitlements },
    processedEventIds: { ...store.processedEventIds, [ev.eventId]: true },
  };
  const k = key(ev.customer, ev.product);
  const cur = next.entitlements[k];
  const status = NEXT_STATUS[ev.type];

  if (cur) {
    const older = Date.parse(ev.occurredAt) < Date.parse(cur.updatedAt);
    if (cur.status === "refunded" && !(ev.type === "order.paid" && !older)) {
      return { store: next, outcome: "ignored-after-refund" };
    }
    if (older && ev.type !== "order.refunded") return { store: next, outcome: "stale" };
    if (status === "pending" && cur.status !== "pending") return { store: next, outcome: "stale" };
  }

  next.entitlements[k] = {
    customer: ev.customer,
    product: ev.product,
    status,
    periodEnd: ev.periodEnd ?? (status === "active" ? null : cur?.periodEnd ?? null),
    updatedAt: cur && Date.parse(cur.updatedAt) > Date.parse(ev.occurredAt) ? cur.updatedAt : ev.occurredAt,
  };
  return { store: next, outcome: "applied" };
}

/** Server-side access decision. */
export function hasAccess(store: EntitlementStore, customer: string, product: string, now: Date = new Date()): boolean {
  const e = store.entitlements[key(customer, product)];
  if (!e) return false;
  const withinPeriod = e.periodEnd === null || now.getTime() < Date.parse(e.periodEnd);
  if (e.status === "active") return withinPeriod;
  if (e.status === "canceled") return e.periodEnd !== null && withinPeriod;
  return false;
}

/** Effective status including time-based expiry (for UI and support). */
export function effectiveStatus(store: EntitlementStore, customer: string, product: string, now: Date = new Date()): EntitlementStatus | "none" {
  const e = store.entitlements[key(customer, product)];
  if (!e) return "none";
  if ((e.status === "active" || e.status === "canceled") && e.periodEnd && now.getTime() >= Date.parse(e.periodEnd)) return "expired";
  return e.status;
}
