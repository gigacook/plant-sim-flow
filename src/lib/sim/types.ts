// Modell- och resultattyper för fabrikssimuleringen.

export type Dist =
  | { type: "const"; value: number }
  | { type: "exp"; mean: number }
  | { type: "normal"; mean: number; sd: number }
  | { type: "tri"; min: number; mode: number; max: number }
  | { type: "uniform"; min: number; max: number };

export type NodeKind = "source" | "buffer" | "station" | "assembly" | "sink";

export type RoutingRule = "roundRobin" | "shortestQueue" | "first" | "random";

export interface ModelNode {
  id: string;
  name: string;
  kind: NodeKind;
  lineId: string;
  x: number;
  y: number;
  /** Källa: tid mellan ankomster (sekunder). */
  interarrival?: Dist;
  /** Källa: max antal detaljer (0 = obegränsat). */
  limit?: number;
  /** Buffert: kapacitet (antal platser). */
  capacity?: number;
  /** Buffert/transportör: minsta genomloppstid (sekunder). */
  transitTime?: number;
  /** Station: antal parallella maskiner/operatörer. */
  servers?: number;
  /** Station: cykeltid (sekunder). */
  processTime?: Dist;
  /** Station: medeltid mellan fel (sekunder, 0 = inga fel). */
  mtbf?: number;
  /** Station: medeltid för reparation (sekunder). */
  mttr?: number;
  /** Station: andel kassation 0..1. */
  scrapRate?: number;
  /** Utgående routing-regel. */
  routing?: RoutingRule;
}

export interface ModelEdge {
  id: string;
  from: string;
  to: string;
}

export interface Line {
  id: string;
  name: string;
  color: string;
}

export interface Model {
  name: string;
  lines: Line[];
  nodes: ModelNode[];
  edges: ModelEdge[];
}

export interface RunConfig {
  /** Simulerad tid (sekunder) efter uppvärmning. */
  duration: number;
  /** Uppvärmningstid (sekunder) – statistik nollställs därefter. */
  warmup: number;
  seed: number;
  /** Intervall för tidsserier (sekunder). */
  sampleInterval: number;
}

export type ServerState = "idle" | "busy" | "blocked" | "failed";

export interface StationStats {
  id: string;
  name: string;
  lineId: string;
  kind: NodeKind;
  servers: number;
  /** Andel av tillgänglig maskintid per tillstånd (0..1). */
  working: number;
  waiting: number;
  blocked: number;
  failed: number;
  processed: number;
  scrapped: number;
  oee: number;
  availability: number;
  performance: number;
  quality: number;
  /** Andel av tiden som stationen var (ensam) flaskhals enligt aktiv-period-metoden. */
  bottleneckShare: number;
  /** Medelvärde av längsta aktiva period (sekunder). */
  meanActivePeriod: number;
}

export interface BufferStats {
  id: string;
  name: string;
  lineId: string;
  capacity: number;
  avgLevel: number;
  maxLevel: number;
  /** Andel av tiden full. */
  fullShare: number;
  /** Andel av tiden tom. */
  emptyShare: number;
  avgWait: number;
}

export interface SourceStats {
  id: string;
  name: string;
  lineId: string;
  created: number;
  blockedShare: number;
}

export interface SinkStats {
  id: string;
  name: string;
  lineId: string;
  count: number;
  throughputPerHour: number;
  avgLeadTime: number;
}

export interface SeriesPoint {
  t: number;
  wip: number;
  output: number;
  /** Utflöde per timme under senaste intervallet. */
  rate: number;
  buffers: Record<string, number>;
}

export interface RunResult {
  duration: number;
  throughputPerHour: number;
  totalOutput: number;
  totalScrap: number;
  avgWip: number;
  avgLeadTime: number;
  p50LeadTime: number;
  p95LeadTime: number;
  /** Little's lag: WIP / genomflöde (sekunder). */
  littleLeadTime: number;
  oee: number;
  bottleneckId: string | null;
  stations: StationStats[];
  buffers: BufferStats[];
  sources: SourceStats[];
  sinks: SinkStats[];
  /** Flöde per kant (antal detaljer). */
  edgeFlow: Record<string, number>;
  series: SeriesPoint[];
  leadTimeHistogram: { from: number; to: number; count: number }[];
  events: number;
  /** Sant om körningen avbröts av händelsebudgeten (modellen är orimligt snabb). */
  truncated: boolean;
}
