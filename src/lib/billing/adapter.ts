// Provider-specific → provider-agnostic mapping. The ONLY place product ids/prices are trusted from.
// Shared by the server webhook function (cloudflare/) and the in-browser mock.
import type { BillingEvent } from "./entitlements.ts";

export const PRODUCTS = {
  "teacher-kit": { id: "teacher-kit", providerProductId: "prod_mock_teacher_kit", name: "Lärarpaket", priceSek: 590, months: 12 },
} as const;
export type ProductKey = keyof typeof PRODUCTS;
/** Trusted mapping provider product id → internal product key (the only place prices/products are trusted from). */
export const PRODUCT_BY_PROVIDER_ID: Record<string, ProductKey> = { prod_mock_teacher_kit: "teacher-kit" };

const normEmail = (e: string) => e.trim().toLowerCase();

/** Adapter: provider payload → provider-agnostic BillingEvent. Unknown types → null (acknowledged, ignored). */
export function adaptProviderEvent(payload: { type: string; created_at: string; data: Record<string, unknown> }): Omit<BillingEvent, "eventId"> | null {
  const d = payload.data;
  const product = PRODUCT_BY_PROVIDER_ID[String(d.product_id)];
  if (!product) return null;
  const base = { occurredAt: payload.created_at, customer: normEmail(String(d.customer_email)), product };
  switch (payload.type) {
    case "checkout.created":
      return { ...base, type: "checkout.created" };
    case "order.paid":
      return { ...base, type: "order.paid", periodEnd: typeof d.access_until === "string" ? d.access_until : null };
    case "order.refunded":
      return { ...base, type: "order.refunded" };
    default:
      return null;
  }
}

