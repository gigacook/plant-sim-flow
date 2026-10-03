import Link from "next/link";
import type { Metadata } from "next";
import LiveDemo from "@/components/site/LiveDemo";
import { BRAND } from "@/lib/brand";
import { EXERCISES } from "@/lib/sim/exercises";

export const metadata: Metadata = {
  title: { absolute: `${BRAND.name} – visa flaskhalsar och flöden i undervisningen` },
};

const STEPS = [
  { n: "1", t: "Välj en övning", d: "Färdiga modeller om flaskhalsar, buffertar och köer – med uppgifter för studenterna." },
  { n: "2", t: "Skicka länken", d: "Länken öppnar modellen direkt i webbläsaren. Inget konto, ingen installation, fungerar på skolans datorer." },
  { n: "3", t: "Diskutera resultaten", d: "Studenterna ser stationerna arbeta, blockeras och svälta – och jämför scenarier med konfidensintervall." },
];

const FAQ = [
  {
    q: "Behöver studenterna konto eller installera något?",
    a: "Nej. Simulatorn körs helt i webbläsaren. Modeller sparas lokalt i den egna webbläsaren och skickas inte till någon server.",
  },
  {
    q: "Vilka enheter fungerar?",
    a: "Moderna webbläsare på dator fungerar bäst. Övningar och resultat går att visa på surfplatta och mobil, men modellredigeraren är byggd för mus och större skärm.",
  },
  {
    q: "Ersätter det Plant Simulation, FlexSim eller AnyLogic?",
    a: "Nej. Det är ett undervisningsverktyg för att förstå flödesbegrepp snabbt. Det saknar till exempel produktmix, skiftscheman, ställtider och 3D. Använd det som introduktion eller komplement.",
  },
  {
    q: "Hur pålitliga är siffrorna?",
    a: "Motorn är en diskret händelsestyrd simulering. Den har kontrollerats mot kö-teori (M/M/1) och mot deterministiska linjer där svaret kan räknas för hand. Resultat visas med 95 % konfidensintervall över flera replikeringar.",
  },
  {
    q: "Vad kostar det?",
    a: "Simulatorn och övningarna är gratis. Lärarpaketet med lärarhandledning och facit är betalt – se sidan För lärare.",
  },
];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="blueprint border-b border-[var(--rule)]">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:py-16">
          <div>
            <div className="s-label">För dig som undervisar produktionsflöden</div>
            <h1 className="mt-3 max-w-3xl text-[34px] font-semibold leading-[1.1] tracking-tight sm:text-[48px]">Visa flaskhalsen – i stället för att förklara den.</h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-[var(--ink-s2)]">
              {BRAND.name} är en flödessimulator i webbläsaren med färdiga övningar om flaskhalsar, buffertar och köer. Studenterna ser linjen arbeta – och får siffror att diskutera.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/ovningar/" className="s-btn s-btn-primary">
                Prova en övning →
              </Link>
              <Link href="/larare/" className="s-btn">
                Lärarpaket
              </Link>
            </div>
            <p className="mono mt-4 text-[12.5px] text-[var(--muted-s)]">Gratis · ingen inloggning · på svenska</p>
          </div>
          <div className="min-w-0">
            <LiveDemo />
            <p className="mono mt-2 text-[11.5px] text-[var(--muted-s)]">Riktig simulering, inte en film. Fyra stationer, obegränsad tillgång – vilken station begränsar?</p>
          </div>
        </div>
      </section>

      {/* Exercises */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="s-label">01 — Vad studenterna får se</div>
        <h2 className="mt-2 text-[26px] font-semibold tracking-tight">Tre övningar, klara att använda</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {EXERCISES.map((e, i) => (
            <Link key={e.id} href={`/ovningar/#${e.id}`} className="s-card group block p-5 transition-colors hover:border-[var(--ink-s2)]">
              <div className="mono text-[12px] text-[var(--muted-s)]">
                Övning {i + 1} · ca {e.minutes} min
              </div>
              <h3 className="mt-1.5 text-[17px] font-semibold">{e.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink-s2)]">{e.intro}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {e.concepts.map((c) => (
                  <span key={c} className="rounded border border-[var(--rule)] px-1.5 py-0.5 text-[11.5px] text-[var(--ink-s2)]">
                    {c}
                  </span>
                ))}
              </div>
              <div className="mt-4 text-[13.5px] font-semibold text-[var(--signal-ink)] group-hover:underline">Läs uppgifterna →</div>
            </Link>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-[var(--rule)] bg-[var(--paper-2)]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="s-label">02 — Så använder du det</div>
          <h2 className="mt-2 text-[26px] font-semibold tracking-tight">Från länk till diskussion på tio minuter</h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="flex gap-4">
                <span className="mono grid h-9 w-9 shrink-0 place-items-center rounded-full border-[1.5px] border-[var(--ink-s)] text-[14px] font-semibold">{s.n}</span>
                <div>
                  <h3 className="text-[16px] font-semibold">{s.t}</h3>
                  <p className="mt-1 text-[14.5px] leading-relaxed text-[var(--ink-s2)]">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-10 grid gap-3 text-[14px] text-[var(--ink-s2)] sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Live-animation", "Detaljer som rör sig mellan stationer, statusfärg per maskin."],
              ["Dashboard", "Genomflöde, ledtid, PIA, OEE och flaskhalsanalys."],
              ["Parameterstudier", "Variera buffert, cykeltid eller stopp – med konfidensband."],
              ["Egen modell", "Bygg och dela egna linjer, med montering och flera linjer."],
            ].map(([t, d]) => (
              <div key={t} className="s-card p-4">
                <div className="font-semibold text-[var(--ink-s)]">{t}</div>
                <div className="mt-1">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Free vs paid */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="s-label">03 — Gratis och betalt</div>
        <h2 className="mt-2 text-[26px] font-semibold tracking-tight">Simulatorn är gratis. Förberedelsen kan du köpa.</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="s-card p-6">
            <h3 className="text-[18px] font-semibold">Gratis för alla</h3>
            <ul className="mt-3 space-y-2 text-[14.5px] text-[var(--ink-s2)]">
              <li>✓ Hela simulatorn: dashboard, live, modellbygge, analys, optimering</li>
              <li>✓ Övningarna med studentuppgifter</li>
              <li>✓ Delningslänkar till egna modeller</li>
            </ul>
          </div>
          <div className="s-card border-[var(--ink-s)] p-6">
            <h3 className="text-[18px] font-semibold">Lärarpaket</h3>
            <ul className="mt-3 space-y-2 text-[14.5px] text-[var(--ink-s2)]">
              <li>✓ Lärarhandledning med lärandemål och tidsåtgång</li>
              <li>✓ Facit med referensresultat (med konfidensintervall)</li>
              <li>✓ Diskussionsfrågor och vanliga missuppfattningar</li>
              <li>✓ Nya övningar och uppdateringar i 12 månader</li>
            </ul>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link href="/larare/" className="s-btn s-btn-primary">
                Läs mer {BRAND.priceLabel ? `· ${BRAND.priceLabel}` : ""}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="s-label">04 — Vanliga frågor</div>
        <div className="mt-4 divide-y divide-[var(--rule)] border-y border-[var(--rule)]">
          {FAQ.map((f) => (
            <details key={f.q} className="group py-4">
              <summary className="cursor-pointer list-none text-[16px] font-semibold marker:hidden">
                <span className="mr-2 inline-block w-4 text-[var(--signal-ink)] group-open:rotate-90">›</span>
                {f.q}
              </summary>
              <p className="mt-2 pl-6 text-[15px] leading-relaxed text-[var(--ink-s2)]">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* About */}
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="s-label">05 — Om projektet</div>
        <p className="mt-3 text-[16px] leading-relaxed text-[var(--ink-s2)]">
          {BRAND.founderBio ? `${BRAND.founderBio} ` : ""}{BRAND.name} började som ett fristående projekt för att göra flödessimulering lika lätt att visa som att rita på tavlan. Frågor, idéer och önskemål om övningar är välkomna.
        </p>
      </section>
    </>
  );
}
