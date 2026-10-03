import type { Metadata } from "next";
import BillingDemo from "@/components/site/BillingDemo";

export const metadata: Metadata = { title: "Demo: betalflöde", robots: { index: false, follow: false } };

export default function DemoPage() {
  return <BillingDemo />;
}
