import { simulate } from "./engine.ts";
import { scaleDist } from "./random.ts";
import { clone } from "./presets.ts";
import type { Model, RunConfig, RunResult } from "./types.ts";

export interface Stat {
  mean: number;
  sd: number;
  ci: number;
  min: number;
  max: number;
}

// t-kvantiler (95 %, tvåsidig) för små stickprov
const T95 = [0, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086];

export function stat(xs: number[]): Stat {
  const n = xs.length;
  if (n === 0) return { mean: 0, sd: 0, ci: 0, min: 0, max: 0 };
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  const t = n - 1 < T95.length ? T95[n - 1] : 1.96;
  return { mean, sd, ci: n > 1 ? (t * sd) / Math.sqrt(n) : 0, min: Math.min(...xs), max: Math.max(...xs) };
}

export interface ReplicationSummary {
  runs: RunResult[];
  throughput: Stat;
  leadTime: Stat;
  wip: Stat;
  oee: Stat;
}

export function summarize(runs: RunResult[]): ReplicationSummary {
  return {
    runs,
    throughput: stat(runs.map((r) => r.throughputPerHour)),
    leadTime: stat(runs.map((r) => r.avgLeadTime)),
    wip: stat(runs.map((r) => r.avgWip)),
    oee: stat(runs.map((r) => r.oee)),
  };
}

export function replicate(model: Model, cfg: RunConfig, reps: number): ReplicationSummary {
  const runs: RunResult[] = [];
  for (let i = 0; i < reps; i++) runs.push(simulate(model, { ...cfg, seed: cfg.seed + i * 1013 }));
  return summarize(runs);
}

// ---------- Parameterstudie ----------

export type ParamKind = "capacity" | "servers" | "processScale" | "interarrivalScale" | "mtbf" | "mttr";

export interface Param {
  kind: ParamKind;
  nodeId: string;
}

export const PARAM_LABELS: Record<ParamKind, string> = {
  capacity: "Buffertkapacitet",
  servers: "Antal maskiner",
  processScale: "Cykeltid (faktor)",
  interarrivalScale: "Ankomstintervall (faktor)",
  mtbf: "MTBF (min)",
  mttr: "MTTR (min)",
};

export function applyParam(model: Model, p: Param, value: number): Model {
  const m = clone(model);
  const n = m.nodes.find((x) => x.id === p.nodeId);
  if (!n) return m;
  switch (p.kind) {
    case "capacity":
      n.capacity = Math.max(1, Math.round(value));
      break;
    case "servers":
      n.servers = Math.max(1, Math.round(value));
      break;
    case "processScale":
      if (n.processTime) n.processTime = scaleDist(n.processTime, value);
      break;
    case "interarrivalScale":
      if (n.interarrival) n.interarrival = scaleDist(n.interarrival, value);
      break;
    case "mtbf":
      n.mtbf = value * 60;
      break;
    case "mttr":
      n.mttr = value * 60;
      break;
  }
  return m;
}

