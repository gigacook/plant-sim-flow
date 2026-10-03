"use client";
// Demo panel for the MOCK billing system: entitlements (server-side truth), orders, webhook log and the
// simulated inbox. Lets you exercise refund, duplicate/out-of-order delivery, forged requests and expiry.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import MockBanner from "./MockBanner";
import { advanceClock, deliverForged, deliverLateCheckoutEvent, load, mockNow, redeliver, refund, reset, type MockState } from "@/lib/billing/mock";
import { effectiveStatus } from "@/lib/billing/entitlements";

const STATUS_STYLE: Record<string, string> = {
  active: "bg-[#dcfce7] text-[#14532d]",
  pending: "bg-[#fef9c3] text-[#713f12]",
  canceled: "bg-[#fef9c3] text-[#713f12]",
  expired: "bg-[#e5e7eb] text-[#374151]",
  refunded: "bg-[#fee2e2] text-[#7f1d1d]",
};
const STATUS_LABEL: Record<string, string> = { active: "Aktiv", pending: "Väntar", canceled: "Uppsagd", expired: "Utgången", refunded: "Återbetald" };
const fmt = (iso: string | null) => (iso ? iso.replace("T", " ").slice(0, 16) : "–");

export default function BillingDemo() {
  const [s, setS] = useState<MockState | null>(null);
  const [busy, setBusy] = useState(false);
  const [openMail, setOpenMail] = useState<string | null>(null);
  const refresh = useCallback(() => setS(load()), []);
  useEffect(refresh, [refresh]);
  const run = async (fn: () => unknown) => {
    setBusy(true);
    await fn();
    refresh();
    setBusy(false);
  };

  if (!s) return null;
  const now = mockNow();
  const orders = Object.values(s.orders).reverse();
  const ents = Object.values(s.store.entitlements);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <MockBanner />
      <div className="s-label">Demo</div>
      <h1 className="mt-2 text-[30px] font-semibold tracking-tight">Betalflödet bakom kulisserna</h1>
      <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-[var(--ink-s2)]">
        Här syns samma steg som ett skarpt köp går igenom: kassa → signerad webhook från betalningsleverantören → verifiering → åtkomst sparas på servern → kvitto och välkomstmejl. Allt körs i din webbläsare.{" "}
        <Link href="/kassa/?produkt=teacher-kit" className="underline">
          Gör ett testköp
        </Link>
        .
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-2 text-[13.5px]">
        <span className="mono rounded border border-[var(--rule)] px-2 py-1">Simulerad tid: {fmt(now.toISOString())}</span>
        <button className="s-btn px-3 py-1.5 text-[13px]" disabled={busy} onClick={() => run(() => advanceClock(6))}>
          Spola fram 6 mån
        </button>
        <button className="s-btn px-3 py-1.5 text-[13px]" disabled={busy} onClick={() => run(() => deliverForged("attacker@example.invalid"))}>
          Skicka förfalskad webhook
        </button>
        <button
          className="s-btn px-3 py-1.5 text-[13px]"
          disabled={busy}
          onClick={() => {
            if (confirm("Rensa all demodata i den här webbläsaren?")) run(reset);
          }}
        >
          Återställ demo
        </button>
      </div>

      <section className="mt-8">
        <h2 className="text-[19px] font-semibold">Åtkomst (serverns sanning)</h2>
        {ents.length === 0 ? (
          <p className="mt-2 text-[14px] text-[var(--muted-s)]">Inga köp ännu.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-[14px]">
              <thead className="text-[12px] text-[var(--muted-s)]">
                <tr>
                  <th className="py-1.5 pr-3">E-post</th>
                  <th className="pr-3">Produkt</th>
                  <th className="pr-3">Status</th>
                  <th className="pr-3">Gäller till</th>
                </tr>
              </thead>
              <tbody>
                {ents.map((e) => {
                  const st = effectiveStatus(s.store, e.customer, e.product, now);
                  return (
                    <tr key={`${e.customer}${e.product}`} className="border-t border-[var(--rule)]">
                      <td className="py-2 pr-3">{e.customer}</td>
                      <td className="pr-3">{e.product}</td>
                      <td className="pr-3">
                        <span className={`rounded px-2 py-0.5 text-[12.5px] font-semibold ${STATUS_STYLE[st] ?? ""}`}>{STATUS_LABEL[st] ?? st}</span>
                      </td>
                      <td className="pr-3">{fmt(e.periodEnd)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-[19px] font-semibold">Ordrar (hos betalningsleverantören)</h2>
        {orders.length === 0 ? (
          <p className="mt-2 text-[14px] text-[var(--muted-s)]">Inga ordrar.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {orders.map((o) => (
              <li key={o.id} className="s-card flex flex-wrap items-center justify-between gap-3 p-3 text-[14px]">
                <span>
                  <span className="mono">{o.id}</span> · {o.email} · {o.amountSek} kr · {o.status === "paid" ? "Betald" : `Återbetald ${fmt(o.refundedAt)}`}
                </span>
                <span className="flex flex-wrap gap-2">
                  <button className="s-btn px-2.5 py-1 text-[12.5px]" disabled={busy || o.status === "refunded"} onClick={() => run(() => refund(o.id))}>
                    Återbetala
                  </button>
                  <button className="s-btn px-2.5 py-1 text-[12.5px]" disabled={busy} onClick={() => run(() => deliverLateCheckoutEvent(o.id))}>
                    Sen händelse (fel ordning)
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-[19px] font-semibold">Webhook-logg</h2>
        {s.deliveries.length === 0 ? (
          <p className="mt-2 text-[14px] text-[var(--muted-s)]">Inga leveranser.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="text-[12px] text-[var(--muted-s)]">
                <tr>
                  <th className="py-1.5 pr-3">Tid</th>
                  <th className="pr-3">Händelse</th>
                  <th className="pr-3">Svar</th>
                  <th />
                </tr>
              </thead>
              <tbody className="mono">
                {s.deliveries.slice(0, 30).map((d, i) => (
                  <tr key={i} className="border-t border-[var(--rule)]">
                    <td className="py-1.5 pr-3 whitespace-nowrap">{fmt(d.at)}</td>
                    <td className="pr-3">{d.type}</td>
                    <td className={`pr-3 ${d.outcome.startsWith("400") ? "text-[#b91c1c]" : ""}`}>{d.outcome}</td>
                    <td>
                      {d.webhookId !== "forged" && (
                        <button className="underline" disabled={busy} onClick={() => run(() => redeliver(d.webhookId))}>
                          Leverera igen
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-[19px] font-semibold">Demoinkorg (skickas inte)</h2>
        {s.outbox.length === 0 ? (
          <p className="mt-2 text-[14px] text-[var(--muted-s)]">Inga mejl.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--rule)] border-y border-[var(--rule)]">
            {s.outbox.map((m) => (
              <li key={m.id} className="py-2.5">
                <button className="w-full text-left" onClick={() => setOpenMail(openMail === m.id ? null : m.id)} aria-expanded={openMail === m.id}>
                  <div className="text-[14px] font-semibold">{m.subject}</div>
                  <div className="text-[12.5px] text-[var(--muted-s)]">
                    Från {m.from} · till {m.to} · {fmt(m.at)}
                  </div>
                </button>
                {openMail === m.id && <pre className="mono mt-2 whitespace-pre-wrap rounded-md bg-[var(--paper-2)] p-3 text-[13px]">{m.body}</pre>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
