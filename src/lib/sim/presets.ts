import type { Model, RunConfig } from "./types.ts";

export const LINE_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#9085e9"];

export const DEFAULT_RUN: RunConfig = {
  duration: 8 * 3600,
  warmup: 3600,
  seed: 42,
  sampleInterval: 600,
};

const singleLine: Model = {
  name: "Enkel linje – bearbetning",
  lines: [{ id: "L1", name: "Linje 1", color: LINE_COLORS[0] }],
  nodes: [
    { id: "src", name: "Inleverans", kind: "source", lineId: "L1", x: 60, y: 220, interarrival: { type: "exp", mean: 52 }, routing: "roundRobin" },
    { id: "b0", name: "Ingångslager", kind: "buffer", lineId: "L1", x: 200, y: 220, capacity: 20, transitTime: 0 },
    { id: "op10", name: "OP10 Svarvning", kind: "station", lineId: "L1", x: 340, y: 220, servers: 1, processTime: { type: "tri", min: 38, mode: 44, max: 55 }, mtbf: 4 * 3600, mttr: 8 * 60, scrapRate: 0 },
    { id: "b1", name: "Transportör 1", kind: "buffer", lineId: "L1", x: 480, y: 220, capacity: 5, transitTime: 20 },
    { id: "op20", name: "OP20 Fräsning", kind: "station", lineId: "L1", x: 620, y: 220, servers: 1, processTime: { type: "normal", mean: 47, sd: 4 }, mtbf: 2 * 3600, mttr: 10 * 60, scrapRate: 0.01 },
    { id: "b2", name: "Transportör 2", kind: "buffer", lineId: "L1", x: 760, y: 220, capacity: 5, transitTime: 20 },
    { id: "op30", name: "OP30 Slipning", kind: "station", lineId: "L1", x: 900, y: 220, servers: 1, processTime: { type: "tri", min: 36, mode: 42, max: 50 }, mtbf: 6 * 3600, mttr: 6 * 60, scrapRate: 0.005 },
    { id: "sink", name: "Färdigvarulager", kind: "sink", lineId: "L1", x: 1040, y: 220 },
  ],
  edges: [
    { id: "e1", from: "src", to: "b0" },
    { id: "e2", from: "b0", to: "op10" },
    { id: "e3", from: "op10", to: "b1" },
    { id: "e4", from: "b1", to: "op20" },
    { id: "e5", from: "op20", to: "b2" },
    { id: "e6", from: "b2", to: "op30" },
    { id: "e7", from: "op30", to: "sink" },
  ],
};

