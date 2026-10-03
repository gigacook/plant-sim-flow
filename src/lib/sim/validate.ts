// Validation of untrusted models (imported files, shared links). Returns a cleaned model or throws.
import type { Model, ModelNode, NodeKind } from "./types.ts";

const KINDS: NodeKind[] = ["source", "buffer", "station", "assembly", "sink"];
const MAX_NODES = 200;

export class ModelError extends Error {}

const num = (v: unknown, fallback: number, min = 0, max = 1e9) =>
  typeof v === "number" && isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
const str = (v: unknown, fallback: string, maxLen = 80) => (typeof v === "string" && v.trim() ? v.slice(0, maxLen) : fallback);

function dist(v: unknown): ModelNode["processTime"] | undefined {
  if (!v || typeof v !== "object") return undefined;
  const d = v as Record<string, unknown>;
  switch (d.type) {
    case "const": return { type: "const", value: num(d.value, 60) };
    case "exp": return { type: "exp", mean: num(d.mean, 60) };
    case "normal": return { type: "normal", mean: num(d.mean, 60), sd: num(d.sd, 0) };
    case "uniform": { const a = num(d.min, 50), b = num(d.max, 70); return { type: "uniform", min: Math.min(a, b), max: Math.max(a, b) }; }
    case "tri": { const [a, c, b] = [num(d.min, 50), num(d.mode, 60), num(d.max, 70)].sort((x, y) => x - y); return { type: "tri", min: a, mode: c, max: b }; }
    default: return undefined;
  }
}

export function validateModel(input: unknown): Model {
  if (!input || typeof input !== "object") throw new ModelError("Filen innehåller ingen modell.");
  const m = input as Record<string, unknown>;
  if (!Array.isArray(m.nodes) || !Array.isArray(m.edges)) throw new ModelError("Modellen saknar noder eller kopplingar.");
  if (m.nodes.length > MAX_NODES) throw new ModelError(`Modellen har fler än ${MAX_NODES} noder.`);
  const lines = (Array.isArray(m.lines) ? m.lines : []).slice(0, 20).map((l, i) => {
    const o = (l ?? {}) as Record<string, unknown>;
    return { id: str(o.id, `L${i + 1}`, 40), name: str(o.name, `Linje ${i + 1}`), color: typeof o.color === "string" && /^#[0-9a-f]{3,8}$/i.test(o.color) ? o.color : "#3987e5" };
  });
  if (lines.length === 0) lines.push({ id: "L1", name: "Linje 1", color: "#3987e5" });
  const ids = new Set<string>();
  const nodes: ModelNode[] = m.nodes.map((n, i) => {
    const o = (n ?? {}) as Record<string, unknown>;
    if (!KINDS.includes(o.kind as NodeKind)) throw new ModelError(`Nod ${i + 1} har okänd typ.`);
    let id = str(o.id, `n${i}`, 40);
    while (ids.has(id)) id += "_";
    ids.add(id);
    const node: ModelNode = {
      id, name: str(o.name, id), kind: o.kind as NodeKind,
      lineId: lines.some((l) => l.id === o.lineId) ? (o.lineId as string) : lines[0].id,
      x: num(o.x, 100 + i * 140, -1e5, 1e5), y: num(o.y, 200, -1e5, 1e5),
    };
    if (node.kind === "source") { node.interarrival = dist(o.interarrival) ?? { type: "exp", mean: 60 }; node.limit = Math.round(num(o.limit, 0)); }
    if (node.kind === "buffer") { node.capacity = Math.round(num(o.capacity, 5, 1, 100000)); node.transitTime = num(o.transitTime, 0); }
    if (node.kind === "station" || node.kind === "assembly") {
      node.processTime = dist(o.processTime) ?? { type: "const", value: 60 };
      node.servers = Math.round(num(o.servers, 1, 1, 50));
      node.mtbf = num(o.mtbf, 0); node.mttr = num(o.mttr, 0); node.scrapRate = num(o.scrapRate, 0, 0, 1);
    }
    if (["roundRobin", "shortestQueue", "first", "random"].includes(o.routing as string)) node.routing = o.routing as ModelNode["routing"];
    return node;
  });
  const edges = m.edges
    .map((e, i) => { const o = (e ?? {}) as Record<string, unknown>; return { id: str(o.id, `e${i}`, 40), from: String(o.from), to: String(o.to) }; })
    .filter((e) => ids.has(e.from) && ids.has(e.to) && e.from !== e.to);
  return { name: str(m.name, "Importerad modell"), lines, nodes, edges };
}
