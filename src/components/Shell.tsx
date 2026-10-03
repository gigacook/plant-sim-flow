"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useModel } from "@/lib/store/useModel";

const NAV = [
  { href: "/", label: "Dashboard", icon: "▦" },
  { href: "/live/", label: "Live-simulering", icon: "▶" },
  { href: "/modell/", label: "Modell & layout", icon: "⌗" },
  { href: "/analys/", label: "Analys & scenarier", icon: "∿" },
  { href: "/optimering/", label: "Optimering", icon: "◎" },
];

export default function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [ready, setReady] = useState(false);
  const modelName = useModel((s) => s.model.name);
  useEffect(() => setReady(true), []);
  const norm = (p: string) => (p.endsWith("/") ? p : p + "/");

  return (
    <div className="min-h-screen lg:flex">
      <aside className="border-b border-[var(--border)] bg-[#121211] lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2.5 px-5 py-4">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#2a78d6] text-[15px] font-bold">P</div>
          <div>
            <div className="text-[14px] font-semibold leading-tight">PlantFlow</div>
            <div className="text-[11px] text-[var(--muted)]">Fabriksflödessimulering</div>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible">
          {NAV.map((n) => {
            const active = norm(path) === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                  active ? "bg-[rgba(57,135,229,0.16)] text-white" : "text-[var(--ink-2)] hover:bg-[#1f1f1d]"
                }`}
              >
                <span className={`w-4 text-center ${active ? "text-[#86b6ef]" : "text-[var(--muted)]"}`}>{n.icon}</span>
                {n.label}
              </Link>
            );
          })}
        </nav>
        {ready && (
          <div className="mx-4 mt-2 hidden rounded-lg border border-[var(--border)] p-3 lg:block">
            <div className="text-[11px] text-[var(--muted)]">Aktiv modell</div>
            <div className="mt-0.5 text-[12.5px] font-medium text-[var(--ink-2)]">{modelName}</div>
          </div>
        )}
      </aside>
      <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">{ready ? children : <div className="text-[var(--muted)]">Laddar…</div>}</main>
    </div>
  );
}
