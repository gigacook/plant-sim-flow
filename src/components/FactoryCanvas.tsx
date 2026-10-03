"use client";

import { useMemo, useRef, useState } from "react";
import type { Snapshot } from "@/lib/sim/engine";
import type { Model, ModelNode, RunResult } from "@/lib/sim/types";
import { SERVER_COLORS, STATE_COLORS } from "@/lib/colors";
import { describeDist } from "@/lib/sim/random";
import { n0, pct } from "@/lib/format";

export interface Token {
  key: string;
  edge: string;
  progress: number;
}

interface Props {
  model: Model;
  snapshot?: Snapshot | null;
  result?: RunResult | null;
  tokens?: Token[];
  selected?: string | null;
  editable?: boolean;
  connectFrom?: string | null;
  onSelect?: (id: string | null) => void;
  onMoveNode?: (id: string, x: number, y: number) => void;
  onNodeClick?: (id: string) => void;
  onEdgeClick?: (id: string) => void;
  height?: number;
}

const SIZE: Record<ModelNode["kind"], { w: number; h: number }> = {
  source: { w: 84, h: 46 },
  sink: { w: 84, h: 46 },
  buffer: { w: 84, h: 40 },
  station: { w: 104, h: 64 },
  assembly: { w: 104, h: 64 },
};

function edgePath(a: ModelNode, b: ModelNode) {
  const sa = SIZE[a.kind];
  const sb = SIZE[b.kind];
  const backwards = b.x < a.x;
  const x1 = a.x + sa.w / 2;
  const y1 = a.y;
  const x2 = b.x - sb.w / 2 - 6;
  const y2 = b.y;
  const dx = backwards ? 120 : Math.max(30, (x2 - x1) / 2);
  const p = [x1, y1, x1 + dx, y1, x2 - dx, y2, x2, y2] as const;
  return { d: `M${p[0]},${p[1]} C${p[2]},${p[3]} ${p[4]},${p[5]} ${p[6]},${p[7]}`, p };
}

function bezier(p: readonly number[], t: number) {
  const u = 1 - t;
  const x = u * u * u * p[0] + 3 * u * u * t * p[2] + 3 * u * t * t * p[4] + t * t * t * p[6];
  const y = u * u * u * p[1] + 3 * u * u * t * p[3] + 3 * u * t * t * p[5] + t * t * t * p[7];
  return { x, y };
}

