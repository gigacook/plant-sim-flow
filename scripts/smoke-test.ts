import { simulate } from "../src/lib/sim/engine.ts";
import { PRESETS, DEFAULT_RUN } from "../src/lib/sim/presets.ts";
import { replicate } from "../src/lib/sim/analysis.ts";
import type { Model } from "../src/lib/sim/types.ts";

let failed = false;
for (const p of PRESETS) {
  const t0 = Date.now();
  const r = simulate(p.model, DEFAULT_RUN);
  const ms = Date.now() - t0;
  console.log(
    `${p.label.padEnd(24)} ut=${r.totalOutput} tp=${r.throughputPerHour.toFixed(1)}/h wip=${r.avgWip.toFixed(1)} lt=${(r.avgLeadTime / 60).toFixed(1)}min little=${(r.littleLeadTime / 60).toFixed(1)}min flaskhals=${r.bottleneckId} events=${r.events} ${ms}ms`,
  );
  for (const s of r.stations) {
    const sum = s.working + s.waiting + s.blocked + s.failed;
    if (Math.abs(sum - 1) > 1e-6) { console.error("tillståndsandelar summerar ej till 1", s); failed = true; }
  }
  const sinkSum = r.sinks.reduce((a, s) => a + s.count, 0);
  if (sinkSum !== r.totalOutput) { console.error("utloppsräkning != totalOutput", sinkSum, r.totalOutput); failed = true; }
  if (r.totalOutput <= 0) { console.error("ingen produktion", p.id); failed = true; }
  const rep = replicate(p.model, DEFAULT_RUN, 5);
  console.log(`   5 repl: tp=${rep.throughput.mean.toFixed(1)} ± ${rep.throughput.ci.toFixed(1)}`);
}
// --- Regression: models that previously hung must terminate (event budget + min cycle time) ---
{
  const L = [{ id: "L", name: "L", color: "#000" }];
  const zero = { name: "z", lines: L, nodes: [
    { id: "s", name: "s", kind: "source", lineId: "L", x: 0, y: 0, interarrival: { type: "const", value: 0 } },
    { id: "m", name: "m", kind: "station", lineId: "L", x: 0, y: 0, processTime: { type: "const", value: 0 } },
    { id: "k", name: "k", kind: "sink", lineId: "L", x: 0, y: 0 }],
    edges: [{ id: "a", from: "s", to: "m" }, { id: "b", from: "m", to: "k" }] } as Model;
  const r = simulate(zero, { duration: 3600, warmup: 0, seed: 1, sampleInterval: 600 });
  console.log(`Nollcykeltid: avslutad, truncated=${r.truncated}`);
}

// --- Validation against queueing theory / deterministic cases ---
{
  const L = [{ id: "L", name: "L", color: "#000" }];
  const det = { name: "det", lines: L, nodes: [
    { id: "s", name: "s", kind: "source", lineId: "L", x: 0, y: 0, interarrival: { type: "const", value: 0 } },
    { id: "a", name: "a", kind: "station", lineId: "L", x: 0, y: 0, processTime: { type: "const", value: 30 } },
    { id: "b", name: "b", kind: "station", lineId: "L", x: 0, y: 0, processTime: { type: "const", value: 45 } },
    { id: "c", name: "c", kind: "station", lineId: "L", x: 0, y: 0, processTime: { type: "const", value: 40 } },
    { id: "k", name: "k", kind: "sink", lineId: "L", x: 0, y: 0 }],
    edges: [{ id: "1", from: "s", to: "a" }, { id: "2", from: "a", to: "b" }, { id: "3", from: "b", to: "c" }, { id: "4", from: "c", to: "k" }] } as Model;
  const d = simulate(det, { duration: 10 * 3600, warmup: 3600, seed: 1, sampleInterval: 3600 });
  const near = (x: number, y: number, tol: number) => Math.abs(x - y) <= tol;
  if (!near(d.throughputPerHour, 80, 0.05) || !near(d.stations[0].blocked, 1 / 3, 0.002) || !near(d.stations[2].waiting, 1 / 9, 0.002) || d.bottleneckId !== "b") {
    console.error("Deterministisk linje avviker från teorin", d.throughputPerHour, d.stations[0].blocked, d.stations[2].waiting, d.bottleneckId);
    failed = true;
  } else console.log("Deterministisk linje: 80/h, blockering 1/3, svält 1/9 – OK");
  const mm1 = { name: "mm1", lines: L, nodes: [
    { id: "s", name: "s", kind: "source", lineId: "L", x: 0, y: 0, interarrival: { type: "exp", mean: 60 } },
    { id: "q", name: "q", kind: "buffer", lineId: "L", x: 0, y: 0, capacity: 100000 },
    { id: "m", name: "m", kind: "station", lineId: "L", x: 0, y: 0, processTime: { type: "exp", mean: 48 } },
    { id: "k", name: "k", kind: "sink", lineId: "L", x: 0, y: 0 }],
    edges: [{ id: "a", from: "s", to: "q" }, { id: "b", from: "q", to: "m" }, { id: "c", from: "m", to: "k" }] } as Model;
  const q = replicate(mm1, { duration: 400 * 3600, warmup: 20 * 3600, seed: 11, sampleInterval: 3600 }, 10);
  // Teori: W = 240 s. Tolerans: konfidensintervallet + 5 %.
  if (Math.abs(q.leadTime.mean - 240) > q.leadTime.ci + 12) {
    console.error("M/M/1 avviker från teorin", q.leadTime.mean, q.leadTime.ci);
    failed = true;
  } else console.log(`M/M/1: W = ${q.leadTime.mean.toFixed(1)} ± ${q.leadTime.ci.toFixed(1)} s (teori 240) – OK`);
}

if (failed) process.exit(1);
console.log("OK");
