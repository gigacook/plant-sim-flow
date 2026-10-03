"use client";
import { useModel } from "@/lib/store/useModel";
import { PRESETS } from "@/lib/sim/presets";

export default function RunSettings({ showPreset = true }: { showPreset?: boolean }) {
  const { run, setRun, reps, setReps, loadPreset, model } = useModel();
  return (
    <div className="flex flex-wrap items-end gap-3">
      {showPreset && (
        <label className="w-56">
          <span className="label">Modell</span>
          <select
            className="input"
            value={PRESETS.find((p) => p.model.name === model.name)?.id ?? ""}
            onChange={(e) => e.target.value && loadPreset(e.target.value)}
          >
            <option value="">{PRESETS.some((p) => p.model.name === model.name) ? "—" : `${model.name} (egen)`}</option>
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="w-28">
        <span className="label">Körtid (h)</span>
        <input className="input" type="number" min={1} max={720} step={1} value={run.duration / 3600} onChange={(e) => setRun({ duration: Math.max(0.25, +e.target.value) * 3600 })} />
      </label>
      <label className="w-28">
        <span className="label">Uppvärmning (h)</span>
        <input className="input" type="number" min={0} max={48} step={0.5} value={run.warmup / 3600} onChange={(e) => setRun({ warmup: Math.max(0, +e.target.value) * 3600 })} />
      </label>
      <label className="w-28">
        <span className="label">Replikeringar</span>
        <input className="input" type="number" min={1} max={50} value={reps} onChange={(e) => setReps(Math.min(50, Math.max(1, Math.round(+e.target.value))))} />
      </label>
      <label className="w-24">
        <span className="label">Slumpfrö</span>
        <input className="input" type="number" value={run.seed} onChange={(e) => setRun({ seed: Math.round(+e.target.value) })} />
      </label>
    </div>
  );
}
