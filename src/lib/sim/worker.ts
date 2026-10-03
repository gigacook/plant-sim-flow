/// <reference lib="webworker" />
import { replicate, sweep } from "./analysis.ts";
import { optimize } from "./optimize.ts";
import type { WorkerRequest, WorkerResponse } from "./workerTypes.ts";

let stopFlag = false;
const post = (m: WorkerResponse) => (self as unknown as Worker).postMessage(m);

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  try {
    switch (req.type) {
      case "stop":
        stopFlag = true;
        return;
      case "replicate": {
        const s = replicate(req.model, req.cfg, req.reps);
        post({ type: "replicate", id: req.id, summary: s });
        return;
      }
      case "sweep": {
        const pts = await sweep(req.model, req.cfg, req.param, req.values, req.reps, (done, total, point) =>
          post({ type: "progress", id: req.id, done, total, payload: point }),
        );
        post({ type: "sweep", id: req.id, points: pts });
        return;
      }
      case "optimize": {
        stopFlag = false;
        const res = await optimize(
          req.model,
          req.cfg,
          req.spec,
          (p) => post({ type: "progress", id: req.id, done: p.iteration, total: p.total, payload: p }),
          () => stopFlag,
        );
        post({ type: "optimize", id: req.id, result: res });
        return;
      }
    }
  } catch (err) {
    post({ type: "error", id: "id" in req ? req.id : "", message: String(err) });
  }
};
