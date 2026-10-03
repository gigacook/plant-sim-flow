"use client";
import { useMemo, useState } from "react";
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, ErrorBar, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, PageHeader, Progress, tooltipStyle } from "@/components/ui";
import RunSettings from "@/components/RunSettings";
import { PARAM_LABELS, type ParamKind, type SweepPoint } from "@/lib/sim/analysis";
import { runJob } from "@/lib/sim/client";
import { useModel } from "@/lib/store/useModel";
import { CHART, SERIES } from "@/lib/colors";
import { dur, n1, pct } from "@/lib/format";

const axis = { stroke: CHART.axis, tick: { fill: CHART.muted, fontSize: 11 }, tickLine: false };

function kindsFor(kind: string): ParamKind[] {
  if (kind === "buffer") return ["capacity"];
  if (kind === "station" || kind === "assembly") return ["servers", "processScale", "mtbf", "mttr"];
  if (kind === "source") return ["interarrivalScale"];
  return [];
}

function defaults(kind: ParamKind, cur: number): [number, number, number] {
  switch (kind) {
    case "capacity":
      return [1, Math.max(10, cur * 3), 10];
    case "servers":
      return [1, Math.max(3, cur + 2), Math.max(3, cur + 2)];
    case "processScale":
    case "interarrivalScale":
      return [0.7, 1.3, 7];
    case "mtbf":
      return [30, 600, 8];
    case "mttr":
      return [2, 30, 8];
  }
}