const twoLines: Model = {
  name: "Två linjer + gemensam packning",
  lines: [
    { id: "LA", name: "Linje A", color: LINE_COLORS[0] },
    { id: "LB", name: "Linje B", color: LINE_COLORS[1] },
    { id: "LP", name: "Packning", color: LINE_COLORS[2] },
  ],
  nodes: [
    { id: "srcA", name: "Råmaterial A", kind: "source", lineId: "LA", x: 60, y: 110, interarrival: { type: "exp", mean: 70 } },
    { id: "a0", name: "Lager A", kind: "buffer", lineId: "LA", x: 180, y: 110, capacity: 15 },
    { id: "a10", name: "A10 Stansning", kind: "station", lineId: "LA", x: 300, y: 110, servers: 1, processTime: { type: "tri", min: 50, mode: 58, max: 70 }, mtbf: 3 * 3600, mttr: 12 * 60 },
    { id: "a1", name: "Buffert A1", kind: "buffer", lineId: "LA", x: 420, y: 110, capacity: 4, transitTime: 15 },
    { id: "a20", name: "A20 Bockning", kind: "station", lineId: "LA", x: 540, y: 110, servers: 1, processTime: { type: "normal", mean: 62, sd: 6 }, mtbf: 2.5 * 3600, mttr: 9 * 60, scrapRate: 0.01 },
    { id: "a2", name: "Buffert A2", kind: "buffer", lineId: "LA", x: 660, y: 110, capacity: 4, transitTime: 15 },
    { id: "a30", name: "A30 Svetsning", kind: "station", lineId: "LA", x: 780, y: 110, servers: 1, processTime: { type: "tri", min: 48, mode: 55, max: 66 } },

    { id: "srcB", name: "Råmaterial B", kind: "source", lineId: "LB", x: 60, y: 350, interarrival: { type: "exp", mean: 80 } },
    { id: "bb0", name: "Lager B", kind: "buffer", lineId: "LB", x: 180, y: 350, capacity: 15 },
    { id: "b10", name: "B10 Laserskärning", kind: "station", lineId: "LB", x: 300, y: 350, servers: 1, processTime: { type: "tri", min: 55, mode: 66, max: 80 }, mtbf: 5 * 3600, mttr: 15 * 60 },
    { id: "bb1", name: "Buffert B1", kind: "buffer", lineId: "LB", x: 420, y: 350, capacity: 3, transitTime: 15 },
    { id: "b20", name: "B20 Lackering", kind: "station", lineId: "LB", x: 540, y: 350, servers: 2, processTime: { type: "normal", mean: 130, sd: 10 }, mtbf: 4 * 3600, mttr: 20 * 60, scrapRate: 0.02 },
    { id: "bb2", name: "Buffert B2", kind: "buffer", lineId: "LB", x: 660, y: 350, capacity: 3, transitTime: 15 },
    { id: "b30", name: "B30 Kontroll", kind: "station", lineId: "LB", x: 780, y: 350, servers: 1, processTime: { type: "tri", min: 50, mode: 60, max: 72 } },

    { id: "pk0", name: "Packbuffert", kind: "buffer", lineId: "LP", x: 900, y: 230, capacity: 8, transitTime: 30 },
    { id: "pk", name: "P10 Packning", kind: "station", lineId: "LP", x: 1020, y: 230, servers: 1, processTime: { type: "tri", min: 26, mode: 30, max: 38 }, mtbf: 8 * 3600, mttr: 5 * 60 },
    { id: "sink", name: "Utleverans", kind: "sink", lineId: "LP", x: 1140, y: 230 },
  ],
  edges: [
    { id: "ea1", from: "srcA", to: "a0" },
    { id: "ea2", from: "a0", to: "a10" },
    { id: "ea3", from: "a10", to: "a1" },
    { id: "ea4", from: "a1", to: "a20" },
    { id: "ea5", from: "a20", to: "a2" },
    { id: "ea6", from: "a2", to: "a30" },
    { id: "ea7", from: "a30", to: "pk0" },
    { id: "eb1", from: "srcB", to: "bb0" },
    { id: "eb2", from: "bb0", to: "b10" },
    { id: "eb3", from: "b10", to: "bb1" },
    { id: "eb4", from: "bb1", to: "b20" },
    { id: "eb5", from: "b20", to: "bb2" },
    { id: "eb6", from: "bb2", to: "b30" },
    { id: "eb7", from: "b30", to: "pk0" },
    { id: "ep1", from: "pk0", to: "pk" },
    { id: "ep2", from: "pk", to: "sink" },
  ],
};

