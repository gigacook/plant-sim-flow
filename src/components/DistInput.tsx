"use client";
import type { Dist } from "@/lib/sim/types";

const LABELS: Record<Dist["type"], string> = {
  const: "Konstant",
  exp: "Exponentiell",
  normal: "Normal",
  tri: "Triangulär",
  uniform: "Likformig",
};

function convert(d: Dist | undefined, type: Dist["type"]): Dist {
  const m = d ? (d.type === "const" ? d.value : d.type === "exp" || d.type === "normal" ? d.mean : d.type === "tri" ? d.mode : (d.min + d.max) / 2) : 60;
  switch (type) {
    case "const":
      return { type, value: m };
    case "exp":
      return { type, mean: m };
    case "normal":
      return { type, mean: m, sd: Math.round(m * 0.1 * 10) / 10 };
    case "tri":
      return { type, min: Math.round(m * 0.85), mode: m, max: Math.round(m * 1.25) };
    case "uniform":
      return { type, min: Math.round(m * 0.9), max: Math.round(m * 1.1) };
  }
}

export default function DistInput({ label, value, onChange }: { label: string; value: Dist | undefined; onChange: (d: Dist) => void }) {
  const d = value ?? { type: "const", value: 60 };
  const fields: [string, string][] =
    d.type === "const"
      ? [["value", "Värde"]]
      : d.type === "exp"
        ? [["mean", "Medel"]]
        : d.type === "normal"
          ? [["mean", "Medel"], ["sd", "Std.av."]]
          : d.type === "tri"
            ? [["min", "Min"], ["mode", "Typvärde"], ["max", "Max"]]
            : [["min", "Min"], ["max", "Max"]];
  return (
    <div>
      <span className="label">{label} (sekunder)</span>
      <select className="input mb-1.5" value={d.type} onChange={(e) => onChange(convert(d, e.target.value as Dist["type"]))}>
        {Object.entries(LABELS).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${fields.length}, minmax(0,1fr))` }}>
        {fields.map(([k, l]) => (
          <label key={k}>
            <span className="label">{l}</span>
            <input
              className="input"
              type="number"
              min={0}
              step="any"
              value={(d as unknown as Record<string, number>)[k]}
              onChange={(e) => onChange({ ...d, [k]: Math.max(0, +e.target.value) } as Dist)}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
