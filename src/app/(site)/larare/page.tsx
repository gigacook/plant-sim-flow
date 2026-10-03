import type { Metadata } from "next";
import Link from "next/link";
import { BRAND, isMock, mailto } from "@/lib/brand";
import MockBanner from "@/components/site/MockBanner";
import CancelNotice from "@/components/site/CancelNotice";
import { EXERCISES } from "@/lib/sim/exercises";

export const metadata: Metadata = {
  title: "Lärarpaket",
  description: "Lärarhandledning med facit och referensresultat till övningarna om flaskhalsar, buffertar och köer.",
};

function BuyBox() {
  if (isMock) {
    return (
      <div className="space-y-3">
        <Link href="/kassa/?produkt=teacher-kit" className="s-btn s-btn-primary w-full justify-center text-[16px]">
          Köp lärarpaketet – {BRAND.priceLabel}
        </Link>
        <p className="rounded-md bg-[#eef4ff] p-3 text-[13px] leading-relaxed text-[#1e3a8a]">
          <strong>Demoläge:</strong> kassan är simulerad med testkort – inga pengar dras och inga mejl skickas.
        </p>
      </div>
    );
  }
  if (BRAND.checkoutUrl) {
    return (
      <div className="space-y-3">
        <a href={BRAND.checkoutUrl} className="s-btn s-btn-primary w-full justify-center text-[16px]" rel="noopener">
          Köp lärarpaketet – {BRAND.priceLabel}
        </a>
        <p className="text-[13px] leading-relaxed text-[var(--ink-s2)]">
          Betalningen sker hos {BRAND.paymentProvider}, som säljer paketet för vår räkning och skickar kvitto med moms. Nedladdningslänken kommer via e-post direkt efter köpet. Vi hanterar aldrig dina kortuppgifter.
        </p>
      </div>
    );
  }
  const link = mailto(`Intresse: ${BRAND.name} lärarpaket`);
  return (
    <div className="space-y-3">
      <div className="rounded-md bg-[var(--paper-2)] p-3 text-[14px] text-[var(--ink-s2)]">Lärarpaketet släpps under pilotperioden. Anmäl intresse så hör vi av oss när det går att köpa.</div>
      {link ? (
        <a href={link} className="s-btn s-btn-primary w-full justify-center">
          Anmäl intresse via e-post
        </a>
      ) : (
        <span className="s-btn s-btn-primary w-full justify-center" aria-disabled="true">
          Intresseanmälan öppnar snart
        </span>
      )}
    </div>
  );
}

export default function TeacherPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <MockBanner />
      <CancelNotice />
      <div className="s-label">För lärare och utbildare</div>
      <h1 className="mt-2 text-[32px] font-semibold tracking-tight">Lärarpaket: övningarna, färdigförberedda</h1>
      <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-[var(--ink-s2)]">
        Övningarna och simulatorn är gratis för dig och dina studenter. Lärarpaketet sparar förberedelsetiden: du får handledning, facit och referensresultat som är framtagna med samma simuleringsmotor som studenterna använder.
      </p>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <section className="s-card p-6">
            <h2 className="text-[19px] font-semibold">Det här ingår</h2>
            <ul className="mt-3 space-y-2.5 text-[15px] leading-relaxed text-[var(--ink-s2)]">
              <li>
                <strong className="text-[var(--ink-s)]">Lärarhandledning</strong> för {EXERCISES.length} övningar ({EXERCISES.map((e) => e.title.toLowerCase()).join("; ")}) med lärandemål och tidsåtgång.
              </li>
              <li>
                <strong className="text-[var(--ink-s)]">Facit med referensresultat</strong> – genomflöde, ledtid och PIA per scenario med 95 % konfidensintervall, så du vet vad studenterna bör få fram.
              </li>
              <li>
                <strong className="text-[var(--ink-s)]">Diskussionsfrågor och vanliga missuppfattningar</strong> att ta upp efter övningen.
              </li>
              <li>
                <strong className="text-[var(--ink-s)]">Lösningsmodeller</strong> som du importerar i simulatorn för att visa svaren direkt i klassen.
              </li>
              <li>
                <strong className="text-[var(--ink-s)]">Uppdateringar i 12 månader</strong>, inklusive nya övningar som tillkommer under perioden.
              </li>
              <li>
                <strong className="text-[var(--ink-s)]">Direktkontakt</strong> för frågor och önskemål om övningar.
              </li>
            </ul>
            <p className="mt-4 text-[13.5px] text-[var(--muted-s)]">Leveransformat: PDF och modellfiler (JSON) via e-post från betalningsleverantören. Licens för en lärare; du får använda materialet i din egen undervisning.</p>
          </section>

          <section className="s-card p-6">
            <h2 className="text-[19px] font-semibold">Det här ingår inte</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] text-[var(--ink-s2)]">
              <li>Konton, klasslistor eller inlämning – studenterna arbetar i sin egen webbläsare.</li>
              <li>Industriell simulering för investeringsbeslut (produktmix, skift, ställtider saknas).</li>
              <li>Engelskt gränssnitt (ännu).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[19px] font-semibold">Frågor om köpet</h2>
            <div className="mt-3 space-y-4 text-[15px] leading-relaxed text-[var(--ink-s2)]">
              <p>
                <strong className="text-[var(--ink-s)]">Kan skolan betala mot faktura?</strong> Hör av dig så tar vi reda på vad som går att lösa för just er.
              </p>
              <p>
                <strong className="text-[var(--ink-s)]">Om det inte passar?</strong> Villkor för ångerrätt och återbetalning finns i{" "}
                <Link href="/villkor/" className="underline">
                  köpvillkoren
                </Link>
                .
              </p>
              <p>
                <strong className="text-[var(--ink-s)]">Vilka uppgifter sparas?</strong> Se{" "}
                <Link href="/integritet/" className="underline">
                  integritetsinformationen
                </Link>
                .
              </p>
            </div>
          </section>
        </div>

        <aside className="h-fit lg:sticky lg:top-6">
          <div className="s-card border-[var(--ink-s)] p-6">
            <div className="s-label">Lärarpaket</div>
            <div className="mt-2 text-[28px] font-semibold">{BRAND.priceLabel}</div>
            <div className="mt-1 text-[13.5px] text-[var(--muted-s)]">Engångsköp · 12 månaders uppdateringar · ingen prenumeration</div>
            <div className="mt-5">
              <BuyBox />
            </div>
          </div>
          <p className="mt-4 text-[13.5px] text-[var(--ink-s2)]">
            Vill du se upplägget först?{" "}
            <Link href="/ovningar/" className="underline">
              Prova övningarna gratis
            </Link>
            .
          </p>
        </aside>
      </div>
    </div>
  );
}