const assembly: Model = {
  name: "Montering – två förmonteringslinjer",
  lines: [
    { id: "LC", name: "Chassi", color: LINE_COLORS[0] },
    { id: "LM", name: "Motor", color: LINE_COLORS[1] },
    { id: "LF", name: "Slutmontering", color: LINE_COLORS[2] },
  ],
  nodes: [
    { id: "srcC", name: "Chassiämnen", kind: "source", lineId: "LC", x: 60, y: 110, interarrival: { type: "const", value: 0 } },
    { id: "c10", name: "C10 Svets", kind: "station", lineId: "LC", x: 200, y: 110, servers: 1, processTime: { type: "tri", min: 70, mode: 80, max: 95 }, mtbf: 3 * 3600, mttr: 10 * 60 },
    { id: "cb1", name: "Buffert C", kind: "buffer", lineId: "LC", x: 340, y: 110, capacity: 4, transitTime: 10 },
    { id: "c20", name: "C20 Ytbehandling", kind: "station", lineId: "LC", x: 480, y: 110, servers: 2, processTime: { type: "normal", mean: 150, sd: 12 }, mtbf: 5 * 3600, mttr: 15 * 60 },
    { id: "cb2", name: "Chassi-kö", kind: "buffer", lineId: "LC", x: 620, y: 110, capacity: 6, transitTime: 40 },

    { id: "srcM", name: "Motordelar", kind: "source", lineId: "LM", x: 60, y: 350, interarrival: { type: "const", value: 0 } },
    { id: "m10", name: "M10 Förmontering", kind: "station", lineId: "LM", x: 200, y: 350, servers: 1, processTime: { type: "tri", min: 65, mode: 75, max: 90 }, mtbf: 4 * 3600, mttr: 8 * 60 },
    { id: "mb1", name: "Buffert M", kind: "buffer", lineId: "LM", x: 340, y: 350, capacity: 4, transitTime: 10 },
    { id: "m20", name: "M20 Provkörning", kind: "station", lineId: "LM", x: 480, y: 350, servers: 1, processTime: { type: "normal", mean: 78, sd: 8 }, mtbf: 2 * 3600, mttr: 12 * 60, scrapRate: 0.02 },
    { id: "mb2", name: "Motor-kö", kind: "buffer", lineId: "LM", x: 620, y: 350, capacity: 6, transitTime: 40 },

    { id: "f10", name: "F10 Giftermål", kind: "assembly", lineId: "LF", x: 760, y: 230, servers: 1, processTime: { type: "tri", min: 66, mode: 74, max: 88 }, mtbf: 6 * 3600, mttr: 10 * 60 },
    { id: "fb1", name: "Buffert F", kind: "buffer", lineId: "LF", x: 880, y: 230, capacity: 3, transitTime: 10 },
    { id: "f20", name: "F20 Slutkontroll", kind: "station", lineId: "LF", x: 1000, y: 230, servers: 1, processTime: { type: "tri", min: 60, mode: 68, max: 80 }, scrapRate: 0.01 },
    { id: "sink", name: "Leverans", kind: "sink", lineId: "LF", x: 1120, y: 230 },
  ],
  edges: [
    { id: "c1", from: "srcC", to: "c10" },
    { id: "c2", from: "c10", to: "cb1" },
    { id: "c3", from: "cb1", to: "c20" },
    { id: "c4", from: "c20", to: "cb2" },
    { id: "c5", from: "cb2", to: "f10" },
    { id: "m1", from: "srcM", to: "m10" },
    { id: "m2", from: "m10", to: "mb1" },
    { id: "m3", from: "mb1", to: "m20" },
    { id: "m4", from: "m20", to: "mb2" },
    { id: "m5", from: "mb2", to: "f10" },
    { id: "f1", from: "f10", to: "fb1" },
    { id: "f2", from: "fb1", to: "f20" },
    { id: "f3", from: "f20", to: "sink" },
  ],
};

// Glesa ut layouten så att pilar och flödesetiketter får plats mellan noderna.
function spread(m: Model, f = 1.4): Model {
  return { ...m, nodes: m.nodes.map((n) => ({ ...n, x: Math.round(60 + (n.x - 60) * f) })) };
}

export const PRESETS: { id: string; label: string; description: string; model: Model }[] = [
  { id: "single", label: "Enkel linje", description: "Tre maskiner i serie med transportörer och stopp.", model: spread(singleLine, 1.2) },
  { id: "two", label: "Två linjer + packning", description: "Två parallella linjer som går ihop i en gemensam packstation.", model: spread(twoLines) },
  { id: "assembly", label: "Montering", description: "Två förmonteringslinjer som gifts ihop i en monteringsstation.", model: spread(assembly) },
];

export function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}
