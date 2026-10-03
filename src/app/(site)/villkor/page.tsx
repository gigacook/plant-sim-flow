import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { DraftBanner } from "@/components/site/SiteChrome";

export const metadata: Metadata = {
  title: "Köpvillkor",
  robots: BRAND.policiesApproved ? undefined : { index: false, follow: false },
};

// DRAFT for review. No legal entity, jurisdiction or refund obligation is asserted here:
// every such item is a [placeholder] or an explicit option for the owner to choose.
export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <DraftBanner />
      <h1 className="text-[30px] font-semibold tracking-tight">Köpvillkor – lärarpaket</h1>
      <div className="prose-s mt-2">
        <p>Senast uppdaterad: [datum]</p>

        <h2>Säljare</h2>
        <p>
          Paketet säljs via {BRAND.paymentProvider}, som är återförsäljare (merchant of record) och står på kvittot. Innehållet tillhandahålls av [namn / företagsnamn, organisationsnummer, ort]. Kontakt:{" "}
          {BRAND.contactEmail || "[e-postadress]"}.
        </p>

        <h2>Vad du köper</h2>
        <ul>
          <li>Digitalt undervisningsmaterial (lärarhandledning med facit och referensresultat) för övningarna som beskrivs på sidan Lärarpaket, levererat som nedladdning via e-post.</li>
          <li>Uppdateringar och nya övningar som publiceras under 12 månader från köpet. Redan nedladdat material får du behålla även efter perioden.</li>
          <li>Licens för en lärare att använda materialet i sin egen undervisning. Materialet får inte säljas vidare eller publiceras öppet.</li>
        </ul>

        <h2>Pris och betalning</h2>
        <p>Priset anges inklusive moms på sidan Lärarpaket och i kassan. Betalning sker i kassan hos betalningsleverantören.</p>

        <h2>Ångerrätt och återbetalning</h2>
        <p>
          <strong>Ångerrätt:</strong> Som konsument har du enligt lag 14 dagars ångerrätt för digitalt innehåll. Ångerrätten upphör om du uttryckligen samtycker till att leveransen påbörjas direkt och bekräftar att ångerrätten därmed går
          förlorad. [Granska hur betalningsleverantörens kassa inhämtar detta samtycke.]
        </p>
        <p>
          <strong>Nöjd-kund-garanti under pilotperioden (föreslås):</strong> Oavsett ångerrätten återbetalar vi hela beloppet om du hör av dig inom 30 dagar från köpet och materialet inte var användbart för dig. Ingen motivering krävs.
          Åtkomsten till materialet och kommande uppdateringar upphör vid återbetalning.
        </p>

        <h2>Simulatorn</h2>
        <p>
          Simulatorn är gratis och tillhandahålls i befintligt skick som ett undervisningsverktyg. Resultat är modellresultat och ska inte ensamma ligga till grund för investerings- eller säkerhetsbeslut.
        </p>

        <h2>Tvister</h2>
        <p>[Tillämplig lag och tvistlösning, t.ex. Allmänna reklamationsnämnden för konsumenter – granskas.]</p>
      </div>
    </div>
  );
}