export default function FactoryCanvas({
  model,
  snapshot,
  result,
  tokens,
  selected,
  editable,
  connectFrom,
  onSelect,
  onMoveNode,
  onNodeClick,
  onEdgeClick,
  height = 460,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const byId = useMemo(() => new Map(model.nodes.map((n) => [n.id, n])), [model.nodes]);
  const lineColor = useMemo(() => new Map(model.lines.map((l) => [l.id, l.color])), [model.lines]);

  const vb = useMemo(() => {
    if (model.nodes.length === 0) return { x: 0, y: 0, w: 1200, h: 460 };
    const xs = model.nodes.map((n) => n.x);
    const ys = model.nodes.map((n) => n.y);
    const x0 = Math.min(...xs) - 90;
    const y0 = Math.min(...ys) - 90;
    const x1 = Math.max(...xs) + 90;
    const y1 = Math.max(...ys) + 90;
    return { x: x0, y: y0, w: Math.max(600, x1 - x0), h: Math.max(300, y1 - y0) };
  }, [model.nodes]);

  const lanes = useMemo(
    () =>
      model.lines
        .map((l) => {
          const ns = model.nodes.filter((n) => n.lineId === l.id);
          if (!ns.length) return null;
          const x0 = Math.min(...ns.map((n) => n.x - SIZE[n.kind].w / 2)) - 16;
          const x1 = Math.max(...ns.map((n) => n.x + SIZE[n.kind].w / 2)) + 16;
          const y0 = Math.min(...ns.map((n) => n.y - SIZE[n.kind].h / 2)) - 34;
          const y1 = Math.max(...ns.map((n) => n.y + SIZE[n.kind].h / 2)) + 30;
          return { ...l, x0, x1, y0, y1 };
        })
        .filter(Boolean) as (Model["lines"][number] & { x0: number; x1: number; y0: number; y1: number })[],
    [model.lines, model.nodes],
  );

  const edges = useMemo(
    () =>
      model.edges
        .map((e) => {
          const a = byId.get(e.from);
          const b = byId.get(e.to);
          if (!a || !b) return null;
          return { e, ...edgePath(a, b) };
        })
        .filter(Boolean) as { e: Model["edges"][number]; d: string; p: readonly number[] }[],
    [model.edges, byId],
  );
  const edgeById = useMemo(() => new Map(edges.map((x) => [x.e.id, x])), [edges]);

  const maxFlow = result ? Math.max(1, ...Object.values(result.edgeFlow)) : 1;
  const stationStats = useMemo(() => new Map(result?.stations.map((s) => [s.id, s]) ?? []), [result]);
  const bufferStats = useMemo(() => new Map(result?.buffers.map((s) => [s.id, s]) ?? []), [result]);
  const sinkStats = useMemo(() => new Map(result?.sinks.map((s) => [s.id, s]) ?? []), [result]);

  const toSvg = (ev: React.PointerEvent) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const r = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: r.x, y: r.y };
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      className="w-full select-none rounded-xl bg-[var(--canvas)]"
      style={{ height, touchAction: editable ? "none" : "auto" }}
      onPointerMove={(ev) => {
        if (!drag || !onMoveNode) return;
        const p = toSvg(ev);
        onMoveNode(drag.id, Math.round((p.x - drag.dx) / 10) * 10, Math.round((p.y - drag.dy) / 10) * 10);
      }}
      onPointerUp={() => setDrag(null)}
      onPointerLeave={() => setDrag(null)}
      onPointerDown={(ev) => {
        if (ev.target === svgRef.current) onSelect?.(null);
      }}
      role="img"
      aria-label={`Fabrikslayout: ${model.name}`}
    >
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" stroke="var(--grid)" strokeWidth="0.6" />
        </pattern>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#6f6e69" />
        </marker>
      </defs>
      <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="url(#grid)" pointerEvents="none" />

      {lanes.map((l) => (
        <g key={l.id} pointerEvents="none">
          <rect x={l.x0} y={l.y0} width={l.x1 - l.x0} height={l.y1 - l.y0} rx={14} fill={l.color} fillOpacity={0.06} stroke={l.color} strokeOpacity={0.35} strokeDasharray="5 5" />
          <text x={l.x0 + 12} y={l.y0 + 17} fontSize={12} fontWeight={600} fill={l.color}>
            {l.name}
          </text>
        </g>
      ))}

      {edges.map(({ e, d, p }) => {
        const flow = result?.edgeFlow[e.id] ?? 0;
        const w = result ? 1.5 + (flow / maxFlow) * 9 : 2;
        const mid = bezier(p, 0.5);
        return (
          <g key={e.id} onClick={() => onEdgeClick?.(e.id)} style={{ cursor: onEdgeClick ? "pointer" : "default" }}>
            <path d={d} fill="none" stroke="transparent" strokeWidth={14} />
            <path d={d} fill="none" stroke={result ? "#3987e5" : "#55544f"} strokeOpacity={result ? 0.55 : 1} strokeWidth={w} markerEnd="url(#arrow)" />
            {result && flow > 0 && (
              <g pointerEvents="none">
                <rect x={mid.x - 18} y={mid.y - 19} width={36} height={14} rx={4} fill="var(--canvas)" />
                <text x={mid.x} y={mid.y - 8} fontSize={10} textAnchor="middle" fill="#c3c2b7">
                  {n0(flow)}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {tokens?.map((tk) => {
        const ed = edgeById.get(tk.edge);
        if (!ed) return null;
        const pt = bezier(ed.p, Math.min(1, tk.progress));
        return <circle key={tk.key} cx={pt.x} cy={pt.y} r={5} fill="#86b6ef" stroke="var(--canvas)" strokeWidth={2} pointerEvents="none" />;
      })}

      {model.nodes.map((n) => {
        const { w, h } = SIZE[n.kind];
        const snap = snapshot?.nodes[n.id];
        const isSel = selected === n.id;
        const isConnect = connectFrom === n.id;
        const color = lineColor.get(n.lineId) ?? "#888";
        const x = n.x - w / 2;
        const y = n.y - h / 2;
        const common = {
          onPointerDown: (ev: React.PointerEvent) => {
            ev.stopPropagation();
            onSelect?.(n.id);
            onNodeClick?.(n.id);
            if (editable && onMoveNode) {
              const p = toSvg(ev);
              setDrag({ id: n.id, dx: p.x - n.x, dy: p.y - n.y });
            }
          },
          onPointerEnter: () => setHover(n.id),
          onPointerLeave: () => setHover((h) => (h === n.id ? null : h)),
          style: { cursor: editable ? "grab" : onSelect ? "pointer" : "default" },
        };
        const ring = isSel || isConnect ? <rect x={x - 5} y={y - 5} width={w + 10} height={h + 10} rx={12} fill="none" stroke={isConnect ? "#fab219" : "#ffffff"} strokeWidth={2} strokeDasharray={isConnect ? "4 3" : undefined} /> : null;

        if (n.kind === "station" || n.kind === "assembly") {
          const servers = snap?.servers;
          const st = stationStats.get(n.id);
          let status: keyof typeof SERVER_COLORS | null = null;
          if (servers) {
            if (servers.includes("failed")) status = "failed";
            else if (servers.includes("busy")) status = "busy";
            else if (servers.includes("blocked")) status = "blocked";
            else status = "idle";
          }
          const isBn = snap?.bottleneck || (result && result.bottleneckId === n.id);
          const stroke = status ? SERVER_COLORS[status] : color;
          return (
            <g key={n.id} {...common}>
              {ring}
              {isBn && <rect x={x - 3} y={y - 3} width={w + 6} height={h + 6} rx={11} fill="none" stroke="#d03b3b" strokeWidth={2} className="bn-pulse" />}
              <rect x={x} y={y} width={w} height={h} rx={9} fill="var(--node)" stroke={stroke} strokeWidth={status ? 2.5 : 1.5} />
              <rect x={x} y={y} width={5} height={h} rx={2} fill={color} />
              <text x={x + 12} y={y + 17} fontSize={11.5} fontWeight={600} fill="#f4f3ee">
                {n.name.length > 15 ? n.name.slice(0, 14) + "…" : n.name}
              </text>
              <text x={x + 12} y={y + 31} fontSize={9.5} fill="#898781">
                {n.kind === "assembly" ? "⊕ " : "⚙ "}
                {describeDist(n.processTime)}
              </text>
              {servers ? (
                servers.slice(0, 6).map((s, i) => (
                  <circle key={i} cx={x + 16 + i * 13} cy={y + h - 13} r={4.5} fill={SERVER_COLORS[s]} />
                ))
              ) : st ? (
                <g>
                  {(() => {
                    const parts = [
                      { v: st.working, c: STATE_COLORS.working },
                      { v: st.waiting, c: STATE_COLORS.waiting },
                      { v: st.blocked, c: STATE_COLORS.blocked },
                      { v: st.failed, c: STATE_COLORS.failed },
                    ];
                    let acc = 0;
                    const bw = w - 22;
                    return parts.map((p, i) => {
                      const el = <rect key={i} x={x + 12 + acc * bw} y={y + h - 17} width={Math.max(0, p.v * bw - 1)} height={8} fill={p.c} />;
                      acc += p.v;
                      return el;
                    });
                  })()}
                </g>
              ) : (
                <text x={x + 12} y={y + h - 9} fontSize={9.5} fill="#898781">
                  {n.servers ?? 1} maskin{(n.servers ?? 1) > 1 ? "er" : ""}
                  {n.mtbf ? " · stopp" : ""}
                </text>
              )}
              {snap?.kitSize ? (
                <text x={x + w - 8} y={y + h - 9} fontSize={9.5} textAnchor="end" fill="#c3c2b7">
                  kit {snap.kit}/{snap.kitSize}
                </text>
              ) : st ? null : null}
              {isBn && (
                <g>
                  <rect x={x + w - 58} y={y - 11} width={58} height={16} rx={8} fill="#d03b3b" />
                  <text x={x + w - 29} y={y + 1} fontSize={9.5} fontWeight={700} textAnchor="middle" fill="#fff">
                    ▲ Flaskhals
                  </text>
                </g>
              )}
              {hover === n.id && st && (
                <g pointerEvents="none">
                  <rect x={x} y={y + h + 6} width={150} height={60} rx={6} fill="#0d0d0d" stroke="#383835" />
                  <text x={x + 8} y={y + h + 21} fontSize={10} fill="#c3c2b7">Arbetar {pct(st.working)} · Block {pct(st.blocked)}</text>
                  <text x={x + 8} y={y + h + 36} fontSize={10} fill="#c3c2b7">Väntar {pct(st.waiting)} · Fel {pct(st.failed)}</text>
                  <text x={x + 8} y={y + h + 51} fontSize={10} fill="#c3c2b7">OEE {pct(st.oee)} · {n0(st.processed)} st</text>
                </g>
              )}
            </g>
          );
        }

        if (n.kind === "buffer") {
          const cap = n.capacity ?? 1;
          const bs = bufferStats.get(n.id);
          const level = snap?.level ?? (bs ? bs.avgLevel : 0);
          const frac = Math.min(1, level / cap);
          const fillColor = frac >= 0.999 ? STATE_COLORS.blocked : frac === 0 ? "#383835" : "#3987e5";
          return (
            <g key={n.id} {...common}>
              {ring}
              <rect x={x} y={y} width={w} height={h} rx={6} fill="var(--node)" stroke={color} strokeOpacity={0.7} strokeWidth={1.2} />
              <rect x={x + 6} y={y + h - 14} width={w - 12} height={8} rx={3} fill="#2c2c2a" />
              <rect x={x + 6} y={y + h - 14} width={(w - 12) * frac} height={8} rx={3} fill={fillColor} />
              <text x={x + 8} y={y + 15} fontSize={10.5} fontWeight={600} fill="#e8e7e1">
                {n.name.length > 12 ? n.name.slice(0, 11) + "…" : n.name}
              </text>
              <text x={x + w - 6} y={y + 15} fontSize={10} textAnchor="end" fill="#898781">
                {snap ? `${level}/${cap}` : bs ? `ø${bs.avgLevel.toFixed(1)}/${cap}` : `${cap}`}
              </text>
            </g>
          );
        }

        if (n.kind === "source") {
          const blocked = snap?.blocked;
          return (
            <g key={n.id} {...common}>
              {ring}
              <path d={`M${x},${y + 8} q0,-8 8,-8 h${w - 24} l16,${h / 2} l-16,${h / 2} h-${w - 24} q-8,0 -8,-8 z`} fill="var(--node)" stroke={blocked ? STATE_COLORS.blocked : color} strokeWidth={blocked ? 2.5 : 1.5} />
              <text x={x + 10} y={y + 19} fontSize={10.5} fontWeight={600} fill="#e8e7e1">
                {n.name.length > 11 ? n.name.slice(0, 10) + "…" : n.name}
              </text>
              <text x={x + 10} y={y + 34} fontSize={9.5} fill="#898781">
                {n.interarrival?.type === "const" && n.interarrival.value === 0 ? "∞ tillgång" : `↦ ${describeDist(n.interarrival)}`}
              </text>
            </g>
          );
        }

        // sink
        const count = snap?.count ?? sinkStats.get(n.id)?.count;
        return (
          <g key={n.id} {...common}>
            {ring}
            <path d={`M${x},${y} h${w - 8} q8,0 8,8 v${h - 16} q0,8 -8,8 h-${w - 8} l12,-${h / 2} z`} fill="var(--node)" stroke={color} strokeWidth={1.5} />
            <text x={x + 18} y={y + 19} fontSize={10.5} fontWeight={600} fill="#e8e7e1">
              {n.name.length > 10 ? n.name.slice(0, 9) + "…" : n.name}
            </text>
            <text x={x + 18} y={y + 34} fontSize={10} fill="#0ca30c">
              {count !== undefined ? `✓ ${n0(count)} st` : "Utlopp"}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
