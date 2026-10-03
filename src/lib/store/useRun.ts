"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { averageRuns } from "../sim/analysis.ts";
import { runJob } from "../sim/client.ts";
import { modelKey, useModel } from "./useModel.ts";

/** Kör replikeringar av aktuell modell i workern och cachar resultatet i storen. */
export function useRun(auto = true) {
  const { model, run, reps, summary, summaryModelKey, setSummary } = useModel();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = modelKey(model, run, reps);
  const stale = summaryModelKey !== key;

  const execute = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await runJob<"replicate">({ type: "replicate", model, cfg: run, reps });
      setSummary(res.summary, key);
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  }, [model, run, reps, key, setSummary]);

  useEffect(() => {
    if (auto && (!summary || stale) && !running) execute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, key]);

  const avg = useMemo(() => (summary && summary.runs.length ? averageRuns(summary.runs) : null), [summary]);
  return { summary, avg, running, stale, error, execute };
}
