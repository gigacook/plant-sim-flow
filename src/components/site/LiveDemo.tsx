"use client";
// A real, running simulation of exercise 1 for the product page (no recorded video, no fake numbers).
import { useEffect, useRef, useState } from "react";
import FactoryCanvas, { type Token } from "@/components/FactoryCanvas";
import { Simulation, type Snapshot } from "@/lib/sim/engine";
import { EXERCISES } from "@/lib/sim/exercises";
import { clock, n0, n1 } from "@/lib/format";
import { SERVER_COLORS } from "@/lib/colors";

// Same model as exercise 1; only the drawing coordinates are tightened for the page width.
const MODEL = { ...EXERCISES[0].model, nodes: EXERCISES[0].model.nodes.map((n) => ({ ...n, x: Math.round(60 + (n.x - 60) * 0.78) })) };
const SPEED = 40;
const TOKEN_MS = 650;
/** Skip the start-up transient so the momentary bottleneck shown is the steady-state one. */
const WARMUP = 1800;

export default function LiveDemo() {
  const simRef = useRef<Simulation | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [playing, setPlaying] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sim = new Simulation(MODEL, { duration: 4 * 3600, warmup: 0, seed: 7, sampleInterval: 3600 });
    sim.trackMoves = true;
    sim.advanceTo(WARMUP);
    sim.moves = [];
    simRef.current = sim;
    setSnap(sim.snapshot());
    setPlaying(!reduce);
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    if (boxRef.current) io.observe(boxRef.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!playing || !visible) return;
    let raf = 0;
    let last = performance.now();
    let seq = 0;
    let buf: { key: string; edge: string; born: number }[] = [];
    const loop = (now: number) => {
      let sim = simRef.current!;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (sim.done) {
        sim = new Simulation(MODEL, { duration: 4 * 3600, warmup: 0, seed: 7 + Math.floor(Math.random() * 1000), sampleInterval: 3600 });
        sim.advanceTo(WARMUP);
        sim.trackMoves = true;
        simRef.current = sim;
      }
      sim.advanceTo(sim.t + dt * SPEED);
      for (const m of sim.moves.slice(-30)) buf.push({ key: `${seq++}`, edge: m.edge, born: now });
      sim.moves = [];
      buf = buf.filter((t) => now - t.born < TOKEN_MS);
      setTokens(buf.map((t) => ({ key: t.key, edge: t.edge, progress: (now - t.born) / TOKEN_MS })));
      setSnap(sim.snapshot());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, visible]);

  const tp = snap && snap.t > 0 ? (snap.output * 3600) / snap.t : 0;
  const bn = MODEL.nodes.find((n) => snap?.nodes[n.id]?.bottleneck);

  return (
    <div ref={boxRef} className="app-theme overflow-hidden rounded-xl border border-[#2c2c2a]" style={{ minHeight: 0 }}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2c2c2a] px-4 py-2.5 text-[12.5px] text-[var(--ink-2)]">
        <span className="font-semibold text-white">Övning 1 · körs live i din webbläsare</span>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 tabular">
          <span>{clock(snap?.t ?? 0)}</span>
          <span>{n0(snap?.output ?? 0)} st klara</span>
          <span>{n1(tp)} st/h</span>
          <span className="text-[#f0a3a3]">Flaskhals: {bn?.name ?? "–"}</span>
          <button className="rounded border border-[#383835] px-2 py-0.5 text-white hover:bg-[#2c2c2a]" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pausa demo" : "Spela demo"}>
            {playing ? "❚❚" : "▶"}
          </button>
        </div>
      </div>
      <div className="px-2 py-2">
        <FactoryCanvas model={MODEL} snapshot={snap} tokens={tokens} autoHeight />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-[#2c2c2a] px-4 py-2 text-[11.5px] text-[var(--ink-2)]">
        {(
          [
            ["busy", "Arbetar"],
            ["idle", "Väntar"],
            ["blocked", "Blockerad"],
            ["failed", "Stopp"],
          ] as const
        ).map(([k, l]) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: SERVER_COLORS[k] }} />
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}
