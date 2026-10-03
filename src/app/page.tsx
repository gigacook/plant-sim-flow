"use client";
import { useMemo, useState } from "react";
import FactoryCanvas from "@/components/FactoryCanvas";
import RunSettings from "@/components/RunSettings";
import { BottleneckChart, BufferChart, LeadTimeHistogram, StateChart, ThroughputChart, WipChart } from "@/components/charts";
import { Card, Kpi, PageHeader, StateLegend } from "@/components/ui";
import { insights } from "@/lib/sim/analysis";
import { useModel } from "@/lib/store/useModel";
import { useRun } from "@/lib/store/useRun";
import { dur, n0, n1, pct } from "@/lib/format";

const LEVEL_STYLE = {
  critical: { c: "#d03b3b", icon: "▲", label: "Kritiskt" },
  warning: { c: "#fab219", icon: "!", label: "Varning" },
  info: { c: "#3987e5", icon: "i", label: "Info" },
  good: { c: "#0ca30c", icon: "✓", label: "Bra" },
};

export default function Dashboard() {
  const { model, run, reps, addScenario } = useModel();
  const { summary, avg, running, stale, execute, error } = useRun(true);
  const [saved, setSaved] = useState(false);
  const tips = useMemo(() => (avg ? insights(model, avg) : []), [avg, model]);
  const bnName = avg?.bottleneckId ? model.nodes.find((n) => n.id === avg.bottleneckId)?.name : "–";
  const lines = model.lines;

  const save = () => {
    if (!summary || !avg) return;
    addScenario({
      id: Math.random().toString(36).slice(2),
      name: `${model.name} – ${new Date().toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}`,
      createdAt: Date.now(),
      model,
      throughput: summary.throughput.mean,
      throughputCi: summary.throughput.ci,
      leadTime: summary.leadTime.mean,
      wip: summary.wip.mean,
      oee: avg.oee,
      bottleneck: bnName ?? null,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Produktionsdashboard"
        description={
          <>
            {model.name} · {lines.length} {lines.length === 1 ? "linje" : "linjer"} · {model.nodes.filter((n) => n.kind === "station" || n.kind === "assembly").length} stationer ·{" "}
            {n1(run.duration / 3600)} h körtid efter {n1(run.warmup / 3600)} h uppvärmning · {reps} replikeringar
          </>
        }
        actions={
          <>
            <button className="btn" onClick={save} disabled={!avg || running}>
              {saved ? "✓ Sparat" : "＋ Spara som scenario"}
            </button>
            <button className="btn btn-primary" onClick={execute} disabled={running}>
              {running ? "Simulerar…" : stale ? "▶ Kör simulering" : "↻ Kör igen"}
            </button>
          </>
        }
      />

      <Card className="mb-4">
        <RunSettings />
      </Card>

      {error && <div className="card mb-4 border-[#d03b3b] p-3 text-[13px] text-[#f0a3a3]">Fel: {error}</div>}

      {!avg ? (
        <div className="card p-10 text-center text-[var(--muted)]">{running ? "Simulerar…" : "Ingen körning ännu"}</div>
      ) : (
        <div className={`transition-opacity ${running ? "opacity-60" : ""}`}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Kpi label="Genomflöde" value={n1(summary!.throughput.mean)} unit="st/h" sub={`± ${n1(summary!.throughput.ci)} (95 % KI)`} />
            <Kpi label="Producerat per körning" value={n0(avg.totalOutput)} unit="st" sub={`${n1(avg.totalScrap)} kasserade`} tone={avg.totalScrap > 0 ? "warn" : undefined} />
            <Kpi label="Ledtid (medel)" value={dur(avg.avgLeadTime)} sub={`P95: ${dur(avg.p95LeadTime)}`} />
            <Kpi label="PIA / WIP (medel)" value={n1(avg.avgWip)} unit="st" sub={`Little: ${dur(avg.littleLeadTime)}`} />
            <Kpi label="OEE i flaskhals" value={pct(avg.oee)} tone={avg.oee > 0.75 ? "good" : avg.oee > 0.6 ? "warn" : "bad"} sub={avg.oee > 0.75 ? "God nivå" : avg.oee > 0.6 ? "Förbättringspotential" : "Låg"} />
            <Kpi label="Flaskhals" value={<span className="text-[18px]">{bnName}</span>} sub={avg.bottleneckId ? `${pct(avg.stations.find((s) => s.id === avg.bottleneckId)!.bottleneckShare)} av tiden` : ""} tone="bad" />
          </div>

          <Card className="mt-4" title="Flödeskarta" subtitle="Linjebredd = antal detaljer per kant · stapel i station = tillståndsfördelning · hovra för detaljer" actions={<StateLegend />}>
            <FactoryCanvas model={model} result={avg} height={430} />
          </Card>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <Card title="Stationernas tillstånd" subtitle="Andel av tiden per tillstånd (medel över replikeringar)" actions={<StateLegend />}>
              <StateChart result={avg} />
            </Card>
            <Card title="Flaskhalsanalys" subtitle="Aktiv-period-metoden: andel av tiden stationen begränsar systemet">
              <BottleneckChart result={avg} />
            </Card>
            <Card title="Genomflöde över tid" subtitle={`Utflöde per timme, replikering 1 (intervall ${dur(run.sampleInterval)})`}>
              <ThroughputChart result={summary!.runs[0]} warmup={run.warmup} />
            </Card>
            <Card title="Produkter i arbete (PIA)" subtitle="Antal detaljer i systemet, replikering 1">
              <WipChart result={summary!.runs[0]} warmup={run.warmup} />
            </Card>
            <Card title="Buffertbeläggning" subtitle="Medelnivå (blå) mot kapacitet">
              <BufferChart result={avg} />
            </Card>
            <Card title="Ledtidsfördelning" subtitle="Tid från inflöde till utlopp, replikering 1">
              <LeadTimeHistogram result={summary!.runs[0]} />
            </Card>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1.4fr]">
            <Card title="Analys & förbättringsförslag" subtitle="Automatiskt genererade utifrån resultatet">
              <ul className="space-y-2.5">
                {tips.map((t, i) => {
                  const s = LEVEL_STYLE[t.level];
                  return (
                    <li key={i} className="flex gap-3 rounded-lg border border-[var(--border)] bg-[var(--canvas)] p-3">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold text-black" style={{ background: s.c }} aria-label={s.label}>
                        {s.icon}
                      </span>
                      <div>
                        <div className="text-[13px] font-semibold">{t.title}</div>
                        <div className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--ink-2)]">{t.text}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
            <Card title="Stationsdata" subtitle="OEE = tillgänglighet × prestanda × kvalitet">
              <div className="overflow-x-auto">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Station</th>
                      <th className="num">Maskiner</th>
                      <th className="num">Bearbetat</th>
                      <th className="num">Kassation</th>
                      <th className="num">Tillgängl.</th>
                      <th className="num">Prestanda</th>
                      <th className="num">Kvalitet</th>
                      <th className="num">OEE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {avg.stations.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: lines.find((l) => l.id === s.lineId)?.color }} />
                          {s.name}
                          {s.id === avg.bottleneckId && <span className="ml-2 rounded bg-[#d03b3b] px-1.5 py-0.5 text-[10px] font-bold">FLASKHALS</span>}
                        </td>
                        <td className="num">{s.servers}</td>
                        <td className="num">{n0(s.processed)}</td>
                        <td className="num">{n1(s.scrapped)}</td>
                        <td className="num">{pct(s.availability, 1)}</td>
                        <td className="num">{pct(s.performance, 1)}</td>
                        <td className="num">{pct(s.quality, 1)}</td>
                        <td className="num font-semibold">{pct(s.oee, 1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {avg.sinks.length > 0 && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {avg.sinks.map((s) => (
                    <div key={s.id} className="rounded-lg border border-[var(--border)] p-3 text-[12.5px]">
                      <div className="font-semibold">{s.name}</div>
                      <div className="mt-1 text-[var(--ink-2)]">
                        {n1(s.throughputPerHour)} st/h · ledtid {dur(s.avgLeadTime)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
