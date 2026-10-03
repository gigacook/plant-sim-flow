import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { DraftBanner } from "@/components/site/SiteChrome";

export const metadata: Metadata = {
  title: "Integritet",
  robots: BRAND.policiesApproved ? undefined : { index: false, follow: false },
};

// DRAFT for review. Statements about the app reflect the current code (no cookies, no analytics,
// localStorage only). Items in [brackets] must be filled in/verified by the owner.
export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <DraftBanner />
      <h1 className="text-[30px] font-semibold tracking-tight">Integritet</h1>
      <div className="prose-s mt-2">
        <p>Senast uppdaterad: [datum]</p>

        <h2>Personuppgiftsansvarig</h2>
        <p>
          [Namn / företagsnamn och organisationsnummer], [ort]. Kontakt: {BRAND.contactEmail || "[e-postadress]"}.
        </p>

        <h2>Simulatorn</h2>
        <ul>
          <li>Simulatorn körs i din webbläsare. Modeller och inställningar sparas i webbläsarens lokala lagring (localStorage) på din enhet och skickas inte till oss.</li>
          <li>Delningslänkar innehåller modellen i adressens #-del. Den delen skickas inte till webbservern när länken öppnas.</li>
          <li>Vi använder inga cookies och inga analys- eller spårningsverktyg.</li>
          <li>I demoläget sparas simulerade köp, kvitton och mejl bara i din webbläsare (localStorage) och kan rensas på sidan Demo. Inget skickas och inga riktiga betalningar görs.</li>
          <li>
            Webbhotellet ([leverantör, t.ex. Cloudflare Pages]) kan behandla tekniska uppgifter som IP-adress i serverloggar för att leverera och skydda tjänsten. [Kontrollera leverantörens villkor och lagringstid.]
          </li>
        </ul>

        <h2>Köp av lärarpaket</h2>
        <p>
          Köp hanteras av {BRAND.paymentProvider}, som är återförsäljare (merchant of record) och självständigt personuppgiftsansvarig för betalningen. Vi får namn, e-postadress, land och orderuppgifter för att leverera
          paketet, hantera support och uppfylla bokföringskrav. Kortuppgifter når oss aldrig. [Ange lagringstid enligt bokföringslagen.]
        </p>

        <h2>E-post</h2>
        <p>Om du mejlar oss använder vi din adress och ditt meddelande för att svara. Vi skickar inga nyhetsbrev utan ditt samtycke. [Ange hur länge korrespondens sparas.]</p>

        <h2>Dina rättigheter</h2>
        <p>
          Du har rätt att begära tillgång till, rättelse eller radering av dina personuppgifter samt att invända mot behandling. Kontakta oss på adressen ovan. Du kan också lämna klagomål till Integritetsskyddsmyndigheten (IMY).
        </p>
      </div>
    </div>
  );
}
