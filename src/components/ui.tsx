"use client";
import type { ReactNode } from "react";
import { STATE_COLORS, STATE_LABELS } from "@/lib/colors";

export function Card({ title, subtitle, actions, children, className = "" }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card p-4 ${className}`}>
      {(title || actions) && (
        <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            {title && <h2 className="text-[14px] font-semibold text-white">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-[12px] text-[var(--muted)]">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Kpi({ label, value, unit, sub, tone }: { label: string; value: ReactNode; unit?: string; sub?: ReactNode; tone?: "good" | "bad" | "warn" }) {
  const toneColor = tone === "good" ? "#0ca30c" : tone === "bad" ? "#e66767" : tone === "warn" ? "#fab219" : "var(--ink-2)";
  return (
    <div className="card px-4 py-3">
      <div className="text-[12px] text-[var(--muted)]">{label}</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-[26px] font-semibold leading-none text-white">{value}</span>
        {unit && <span className="text-[13px] text-[var(--ink-2)]">{unit}</span>}
      </div>
      {sub && (
        <div className="mt-1.5 text-[12px]" style={{ color: toneColor }}>
          {sub}
        </div>
      )}
    </div>
  );
}

export function StateLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[var(--ink-2)]">
      {(Object.keys(STATE_COLORS) as (keyof typeof STATE_COLORS)[]).map((k) => (
        <span key={k} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: STATE_COLORS[k] }} />
          {STATE_LABELS[k]}
        </span>
      ))}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-white">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-[13px] text-[var(--ink-2)]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Progress({ value, label }: { value: number; label?: string }) {
  return (
    <div className="w-full">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#2c2c2a]">
        <div className="h-full rounded-full bg-[#3987e5] transition-[width]" style={{ width: `${Math.min(100, value * 100)}%` }} />
      </div>
      {label && <div className="mt-1 text-[11.5px] text-[var(--muted)]">{label}</div>}
    </div>
  );
}

export const tooltipStyle = {
  contentStyle: { background: "#0d0d0d", border: "1px solid #383835", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "#c3c2b7" },
  itemStyle: { color: "#ffffff" },
  cursor: { fill: "rgba(255,255,255,0.04)" },
};
