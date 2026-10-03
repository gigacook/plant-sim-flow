"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useModel } from "@/lib/store/useModel";
import { BRAND } from "@/lib/brand";
import { EXERCISES } from "@/lib/sim/exercises";
import { clone } from "@/lib/sim/presets";
import { decodeModel } from "@/lib/share";
import { validateModel } from "@/lib/sim/validate";
import type { Model } from "@/lib/sim/types";

const NAV = [
  { href: "/app/", label: "Dashboard", icon: "▦" },
  { href: "/app/live/", label: "Live-simulering", icon: "▶" },
  { href: "/app/modell/", label: "Modell & layout", icon: "⌗" },
  { href: "/app/analys/", label: "Analys & scenarier", icon: "∿" },
  { href: "/app/optimering/", label: "Optimering", icon: "◎" },
];

/** Läser in övning (?ovning=id) eller delad modell (#m=…) från adressen innan sidan renderas. */
async function loadFromUrl(setModel: (m: Model) => void): Promise<string | null> {
  const url = new URL(window.location.href);
  const ex = url.searchParams.get("ovning");
  if (ex) {
    const found = EXERCISES.find((e) => e.id === ex);
    url.searchParams.delete("ovning");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    if (found) {
      setModel(clone(found.model));
      return `Övningen ”${found.title}” är laddad.`;
    }
    return "Övningen hittades inte.";
  }
  const m = url.hash.match(/^#m=(.+)$/);
  if (m) {
    window.history.replaceState(null, "", url.pathname + url.search);
    try {
      setModel(validateModel(await decodeModel(m[1])));
      return "Den delade modellen är laddad.";
    } catch {
      return "Länken kunde inte läsas – modellen är oförändrad.";
    }
  }
  return null;
}

function ExercisePanel() {
  const modelName = useModel((s) => s.model.name);
  const ex = EXERCISES.find((e) => e.model.name === modelName);
  const [open, setOpen] = useState(true);
  if (!ex) return null;
  return (
    <section className="card mb-4 border-[rgba(57,135,229,0.45)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[11.5px] font-semibold uppercase tracking-wide text-[#86b6ef]">Övning · ca {ex.minutes} min</div>
          <h2 className="text-[15px] font-semibold">{ex.title}</h2>
        </div>
        <button className="btn px-2.5 py-1 text-[12px]" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? "Dölj uppgifter" : "Visa uppgifter"}
        </button>
      </div>
      {open && (
        <>
          <p className="mt-2 max-w-3xl text-[13px] text-[var(--ink-2)]">{ex.intro}</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13px] text-[var(--ink-2)]">
            {ex.tasks.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const modelName = useModel((s) => s.model.name);
  const setModel = useModel((s) => s.setModel);
  useEffect(() => {
    let alive = true;
    loadFromUrl(setModel).then((msg) => {
      if (!alive) return;
      setNotice(msg);
      setReady(true);
    });
    // A second shared link pasted into an already open tab only changes the hash.
    const onHash = () => loadFromUrl(setModel).then((msg) => msg && setNotice(msg));
    window.addEventListener("hashchange", onHash);
    return () => {
      alive = false;
      window.removeEventListener("hashchange", onHash);
    };
  }, [setModel]);
  const norm = (p: string) => (p.endsWith("/") ? p : p + "/");

  return (
    <div className="min-h-screen lg:flex">
      <aside className="border-b border-[var(--border)] bg-[#121211] lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r">
        <Link href="/" className="flex items-center gap-2.5 px-5 py-4" title="Till startsidan">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#d95926] text-[15px] font-bold text-white">{BRAND.name[0]}</div>
          <div>
            <div className="text-[14px] font-semibold leading-tight">{BRAND.name}</div>
            <div className="text-[11px] text-[var(--muted)]">{BRAND.tagline}</div>
          </div>
        </Link>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible" aria-label="Simulator">
          {NAV.map((n) => {
            const active = norm(path) === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                  active ? "bg-[rgba(57,135,229,0.16)] text-white" : "text-[var(--ink-2)] hover:bg-[#1f1f1d]"
                }`}
              >
                <span className={`w-4 text-center ${active ? "text-[#86b6ef]" : "text-[var(--muted)]"}`} aria-hidden>
                  {n.icon}
                </span>
                {n.label}
              </Link>
            );
          })}
          <Link href="/ovningar/" className="flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-[var(--ink-2)] hover:bg-[#1f1f1d]">
            <span className="w-4 text-center text-[var(--muted)]" aria-hidden>
              ✎
            </span>
            Övningar
          </Link>
        </nav>
        {ready && (
          <div className="mx-4 mt-2 hidden rounded-lg border border-[var(--border)] p-3 lg:block">
            <div className="text-[11px] text-[var(--muted)]">Aktiv modell</div>
            <div className="mt-0.5 text-[12.5px] font-medium text-[var(--ink-2)]">{modelName}</div>
            <div className="mt-2 text-[11px] leading-snug text-[var(--muted)]">Sparas bara i den här webbläsaren. Exportera under Modell & layout för att spara en kopia.</div>
          </div>
        )}
      </aside>
      <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">
        {notice && (
          <div role="status" className="card mb-4 flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]">
            <span>{notice}</span>
            <button className="text-[var(--muted)] hover:text-white" onClick={() => setNotice(null)} aria-label="Stäng">
              ✕
            </button>
          </div>
        )}
        {ready ? (
          <>
            <ExercisePanel />
            {children}
          </>
        ) : (
          <div className="text-[var(--muted)]">Laddar…</div>
        )}
      </main>
    </div>
  );
}
