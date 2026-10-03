"use client";
import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, Legend } from "recharts";
import { Card, Kpi, PageHeader, Progress, tooltipStyle } from "@/components/ui";
import RunSettings from "@/components/RunSettings";
import { runJob, stopJobs } from "@/lib/sim/client";
import { applyVars, type Evaluation, type OptProgress, type OptResult, type OptVar } from "@/lib/sim/optimize";
import { useModel } from "@/lib/store/useModel";
import { CHART, SERIES } from "@/lib/colors";
import { dur, n0, n1 } from "@/lib/format";

const axis = { stroke: CHART.axis, tick: { fill: CHART.muted, fontSize: 11 }, tickLine: false };

interface VarRow extends OptVar {
  on: boolean;
}

export default function OptimizationPage() {
  const { model, run, reps, setModel } = useModel();
  const initialVars = useMemo<VarRow[]>(
    () =>
      model.nodes.flatMap((n): VarRow[] => {
        if (n.kind === "buffer") return [{ nodeId: n.id, kind: "capacity", min: 1, max: Math.max(12, (n.capacity ?? 1) * 2), on: true }];
        if (n.kind === "station" || n.kind === "assembly") return [{ nodeId: n.id, kind: "servers", min: 1, max: Math.max(3, (n.servers ?? 1) + 1), on: false }];
        return [];
      }),
    [model.nodes],
  );
  const [vars, setVars] = useState<VarRow[]>(initialVars);
  const varsValid = vars.length === initialVars.length && vars.every((v, i) => v.nodeId === initialVars[i].nodeId);
  const rows = varsValid ? vars : initialVars;

  const [margin, setMargin] = useState(250);
  const [bufCost, setBufCost] = useState(15);
  const [machCost, setMachCost] = useState(900);
  const [minTp, setMinTp] = useState(0);
  const [iterations, setIterations] = useState(60);
  const [optReps, setOptReps] = useState(Math.min(reps, 3));
  const [running, setRunning] = useState(false);
  const [prog, setProg] = useState<OptProgress | null>(null);
  const [history, setHistory] = useState<{ iteration: number; current: number; best: number }[]>([]);
  const [evals, setEvals] = useState<Evaluation[]>([]);
  const [result, setResult] = useState<OptResult | null>(null);

  const active = rows.filter((v) => v.on);
  const name = (id: string) => model.nodes.find((n) => n.id === id)?.name ?? id;
  const update = (i: number, patch: Partial<VarRow>) => setVars(rows.map((v, k) => (k === i ? { ...v, ...patch } : v)));

  const start = async () => {
    if (!active.length) return;
    setRunning(true);
    setResult(null);
    setHistory([]);
    setEvals([]);
    const hist: typeof history = [];
    const ev: Evaluation[] = [];
    const seen = new Set<string>();
    try {
      const res = await runJob<"optimize">(
        {
          type: "optimize",
          model,
          cfg: run,
          spec: {
            vars: active.map(({ on: _on, ...v }) => v),
            marginPerPart: margin,
            bufferCostPerHour: bufCost,
            machineCostPerHour: machCost,
            minThroughput: minTp,
            iterations,
            reps: optReps,
            seed: run.seed,
          },
        },
        (_d, _t, payload) => {
          const p = payload as OptProgress;
          setProg(p);
          hist.push({ iteration: p.iteration, current: p.current.profit, best: p.best.profit });
          if (!seen.has(p.current.key)) {
            seen.add(p.current.key);
            ev.push(p.current);
          }
          if (p.iteration % 2 === 0 || p.iteration === p.total) {
            setHistory([...hist]);
            setEvals([...ev]);
          }
        },
      );
      setResult(res.result);
      setHistory(res.result.history);
      setEvals(res.result.evaluations);
    } finally {
      setRunning(false);
    }
  };

  const best = result?.best ?? prog?.best ?? null;
  const base = result?.baseline ?? null;
  const varsUsed = active;
  const feasible = evals.filter((e) => e.feasible && e !== best).map((e) => ({ cost: e.cost, tp: e.throughput, profit: e.profit }));
  const infeasible = evals.filter((e) => !e.feasible).map((e) => ({ cost: e.cost, tp: e.throughput, profit: e.profit }));

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Optimering"
        description="Hitta den mest lönsamma kombinationen av buffertstorlekar och maskinantal. Simulerad glödgning söker bland konfigurationer; varje kandidat utvärderas med replikeringar och gemensamma slumptal."
      />

      <Card className="mb-4" title="Körinställningar">
        <RunSettings showPreset={false} />
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Card title="Beslutsvariabler" subtitle="Välj vilka buffertar och stationer som får ändras, och inom vilka gränser">
          <div className="max-h-[360px] overflow-auto">
            <table className="data">
              <thead>
                <tr>
                  <th />
                  <th>Objekt</th>
                  <th>Variabel</th>
                  <th className="num">Nu</th>
                  <th className="num">Min</th>
                  <th className="num">Max</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((v, i) => {
                  const n = model.nodes.find((x) => x.id === v.nodeId)!;
                  return (
                    <tr key={`${v.nodeId}-${v.kind}`} className={v.on ? "" : "opacity-50"}>
                      <td>
                        <input type="checkbox" checked={v.on} onChange={(e) => update(i, { on: e.target.checked })} aria-label="Inkludera" />
                      </td>
                      <td>{n.name}</td>
                      <td className="text-[var(--ink-2)]">{v.kind === "capacity" ? "Buffertkapacitet" : "Antal maskiner"}</td>
                      <td className="num">{v.kind === "capacity" ? n.capacity : n.servers ?? 1}</td>
                      <td className="num">
                        <input className="input w-16 text-right" type="number" min={1} value={v.min} onChange={(e) => update(i, { min: Math.max(1, Math.round(+e.target.value)) })} />
                      </td>
                      <td className="num">
                        <input className="input w-16 text-right" type="number" min={v.min} value={v.max} onChange={(e) => update(i, { max: Math.max(v.min, Math.round(+e.target.value)) })} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Målfunktion" subtitle="Vinst/h = täckningsbidrag × genomflöde − buffertkostnad − maskinkostnad">
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="label">Täckningsbidrag (kr/st)</span>
              <input className="input" type="number" value={margin} onChange={(e) => setMargin(+e.target.value)} />
            </label>
            <label>
              <span className="label">Buffertplats (kr/h)</span>
              <input className="input" type="number" value={bufCost} onChange={(e) => setBufCost(+e.target.value)} />
            </label>
            <label>
              <span className="label">Maskin (kr/h)</span>
              <input className="input" type="number" value={machCost} onChange={(e) => setMachCost(+e.target.value)} />
            </label>
            <label>
              <span className="label">Min. genomflöde (st/h)</span>
              <input className="input" type="number" min={0} value={minTp} onChange={(e) => setMinTp(+e.target.value)} />
            </label>
            <label>
              <span className="label">Iterationer</span>
              <input className="input" type="number" min={5} max={500} value={iterations} onChange={(e) => setIterations(Math.min(500, Math.max(5, +e.target.value)))} />
            </label>
            <label>
              <span className="label">Replikeringar / kandidat</span>
              <input className="input" type="number" min={1} max={20} value={optReps} onChange={(e) => setOptReps(Math.min(20, Math.max(1, +e.target.value)))} />
            </label>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button className="btn btn-primary" onClick={start} disabled={running || !active.length}>
              {running ? "Optimerar…" : "◎ Starta optimering"}
            </button>
            {running && (
              <button className="btn btn-danger" onClick={stopJobs}>
                ■ Stoppa
              </button>
            )}
          </div>
          {running && prog && (
            <div className="mt-3">
              <Progress value={prog.iteration / prog.total} label={`Iteration ${prog.iteration} av ${prog.total} · temperatur ${n0(prog.temperature)}`} />
            </div>
          )}
        </Card>
      </div>

      {best && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Bästa vinst" value={n0(best.profit)} unit="kr/h" sub={base ? `${best.profit >= base.profit ? "+" : ""}${n0(best.profit - base.profit)} kr/h mot nuläge` : "pågår…"} tone={base && best.profit > base.profit ? "good" : undefined} />
            <Kpi label="Genomflöde" value={n1(best.throughput)} unit="st/h" sub={base ? `Nuläge ${n1(base.throughput)} st/h` : `± ${n1(best.throughputCi)}`} />
            <Kpi label="Kostnad" value={n0(best.cost)} unit="kr/h" sub={base ? `Nuläge ${n0(base.cost)} kr/h` : ""} />
            <Kpi label="Ledtid / PIA" value={dur(best.leadTime)} sub={`${n1(best.wip)} st i arbete`} />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <Card title="Konvergens" subtitle="Vinst per iteration – bästa hittills och aktuell kandidat">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={history} margin={{ left: 8, right: 12, top: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="iteration" {...axis} />
                  <YAxis width={56} {...axis} domain={["auto", "auto"]} tickFormatter={(v) => n0(v)} />
                  <Tooltip {...tooltipStyle} formatter={(v: number, k: string) => [`${n0(v)} kr/h`, k === "best" ? "Bästa" : "Aktuell"]} labelFormatter={(v) => `Iteration ${v}`} />
                  <Legend formatter={(v) => (v === "best" ? "Bästa hittills" : "Aktuell lösning")} wrapperStyle={{ fontSize: 12, color: CHART.text }} />
                  <Line dataKey="current" stroke="#6b6a65" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  <Line dataKey="best" type="stepAfter" stroke={SERIES[2]} strokeWidth={2.5} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
            <Card title="Utvärderade konfigurationer" subtitle="Genomflöde mot kostnad – bästa lösningen markerad">
              <ResponsiveContainer width="100%" height={260}>
                <ScatterChart margin={{ left: 8, right: 12, top: 8, bottom: 0 }}>
                  <CartesianGrid stroke={CHART.grid} />
                  <XAxis dataKey="cost" type="number" name="Kostnad" unit=" kr/h" domain={["auto", "auto"]} {...axis} />
                  <YAxis dataKey="tp" type="number" name="Genomflöde" width={48} domain={["auto", "auto"]} {...axis} />
                  <ZAxis range={[50, 50]} />
                  <Tooltip {...tooltipStyle} formatter={(v: number, k: string) => [k === "Kostnad" ? `${n0(v)} kr/h` : `${n1(v)} st/h`, k]} />
                  <Legend wrapperStyle={{ fontSize: 12, color: CHART.text }} />
                  <Scatter name="Godkända" data={feasible} fill={SERIES[0]} fillOpacity={0.7} isAnimationActive={false} />
                  {infeasible.length > 0 && <Scatter name="Under min. genomflöde" data={infeasible} fill="#6b6a65" isAnimationActive={false} />}
                  <Scatter name="Bästa" data={[{ cost: best.cost, tp: best.throughput }]} fill={SERIES[2]} shape="star" isAnimationActive={false} />
                </ScatterChart>
              </ResponsiveContainer>
            </Card>
          </div>

          <Card
            className="mt-4"
            title="Rekommenderad konfiguration"
            actions={
              result && (
                <button className="btn btn-primary" onClick={() => setModel({ ...applyVars(model, varsUsed, best.values), name: model.name.replace(/ \(optimerad\)$/, "") + " (optimerad)" })}>
                  ✓ Tillämpa på modellen
                </button>
              )
            }
          >
            <div className="overflow-x-auto">
              <table className="data">
                <thead>
                  <tr>
                    <th>Objekt</th>
                    <th>Variabel</th>
                    <th className="num">Nuläge</th>
                    <th className="num">Optimerat</th>
                    <th className="num">Förändring</th>
                  </tr>
                </thead>
                <tbody>
                  {varsUsed.map((v, i) => {
                    const n = model.nodes.find((x) => x.id === v.nodeId)!;
                    const now = v.kind === "capacity" ? n.capacity ?? 1 : n.servers ?? 1;
                    const opt = best.values[i];
                    const d = opt - now;
                    return (
                      <tr key={`${v.nodeId}-${v.kind}`}>
                        <td>{name(v.nodeId)}</td>
                        <td className="text-[var(--ink-2)]">{v.kind === "capacity" ? "Buffertkapacitet" : "Antal maskiner"}</td>
                        <td className="num">{now}</td>
                        <td className="num font-semibold">{opt}</td>
                        <td className="num" style={{ color: d > 0 ? "#86b6ef" : d < 0 ? "#f0a3a3" : CHART.muted }}>
                          {d > 0 ? `+${d}` : d === 0 ? "–" : d}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
