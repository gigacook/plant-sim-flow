"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_RUN, PRESETS, clone } from "../sim/presets.ts";
import type { ReplicationSummary } from "../sim/analysis.ts";
import type { Model, ModelNode, RunConfig } from "../sim/types.ts";

export interface Scenario {
  id: string;
  name: string;
  createdAt: number;
  model: Model;
  throughput: number;
  throughputCi: number;
  leadTime: number;
  wip: number;
  oee: number;
  bottleneck: string | null;
}

interface State {
  model: Model;
  run: RunConfig;
  reps: number;
  summary: ReplicationSummary | null;
  summaryModelKey: string | null;
  scenarios: Scenario[];
  setModel: (m: Model) => void;
  loadPreset: (id: string) => void;
  updateNode: (id: string, patch: Partial<ModelNode>) => void;
  setRun: (patch: Partial<RunConfig>) => void;
  setReps: (n: number) => void;
  setSummary: (s: ReplicationSummary | null, key: string | null) => void;
  addScenario: (s: Scenario) => void;
  removeScenario: (id: string) => void;
}

export const modelKey = (m: Model, r: RunConfig, reps: number) => JSON.stringify([m, r, reps]);

export const useModel = create<State>()(
  persist(
    (set) => ({
      model: clone(PRESETS[1].model),
      run: DEFAULT_RUN,
      reps: 5,
      summary: null,
      summaryModelKey: null,
      scenarios: [],
      setModel: (model) => set({ model }),
      loadPreset: (id) => {
        const p = PRESETS.find((x) => x.id === id);
        if (p) set({ model: clone(p.model), summary: null, summaryModelKey: null });
      },
      updateNode: (id, patch) =>
        set((s) => ({ model: { ...s.model, nodes: s.model.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) } })),
      setRun: (patch) => set((s) => ({ run: { ...s.run, ...patch } })),
      setReps: (reps) => set({ reps }),
      setSummary: (summary, summaryModelKey) => set({ summary, summaryModelKey }),
      addScenario: (sc) => set((s) => ({ scenarios: [...s.scenarios, sc] })),
      removeScenario: (id) => set((s) => ({ scenarios: s.scenarios.filter((x) => x.id !== id) })),
    }),
    {
      name: "plant-sim-v1",
      partialize: (s) => ({ model: s.model, run: s.run, reps: s.reps, scenarios: s.scenarios }),
    },
  ),
);
