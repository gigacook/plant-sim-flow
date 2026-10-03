"use client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Area,
  AreaChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
  ReferenceLine,
} from "recharts";
import type { RunResult } from "@/lib/sim/types";
import { CHART, SERIES, STATE_COLORS, STATE_LABELS } from "@/lib/colors";
import { dur, n1, pct } from "@/lib/format";
import { tooltipStyle } from "./ui";

const axisProps = {
  stroke: CHART.axis,
  tick: { fill: CHART.muted, fontSize: 11 },
  tickLine: false,
};

export function StateChart({ result }: { result: RunResult }) {
  const data = result.stations.map((s) => ({
    name: s.name,
    working: s.working * 100,
    waiting: s.waiting * 100,
    blocked: s.blocked * 100,
    failed: s.failed * 100,
  }));
  const keys = ["working", "waiting", "blocked", "failed"] as const;
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 34 + 40)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }} barCategoryGap={6}>
        <CartesianGrid horizontal={false} stroke={CHART.grid} />
        <XAxis type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} unit=" %" {...axisProps} />
        <YAxis type="category" dataKey="name" width={130} {...axisProps} />
        <Tooltip {...tooltipStyle} formatter={(v: number, k: string) => [`${n1(v)} %`, STATE_LABELS[k as keyof typeof STATE_LABELS]]} />
        {keys.map((k, i) => (
          <Bar key={k} dataKey={k} stackId="s" fill={STATE_COLORS[k]} stroke={CHART.surface} strokeWidth={1} radius={i === keys.length - 1 ? [0, 4, 4, 0] : 0} isAnimationActive={false} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ThroughputChart({ result, warmup }: { result: RunResult; warmup: number }) {
  const data = result.series.map((p) => ({ h: (p.t - warmup) / 3600, rate: p.rate }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="tpFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={SERIES[0]} stopOpacity={0.35} />
            <stop offset="100%" stopColor={SERIES[0]} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={CHART.grid} />
        <XAxis dataKey="h" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(v) => `${n1(v)} h`} {...axisProps} />
        <YAxis width={40} {...axisProps} />
        <Tooltip {...tooltipStyle} labelFormatter={(v) => `${n1(+v)} h`} formatter={(v: number) => [`${n1(v)} st/h`, "Genomflöde"]} />
        <ReferenceLine y={result.throughputPerHour} stroke={CHART.muted} strokeDasharray="4 4" label={{ value: `ø ${n1(result.throughputPerHour)}`, fill: CHART.muted, fontSize: 11, position: "insideTopRight" }} />
        <Area type="monotone" dataKey="rate" stroke={SERIES[0]} strokeWidth={2} fill="url(#tpFill)" isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function WipChart({ result, warmup }: { result: RunResult; warmup: number }) {
  const data = result.series.map((p) => ({ h: (p.t - warmup) / 3600, wip: p.wip }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={CHART.grid} />
        <XAxis dataKey="h" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(v) => `${n1(v)} h`} {...axisProps} />
        <YAxis width={40} {...axisProps} />
        <Tooltip {...tooltipStyle} labelFormatter={(v) => `${n1(+v)} h`} formatter={(v: number) => [`${v} st`, "PIA (WIP)"]} />
        <Line type="stepAfter" dataKey="wip" stroke={SERIES[1]} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function BottleneckChart({ result }: { result: RunResult }) {
  const data = [...result.stations].sort((a, b) => b.bottleneckShare - a.bottleneckShare).map((s) => ({ name: s.name, v: s.bottleneckShare * 100, id: s.id }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 30 + 30)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }} barCategoryGap={6}>
        <CartesianGrid horizontal={false} stroke={CHART.grid} />
        <XAxis type="number" unit=" %" domain={[0, "auto"]} {...axisProps} />
        <YAxis type="category" dataKey="name" width={130} {...axisProps} />
        <Tooltip {...tooltipStyle} formatter={(v: number) => [`${n1(v)} %`, "Andel som flaskhals"]} />
        <Bar dataKey="v" radius={[0, 4, 4, 0]} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.id} fill={d.id === result.bottleneckId ? STATE_COLORS.failed : "#55544f"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function BufferChart({ result }: { result: RunResult }) {
  const data = result.buffers.map((b) => ({ name: b.name, avg: b.avgLevel, rest: Math.max(0, b.capacity - b.avgLevel), cap: b.capacity, full: b.fullShare }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 30 + 30)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }} barCategoryGap={6}>
        <CartesianGrid horizontal={false} stroke={CHART.grid} />
        <XAxis type="number" {...axisProps} />
        <YAxis type="category" dataKey="name" width={130} {...axisProps} />
        <Tooltip
          {...tooltipStyle}
          formatter={(v: number, k: string, p: { payload?: { cap: number; full: number } }) =>
            k === "avg" ? [`${n1(v)} av ${p.payload?.cap} (full ${pct(p.payload?.full ?? 0)})`, "Medelnivå"] : [`${n1(v)}`, "Ledigt"]
          }
        />
        <Bar dataKey="avg" stackId="b" fill={SERIES[0]} stroke={CHART.surface} isAnimationActive={false} />
        <Bar dataKey="rest" stackId="b" fill="#2c2c2a" radius={[0, 4, 4, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LeadTimeHistogram({ result }: { result: RunResult }) {
  const data = result.leadTimeHistogram.map((b) => ({ label: dur((b.from + b.to) / 2), count: b.count, mid: (b.from + b.to) / 2 }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke={CHART.grid} />
        <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={24} />
        <YAxis width={36} {...axisProps} />
        <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v} st`, "Antal"]} />
        <Bar dataKey="count" fill={SERIES[2]} radius={[4, 4, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