function SweepChart({ data, k, label, color, fmt }: { data: SweepPoint[]; k: "throughput" | "leadTime" | "wip"; label: string; color: string; fmt: (v: number) => string }) {
  const rows = data.map((p) => ({ x: p.value, mean: p[k].mean, band: [p[k].mean - p[k].ci, p[k].mean + p[k].ci] }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={rows} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={CHART.grid} />
        <XAxis dataKey="x" type="number" domain={["dataMin", "dataMax"]} {...axis} />
        <YAxis width={48} {...axis} tickFormatter={(v) => fmt(v)} domain={["auto", "auto"]} />
        <Tooltip
          {...tooltipStyle}
          labelFormatter={(v) => `Värde ${n1(+v)}`}
          formatter={(v: number | number[], name: string) => (name === "band" && Array.isArray(v) ? [`${fmt(v[0])} – ${fmt(v[1])}`, "95 % KI"] : [fmt(v as number), label])}
        />
        <Area dataKey="band" stroke="none" fill={color} fillOpacity={0.18} isAnimationActive={false} />
        <Line dataKey="mean" stroke={color} strokeWidth={2} dot={{ r: 4, fill: color, stroke: CHART.surface, strokeWidth: 2 }} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export default function AnalysisPage() {
  const { model, run, reps, scenarios, removeScenario, setModel } = useModel();
  const candidates = model.nodes.filter((n) => kindsFor(n.kind).length > 0);
  const [nodeId, setNodeId] = useState(candidates.find((n) => n.kind === "buffer")?.id ?? candidates[0]?.id ?? "");
  const node = model.nodes.find((n) => n.id === nodeId);
  const kinds = node ? kindsFor(node.kind) : [];
  const [kind, setKind] = useState<ParamKind>(kinds[0] ?? "capacity");
  const effKind = kinds.includes(kind) ? kind : kinds[0];
  const cur = node ? (effKind === "capacity" ? node.capacity ?? 1 : effKind === "servers" ? node.servers ?? 1 : 1) : 1;
  const [range, setRange] = useState<[number, number, number] | null>(null);
  const [from, to, steps] = range ?? (effKind ? defaults(effKind, cur) : [1, 10, 10]);
  const [points, setPoints] = useState<SweepPoint[]>([]);
  const [progress, setProgress] = useState<number | null>(null);

  const values = useMemo(() => {
    const n = Math.max(2, Math.round(steps));
    const integer = effKind === "capacity" || effKind === "servers";
    const vs = Array.from({ length: n }, (_, i) => from + ((to - from) * i) / (n - 1));
    return [...new Set(vs.map((v) => (integer ? Math.round(v) : Math.round(v * 1000) / 1000)))];
  }, [from, to, steps, effKind]);

  const runSweep = async () => {
    if (!node || !effKind) return;
    setPoints([]);
    setProgress(0);
    const acc: SweepPoint[] = [];
    await runJob<"sweep">({ type: "sweep", model, cfg: run, param: { kind: effKind, nodeId: node.id }, values, reps }, (done, total, p) => {
      acc.push(p as SweepPoint);
      setPoints([...acc]);
      setProgress(done / total);
    });
    setProgress(null);
  };

  const best = points.length ? points.reduce((a, b) => (b.throughput.mean > a.throughput.mean ? b : a)) : null;
  const scenarioData = scenarios.map((s) => ({ name: s.name, tp: s.throughput, ci: s.throughputCi }));

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Analys & scenarier" description="Parameterstudier med konfidensintervall och jämförelse av sparade scenarier. Varje punkt simuleras med flera replikeringar och gemensamma slumptal." />

      <Card className="mb-4" title="Körinställningar">
        <RunSettings showPreset={false} />
      </Card>

      <Card title="Parameterstudie (känslighetsanalys)" subtitle="Hur påverkas genomflöde, ledtid och PIA när en parameter varieras?">
        <div className="flex flex-wrap items-end gap-3">
          <label className="w-56">
            <span className="label">Objekt</span>
            <select className="input" value={nodeId} onChange={(e) => { setNodeId(e.target.value); setRange(null); }}>
              {candidates.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </label>
          <label className="w-52">
            <span className="label">Parameter</span>
            <select className="input" value={effKind} onChange={(e) => { setKind(e.target.value as ParamKind); setRange(null); }}>
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {PARAM_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="w-24">
            <span className="label">Från</span>
            <input className="input" type="number" step="any" value={from} onChange={(e) => setRange([+e.target.value, to, steps])} />
          </label>
          <label className="w-24">
            <span className="label">Till</span>
            <input className="input" type="number" step="any" value={to} onChange={(e) => setRange([from, +e.target.value, steps])} />
          </label>
          <label className="w-20">
            <span className="label">Steg</span>
            <input className="input" type="number" min={2} max={30} value={steps} onChange={(e) => setRange([from, to, Math.min(30, Math.max(2, +e.target.value))])} />
          </label>
          <button className="btn btn-primary" onClick={runSweep} disabled={progress !== null || !node}>
            {progress !== null ? "Kör…" : `▶ Kör ${values.length * reps} simuleringar`}
          </button>
        </div>
        {progress !== null && <div className="mt-3"><Progress value={progress} label={`${Math.round(progress * 100)} %`} /></div>}

        {points.length > 0 && (
          <>
            {best && (
              <div className="mt-4 rounded-lg border border-[rgba(12,163,12,0.4)] bg-[rgba(12,163,12,0.08)] p-3 text-[13px]">
                Högst genomflöde vid <b>{PARAM_LABELS[effKind!]} = {n1(best.value)}</b>: {n1(best.throughput.mean)} ± {n1(best.throughput.ci)} st/h, ledtid {dur(best.leadTime.mean)}.
              </div>
            )}
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <div>
                <div className="mb-1 text-[12.5px] font-medium text-[var(--ink-2)]">Genomflöde (st/h)</div>
                <SweepChart data={points} k="throughput" label="Genomflöde" color={SERIES[0]} fmt={(v) => n1(v)} />
              </div>
              <div>
                <div className="mb-1 text-[12.5px] font-medium text-[var(--ink-2)]">Ledtid</div>
                <SweepChart data={points} k="leadTime" label="Ledtid" color={SERIES[1]} fmt={(v) => dur(v)} />
              </div>
              <div>
                <div className="mb-1 text-[12.5px] font-medium text-[var(--ink-2)]">PIA (st)</div>
                <SweepChart data={points} k="wip" label="PIA" color={SERIES[2]} fmt={(v) => n1(v)} />
              </div>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="data">
                <thead>
                  <tr>
                    <th>{PARAM_LABELS[effKind!]}</th>
                    <th className="num">Genomflöde</th>
                    <th className="num">± 95 % KI</th>
                    <th className="num">Ledtid</th>
                    <th className="num">PIA</th>
                    <th className="num">OEE flaskhals</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((p) => (
                    <tr key={p.value} className={p === best ? "bg-[rgba(12,163,12,0.08)]" : ""}>
                      <td>{n1(p.value)}</td>
                      <td className="num">{n1(p.throughput.mean)}</td>
                      <td className="num">{n1(p.throughput.ci)}</td>
                      <td className="num">{dur(p.leadTime.mean)}</td>
                      <td className="num">{n1(p.wip.mean)}</td>
                      <td className="num">{pct(p.oee.mean, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <Card className="mt-4" title="Scenariojämförelse" subtitle="Spara scenarier från dashboarden och jämför dem här">
        {scenarios.length === 0 ? (
          <p className="text-[13px] text-[var(--muted)]">Inga sparade scenarier ännu. Gå till Dashboard och klicka ”Spara som scenario”.</p>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[1fr_1.3fr]">
            <ResponsiveContainer width="100%" height={Math.max(160, scenarios.length * 40 + 40)}>
              <BarChart data={scenarioData} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                <CartesianGrid horizontal={false} stroke={CHART.grid} />
                <XAxis type="number" {...axis} />
                <YAxis type="category" dataKey="name" width={170} {...axis} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => [`${n1(v)} st/h`, "Genomflöde"]} />
                <Bar dataKey="tp" fill={SERIES[0]} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                  <ErrorBar dataKey="ci" width={6} stroke="#c3c2b7" direction="x" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="overflow-x-auto">
              <table className="data">
                <thead>
                  <tr>
                    <th>Scenario</th>
                    <th className="num">Genomflöde</th>
                    <th className="num">Ledtid</th>
                    <th className="num">PIA</th>
                    <th className="num">OEE</th>
                    <th>Flaskhals</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {scenarios.map((s) => (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td className="num">{n1(s.throughput)} ± {n1(s.throughputCi)}</td>
                      <td className="num">{dur(s.leadTime)}</td>
                      <td className="num">{n1(s.wip)}</td>
                      <td className="num">{pct(s.oee)}</td>
                      <td>{s.bottleneck}</td>
                      <td className="whitespace-nowrap text-right">
                        <button className="btn mr-1 px-2 py-1" onClick={() => setModel(s.model)} title="Ladda modellen">↺</button>
                        <button className="btn btn-danger px-2 py-1" onClick={() => removeScenario(s.id)} title="Ta bort">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
