import type { Metadata } from "next";
import MockCheckout from "@/components/site/MockCheckout";

export const metadata: Metadata = { title: "Kassa (demo)", robots: { index: false, follow: false } };

export default function CheckoutPage() {
  return <MockCheckout />;
}
