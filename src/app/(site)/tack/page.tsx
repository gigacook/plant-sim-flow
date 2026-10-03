import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import MockBanner from "@/components/site/MockBanner";
import PurchaseStatus from "@/components/site/PurchaseStatus";

export const metadata: Metadata = { title: "Tack", robots: { index: false, follow: false } };

// Checkout return page. It deliberately grants nothing and claims nothing: delivery and receipts
// come from the payment provider, which is the source of truth for whether a purchase happened.
export default function ThanksPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <MockBanner />
      <div className="s-label">Köpet</div>
      <h1 className="mt-2 text-[30px] font-semibold tracking-tight">Tack!</h1>
      <div className="mt-4">
        <PurchaseStatus />
      </div>
      <div className="prose-s mt-4 space-y-3">
        <p>
          Om du har genomfört ett köp skickar {BRAND.paymentProvider} ett kvitto och en nedladdningslänk till den e-postadress du angav. Det brukar ta några minuter.
        </p>
        <p>Har inget kommit inom en kvart? Kontrollera skräpposten. Om det fortfarande saknas, eller om betalningen avbröts, hör av dig så löser vi det.</p>
        {BRAND.contactEmail && (
          <p>
            Kontakt: <a href={`mailto:${BRAND.contactEmail}`}>{BRAND.contactEmail}</a>
          </p>
        )}
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/ovningar/" className="s-btn s-btn-primary">
          Till övningarna
        </Link>
        <Link href="/app/" className="s-btn">
          Öppna simulatorn
        </Link>
      </div>
    </div>
  );
}
