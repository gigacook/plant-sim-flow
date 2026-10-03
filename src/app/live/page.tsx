"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import FactoryCanvas, { type Token } from "@/components/FactoryCanvas";
import { Card, Kpi, PageHeader, StateLegend, tooltipStyle } from "@/components/ui";
import { Simulation, type Snapshot } from "@/lib/sim/engine";
import { PRESETS } from "@/lib/sim/presets";
import { useModel } from "@/lib/store/useModel";
import { CHART, SERIES, SERVER_COLORS } from "@/lib/colors";
import { clock, n0, n1, pct } from "@/lib/format";

const SPEEDS = [1, 5, 20, 60, 180, 600];
const TOKEN_MS = 650;

interface Point {
  h: number;
  wip: number;
  rate: number;
}

export default function LivePage() {
  const { model, run, loadPreset } = useModel();
  const simRef = useRef<Simulation | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(60);
  const [series, setSeries] = useState<Point[]>([]);
  const tokenBuf = useRef<{ key: string; edge: string; born: number }[]>([]);
  const lastSample = useRef({ t: 0, out: 0 });
  const speedRef = useRef(speed);
  speedRef.current = speed;

  const reset = useCallback(() => {
    const sim = new Simulation(model, { duration: run.duration + run.warmup, warmup: 0, seed: run.seed, sampleInterval: 3600 });
    sim.trackMoves = true;
    simRef.current = sim;
    tokenBuf.current = [];
    lastSample.current = { t: 0, out: 0 };
    setSeries([]);
    setTokens([]);
    setSnap(sim.snapshot());
  }, [model, run.duration, run.warmup, run.seed]);

  useEffect(() => {
    reset();
    setPlaying(false);
  }, [reset]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    let seq = 0;
    const loop = (now: number) => {
      const sim = simRef.current;
      if (!sim) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      sim.advanceTo(sim.t + dt * speedRef.current);
      // animera förflyttningar
      const moves = sim.moves;
      sim.moves = [];
      const keep = moves.length > 60 ? moves.slice(-60) : moves;
      for (const m of keep) tokenBuf.current.push({ key: `${seq++}`, edge: m.edge, born: now });
      tokenBuf.current = tokenBuf.current.filter((t) => now - t.born < TOKEN_MS).slice(-160);
      setTokens(tokenBuf.current.map((t) => ({ key: t.key, edge: t.edge, progress: (now - t.born) / TOKEN_MS })));
      const s = sim.snapshot();
      setSnap(s);
      if (sim.t - lastSample.current.t >= 300) {
        const rate = ((s.output - lastSample.current.out) * 3600) / (sim.t - lastSample.current.t);
        lastSample.current = { t: sim.t, out: s.output };
        setSeries((prev) => [...prev.slice(-400), { h: sim.t / 3600, wip: s.wip, rate }]);
      }
      if (sim.done) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const sim = simRef.current;
  const stations = model.nodes.filter((n) => n.kind === "station" || n.kind === "assembly");
  const elapsed = snap?.t ?? 0;
  const total = run.duration + run.warmup;
  const tp = elapsed > 0 ? ((snap?.output ?? 0) * 3600) / elapsed : 0;
  const bn = stations.find((s) => snap?.nodes[s.id]?.bottleneck);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Live-simulering"
        description="Se materialet flöda genom fabriken i realtid. Stationsramens färg visar tillstånd, prickarna visar varje maskin, och den pulserande ramen markerar momentan flaskhals."
        actions={
          <select className="input w-56" value={PRESETS.find((p) => p.model.name === model.name)?.id ?? ""} onChange={(e) => e.target.value && loadPreset(e.target.value)}>
            <option value="">{model.name}</option>
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        }
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn btn-primary w-28 justify-center" onClick={() => setPlaying((p) => !p)} disabled={sim?.done}>
            {playing ? "❚❚ Paus" : "▶ Starta"}
          </button>
          <button className="btn" onClick={() => { setPlaying(false); reset(); }}>
            ↺ Återställ
          </button>
          <button className="btn" disabled={playing || sim?.done} onClick={() => { const s = simRef.current; if (s) { s.advanceTo(s.t + 3600); s.moves = []; setSnap(s.snapshot()); } }}>
            ⏭ +1 h
          </button>
          <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] p-1">
            {SPEEDS.map((s) => (
              <button key={s} onClick={() => setSpeed(s)} className={`rounded-md px-2.5 py-1 text-[12px] font-semibold ${speed === s ? "bg-[#2a78d6] text-white" : "text-[var(--ink-2)] hover:bg-[#2c2c2a]"}`}>
                {s}×
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="tabular text-[22px] font-semibold">{clock(elapsed)}</span>
            <div className="h-1.5 w-40 overflow-hidden rounded-full bg-[#2c2c2a]">
              <div className="h-full bg-[#3987e5]" style={{ width: `${(elapsed / total) * 100}%` }} />
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Producerat" value={n0(snap?.output ?? 0)} unit="st" sub={snap?.scrap ? `${snap.scrap} kasserade` : "Inga kassationer"} tone={snap?.scrap ? "warn" : undefined} />
        <Kpi label="Genomflöde (hittills)" value={n1(tp)} unit="st/h" />
        <Kpi label="PIA just nu" value={n0(snap?.wip ?? 0)} unit="st" />
        <Kpi label="Momentan flaskhals" value={<span className="text-[18px]">{bn?.name ?? "–"}</span>} tone="bad" sub={bn ? "Längst aktiv period" : ""} />
      </div>

      <Card className="mt-4" title="Fabriksgolv" actions={<StateLegend />}>
        <FactoryCanvas model={model} snapshot={snap} tokens={tokens} height={480} />
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card title="Stationsstatus" subtitle="Aktuellt tillstånd per maskin och beläggning hittills">
          <div className="grid gap-2 sm:grid-cols-2">
            {stations.map((s) => {
              const ns = snap?.nodes[s.id];
              return (
                <div key={s.id} className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--canvas)] px-3 py-2">
                  <div className="flex gap-1">
                    {ns?.servers?.map((st, i) => (
                      <span key={i} className="h-3 w-3 rounded-full" style={{ background: SERVER_COLORS[st] }} title={st} />
                    ))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-medium">
                      {s.name} {ns?.bottleneck && <span className="text-[#e66767]">▲</span>}
                    </div>
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[#2c2c2a]">
                      <div className="h-full bg-[#0ca30c]" style={{ width: `${(ns?.utilization ?? 0) * 100}%` }} />
                    </div>
                  </div>
                  <div className="tabular w-12 text-right text-[12px] text-[var(--ink-2)]">{pct(ns?.utilization ?? 0)}</div>
                </div>
              );
            })}
          </div>
        </Card>
        <Card title="Trend" subtitle="Genomflöde (st/h, 5-min intervall) och PIA">
          {series.length < 2 ? (
            <div className="grid h-[220px] place-items-center text-[13px] text-[var(--muted)]">Starta simuleringen för att se trenden</div>
          ) : (
            <div className="grid gap-2">
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={series} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="h" type="number" domain={["dataMin", "dataMax"]} hide />
                  <YAxis width={36} stroke={CHART.axis} tick={{ fill: CHART.muted, fontSize: 10 }} />
                  <Tooltip {...tooltipStyle} labelFormatter={(v) => clock(+v * 3600)} formatter={(v: number) => [`${n1(v)} st/h`, "Genomflöde"]} />
                  <Line dataKey="rate" stroke={SERIES[0]} strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
              <ResponsiveContainer width="100%" height={110}>
                <LineChart data={series} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="h" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(v) => `${n1(v)} h`} stroke={CHART.axis} tick={{ fill: CHART.muted, fontSize: 10 }} />
                  <YAxis width={36} stroke={CHART.axis} tick={{ fill: CHART.muted, fontSize: 10 }} />
                  <Tooltip {...tooltipStyle} labelFormatter={(v) => clock(+v * 3600)} formatter={(v: number) => [`${v} st`, "PIA"]} />
                  <Line dataKey="wip" type="stepAfter" stroke={SERIES[1]} strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