export interface SweepPoint {
  value: number;
  throughput: Stat;
  leadTime: Stat;
  wip: Stat;
  oee: Stat;
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

export async function sweep(
  model: Model,
  cfg: RunConfig,
  param: Param,
  values: number[],
  reps: number,
  onProgress?: (done: number, total: number, point: SweepPoint) => void,
): Promise<SweepPoint[]> {
  const out: SweepPoint[] = [];
  for (let i = 0; i < values.length; i++) {
    const s = replicate(applyParam(model, param, values[i]), cfg, reps);
    const pt = { value: values[i], throughput: s.throughput, leadTime: s.leadTime, wip: s.wip, oee: s.oee };
    out.push(pt);
    onProgress?.(i + 1, values.length, pt);
    await tick();
  }
  return out;
}

/** Medelvärdesbilda flera replikeringar till ett resultat (tidsserie och histogram från första körningen). */
export function averageRuns(runs: RunResult[]): RunResult {
  const n = runs.length;
  const first = runs[0];
  const avgObj = <T extends object>(items: T[][], idx: number): T => {
    const base = { ...items[0][idx] } as Record<string, unknown>;
    for (const k of Object.keys(base)) {
      if (typeof base[k] === "number") base[k] = items.reduce((a, arr) => a + ((arr[idx] as Record<string, number>)[k] ?? 0), 0) / n;
    }
    return base as T;
  };
  const edgeFlow: Record<string, number> = {};
  for (const k of Object.keys(first.edgeFlow)) edgeFlow[k] = runs.reduce((a, r) => a + r.edgeFlow[k], 0) / n;
  const mean = (f: (r: RunResult) => number) => runs.reduce((a, r) => a + f(r), 0) / n;
  const stations = first.stations.map((_, i) => avgObj(runs.map((r) => r.stations), i));
  let bn: string | null = null;
  let best = -1;
  for (const s of stations) if (s.bottleneckShare > best) ((best = s.bottleneckShare), (bn = s.id));
  return {
    ...first,
    throughputPerHour: mean((r) => r.throughputPerHour),
    totalOutput: mean((r) => r.totalOutput),
    totalScrap: mean((r) => r.totalScrap),
    avgWip: mean((r) => r.avgWip),
    avgLeadTime: mean((r) => r.avgLeadTime),
    p50LeadTime: mean((r) => r.p50LeadTime),
    p95LeadTime: mean((r) => r.p95LeadTime),
    littleLeadTime: mean((r) => r.littleLeadTime),
    oee: stations.find((s) => s.id === bn)?.oee ?? 0,
    bottleneckId: bn,
    stations,
    buffers: first.buffers.map((_, i) => avgObj(runs.map((r) => r.buffers), i)),
    sources: first.sources.map((_, i) => avgObj(runs.map((r) => r.sources), i)),
    sinks: first.sinks.map((_, i) => avgObj(runs.map((r) => r.sinks), i)),
    edgeFlow,
    truncated: runs.some((r) => r.truncated),
  };
}

export interface Insight {
  level: "critical" | "warning" | "info" | "good";
  title: string;
  text: string;
}

/** Regelbaserade förbättringsförslag utifrån ett simuleringsresultat. */
export function insights(model: Model, r: RunResult): Insight[] {
  const out: Insight[] = [];
  const name = (id: string) => model.nodes.find((n) => n.id === id)?.name ?? id;
  const pct = (x: number) => `${Math.round(x * 100)} %`;
  if (r.bottleneckId) {
    const s = r.stations.find((x) => x.id === r.bottleneckId)!;
    out.push({
      level: "critical",
      title: `Flaskhals: ${s.name}`,
      text: `Stationen är aktiv längst i ${pct(s.bottleneckShare)} av tiden (arbetar ${pct(s.working)}, stopp ${pct(s.failed)}). Förbättringar här ger störst effekt på genomflödet – kortare cykeltid, fler maskiner eller bättre tillgänglighet (MTBF/MTTR).`,
    });
    if (s.failed > 0.05)
      out.push({ level: "warning", title: `Tillgänglighet i ${s.name}`, text: `Stopp står för ${pct(s.failed)} av tiden i flaskhalsen. Förebyggande underhåll eller snabbare reparation (lägre MTTR) lyfter hela linjen.` });
  }
  for (const s of r.stations) {
    if (s.id === r.bottleneckId) continue;
    if (s.blocked > 0.15) {
      const outEdges = model.edges.filter((e) => e.from === s.id).map((e) => name(e.to));
      out.push({ level: "warning", title: `${s.name} blockeras ${pct(s.blocked)}`, text: `Nedströms (${outEdges.join(", ")}) tar inte emot i takt. Överväg större buffert efter stationen eller att avlasta nästa steg.` });
    }
    if (s.waiting > 0.45) out.push({ level: "info", title: `${s.name} svälter ${pct(s.waiting)}`, text: `Stationen väntar ofta på material – den har överkapacitet. Möjligt att dela resurser eller minska antalet maskiner.` });
  }
  for (const b of r.buffers) {
    if (b.fullShare > 0.4) out.push({ level: "info", title: `${b.name} ofta full (${pct(b.fullShare)})`, text: `Bufferten är full en stor del av tiden – den skyddar troligen inte flödet. Åtgärda orsaken nedströms snarare än att öka kapaciteten.` });
  }
  for (const s of r.sources) {
    if (s.blockedShare > 0.3) out.push({ level: "info", title: `${s.name} hålls tillbaka ${pct(s.blockedShare)}`, text: `Inflödet är större än vad linjen klarar – systemet är kapacitetsbegränsat, inte efterfrågebegränsat.` });
  }
  if (!out.some((x) => x.level !== "info")) out.push({ level: "good", title: "Balanserat flöde", text: "Inga tydliga blockeringar eller stopp-problem upptäcktes." });
  return out;
}
