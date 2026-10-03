// All public brand/offer settings in one place. Deployment-specific and personal values come from
// NEXT_PUBLIC_* environment variables (set locally in the gitignored .env.local – never commit them).
// See .env.example.

export const BRAND = {
  /** Provisional product name. Change here to rename everywhere. */
  name: "Taktlab",
  tagline: "Flödessimulering för undervisning",
  /** Optional maker credit, e.g. a name. Empty = no personal details shown. */
  founder: process.env.NEXT_PUBLIC_FOUNDER_NAME || "",
  founderBio: process.env.NEXT_PUBLIC_FOUNDER_BIO || "",
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "",
  /**
   * "mock" (default): simulated checkout, webhooks and e-mail – no real payments.
   * "live": link to the payment provider's hosted checkout (NEXT_PUBLIC_CHECKOUT_URL).
   */
  billingMode: (process.env.NEXT_PUBLIC_BILLING_MODE === "live" ? "live" : "mock") as "mock" | "live",
  checkoutUrl: process.env.NEXT_PUBLIC_CHECKOUT_URL || "",
  /** Must match the price configured in the payment provider (live) or the mock product (mock). */
  priceLabel: process.env.NEXT_PUBLIC_PRICE_LABEL || "590 kr inkl. moms",
  paymentProvider: process.env.NEXT_PUBLIC_PAYMENT_PROVIDER || "betalningsleverantören",
  /** Policies stay marked as drafts until this is set to "true" after review. */
  policiesApproved: process.env.NEXT_PUBLIC_POLICIES_APPROVED === "true",
} as const;

export const isMock = BRAND.billingMode === "mock";

export const mailto = (subject: string) =>
  BRAND.contactEmail ? `mailto:${BRAND.contactEmail}?subject=${encodeURIComponent(subject)}` : "";
