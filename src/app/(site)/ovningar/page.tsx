import type { Metadata } from "next";
import Link from "next/link";
import { EXERCISES } from "@/lib/sim/exercises";
import CopyLink from "@/components/site/CopyLink";

export const metadata: Metadata = {
  title: "Övningar",
  description: "Gratis övningar om flaskhalsar, buffertar och Littles lag som öppnas direkt i webbläsaren.",
};

export default function ExercisesPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="s-label">Gratis övningar</div>
      <h1 className="mt-2 text-[32px] font-semibold tracking-tight">Övningar för studenter</h1>
      <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-[var(--ink-s2)]">
        Varje övning öppnar en färdig modell i simulatorn, med uppgifterna synliga överst. Skicka länken till studenterna – inget konto behövs. Lärarhandledning med facit finns i{" "}
        <Link href="/larare/" className="underline">
          lärarpaketet
        </Link>
        .
      </p>

      <div className="mt-10 space-y-6">
        {EXERCISES.map((e, i) => {
          const path = `/app/?ovning=${e.id}`;
          return (
            <article key={e.id} id={e.id} className="s-card scroll-mt-6 p-6">
              <div className="mono text-[12px] text-[var(--muted-s)]">
                Övning {i + 1} · ca {e.minutes} min · {e.concepts.join(" · ")}
              </div>
              <h2 className="mt-1.5 text-[21px] font-semibold">{e.title}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink-s2)]">{e.intro}</p>
              <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[15px] leading-relaxed text-[var(--ink-s2)]">
                {e.tasks.map((t, k) => (
                  <li key={k}>{t}</li>
                ))}
              </ol>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link href={path} className="s-btn s-btn-primary">
                  Öppna övningen →
                </Link>
                <CopyLink path={path} />
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
