import type { Param, ReplicationSummary, SweepPoint } from "./analysis.ts";
import type { OptResult, OptSpec } from "./optimize.ts";
import type { Model, RunConfig } from "./types.ts";

export type WorkerRequest =
  | { type: "replicate"; id: string; model: Model; cfg: RunConfig; reps: number }
  | { type: "sweep"; id: string; model: Model; cfg: RunConfig; param: Param; values: number[]; reps: number }
  | { type: "optimize"; id: string; model: Model; cfg: RunConfig; spec: OptSpec }
  | { type: "stop" };

export type WorkerResponse =
  | { type: "replicate"; id: string; summary: ReplicationSummary }
  | { type: "sweep"; id: string; points: SweepPoint[] }
  | { type: "optimize"; id: string; result: OptResult }
  | { type: "progress"; id: string; done: number; total: number; payload: unknown }
  | { type: "error"; id: string; message: string };
