"use client";
import type { WorkerRequest, WorkerResponse } from "./workerTypes.ts";

let worker: Worker | null = null;
const listeners = new Map<string, (m: WorkerResponse) => void>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => listeners.get(e.data.id)?.(e.data);
  }
  return worker;
}

type Req = Exclude<WorkerRequest, { type: "stop" }>;
type ResOf<T extends Req["type"]> = Extract<WorkerResponse, { type: T }>;

/** Kör ett jobb i simulerings-workern. Progress-meddelanden skickas till onProgress. */
export function runJob<T extends Req["type"]>(
  req: Omit<Extract<Req, { type: T }>, "id">,
  onProgress?: (done: number, total: number, payload: unknown) => void,
): Promise<ResOf<T>> {
  const id = Math.random().toString(36).slice(2);
  return new Promise((resolve, reject) => {
    listeners.set(id, (m) => {
      if (m.type === "progress") return onProgress?.(m.done, m.total, m.payload);
      listeners.delete(id);
      if (m.type === "error") reject(new Error(m.message));
      else resolve(m as ResOf<T>);
    });
    getWorker().postMessage({ ...req, id });
  });
}

export function stopJobs() {
  worker?.postMessage({ type: "stop" } satisfies WorkerRequest);
}
