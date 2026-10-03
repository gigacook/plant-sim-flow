// Optimering av buffertstorlekar och maskinantal med simulerad glödgning (simulated annealing)
// och gemensamma slumptal (CRN) så att olika konfigurationer jämförs rättvist.

import { replicate } from "./analysis.ts";
import { Rng } from "./random.ts";
import { clone } from "./presets.ts";
import type { Model, RunConfig } from "./types.ts";

export interface OptVar {
  nodeId: string;
  kind: "capacity" | "servers";
  min: number;
  max: number;
}

export interface OptSpec {
  vars: OptVar[];
  /** Täckningsbidrag per färdig detalj (kr). */
  marginPerPart: number;
  /** Kostnad per buffertplats och timme (kr). */
  bufferCostPerHour: number;
  /** Kostnad per maskin och timme (kr). */
  machineCostPerHour: number;
  /** Krav på minsta genomflöde (st/h, 0 = inget krav). */
  minThroughput: number;
  iterations: number;
  reps: number;
  seed: number;
}

export interface Evaluation {
  key: string;
  values: number[];
  throughput: number;
  throughputCi: number;
  leadTime: number;
  wip: number;
  cost: number;
  profit: number;
  feasible: boolean;
}

export interface OptProgress {
  iteration: number;
  total: number;
  current: Evaluation;
  best: Evaluation;
  temperature: number;
}

export interface OptResult {
  baseline: Evaluation;
  best: Evaluation;
  history: { iteration: number; current: number; best: number; temperature: number }[];
  evaluations: Evaluation[];
}

export function applyVars(model: Model, vars: OptVar[], values: number[]): Model {
  const m = clone(model);
  vars.forEach((v, i) => {
    const n = m.nodes.find((x) => x.id === v.nodeId);
    if (!n) return;
    if (v.kind === "capacity") n.capacity = values[i];
    else n.servers = values[i];
  });
  return m;
}

export function currentValues(model: Model, vars: OptVar[]): number[] {
  return vars.map((v) => {
    const n = model.nodes.find((x) => x.id === v.nodeId);
    const cur = v.kind === "capacity" ? n?.capacity ?? v.min : n?.servers ?? v.min;
    return Math.min(v.max, Math.max(v.min, cur));
  });
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

export async function optimize(
  model: Model,
  cfg: RunConfig,
  spec: OptSpec,
  onProgress?: (p: OptProgress) => void,
  shouldStop?: () => boolean,
): Promise<OptResult> {
  const rng = new Rng(spec.seed);
  const cache = new Map<string, Evaluation>();
  const evaluations: Evaluation[] = [];

  // Fasta kostnader för noder som inte är beslutsvariabler räknas också in.
  const evaluate = (values: number[]): Evaluation => {
    const key = values.join(",");
    const hit = cache.get(key);
    if (hit) return hit;
    const m = applyVars(model, spec.vars, values);
    const s = replicate(m, cfg, spec.reps);
    let bufferSlots = 0;
    let machines = 0;
    for (const n of m.nodes) {
      if (n.kind === "buffer") bufferSlots += n.capacity ?? 1;
      if (n.kind === "station" || n.kind === "assembly") machines += n.servers ?? 1;
    }
    const cost = bufferSlots * spec.bufferCostPerHour + machines * spec.machineCostPerHour;
    const feasible = spec.minThroughput <= 0 || s.throughput.mean >= spec.minThroughput;
    const shortfall = Math.max(0, spec.minThroughput - s.throughput.mean);
    const profit = s.throughput.mean * spec.marginPerPart - cost - (feasible ? 0 : shortfall * spec.marginPerPart * 5);
    const ev: Evaluation = {
      key,
      values: [...values],
      throughput: s.throughput.mean,
      throughputCi: s.throughput.ci,
      leadTime: s.leadTime.mean,
      wip: s.wip.mean,
      cost,
      profit,
      feasible,
    };
    cache.set(key, ev);
    evaluations.push(ev);
    return ev;
  };

  let cur = evaluate(currentValues(model, spec.vars));
  const baseline = cur;
  let best = cur;
  const history: OptResult["history"] = [{ iteration: 0, current: cur.profit, best: best.profit, temperature: 0 }];
  const T0 = Math.max(1, Math.abs(cur.profit) * 0.05);

  for (let it = 1; it <= spec.iterations; it++) {
    if (shouldStop?.()) break;
    const temperature = T0 * Math.pow(0.01, it / spec.iterations);
    // Granne: ändra 1–2 variabler ett eller några steg
    const next = [...cur.values];
    const changes = rng.next() < 0.3 && spec.vars.length > 1 ? 2 : 1;
    for (let c = 0; c < changes; c++) {
      const i = Math.floor(rng.next() * spec.vars.length);
      const v = spec.vars[i];
      const span = v.max - v.min;
      const step = Math.max(1, Math.round(rng.next() * Math.max(1, span / 4)));
      next[i] = Math.min(v.max, Math.max(v.min, next[i] + (rng.next() < 0.5 ? -step : step)));
    }
    const cand = evaluate(next);
    const delta = cand.profit - cur.profit;
    if (delta >= 0 || rng.next() < Math.exp(delta / temperature)) cur = cand;
    if (cand.profit > best.profit) best = cand;
    history.push({ iteration: it, current: cur.profit, best: best.profit, temperature });
    onProgress?.({ iteration: it, total: spec.iterations, current: cand, best, temperature });
    await tick();
  }

  return { baseline, best, history, evaluations };
}
