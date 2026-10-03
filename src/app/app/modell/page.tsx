"use client";
import { useMemo, useRef, useState } from "react";
import FactoryCanvas from "@/components/FactoryCanvas";
import DistInput from "@/components/DistInput";
import { Card, PageHeader } from "@/components/ui";
import { LINE_COLORS, PRESETS, clone } from "@/lib/sim/presets";
import { useModel } from "@/lib/store/useModel";
import type { Model, ModelNode, NodeKind } from "@/lib/sim/types";
import { validateModel } from "@/lib/sim/validate";
import { distMean } from "@/lib/sim/random";
import { shareUrl } from "@/lib/share";

const KIND_LABEL: Record<NodeKind, string> = {
  source: "Källa",
  buffer: "Buffert / transportör",
  station: "Station",
  assembly: "Monteringsstation",
  sink: "Utlopp",
};

const uid = (p: string) => `${p}${Math.random().toString(36).slice(2, 7)}`;

function validate(m: Model): string[] {
  const issues: string[] = [];
  for (const n of m.nodes) {
    const ins = m.edges.filter((e) => e.to === n.id).length;
    const outs = m.edges.filter((e) => e.from === n.id).length;
    if (n.kind !== "source" && ins === 0) issues.push(`${n.name} saknar inflöde.`);
    if (n.kind !== "sink" && outs === 0) issues.push(`${n.name} saknar utflöde – detaljer fastnar.`);
    if (n.kind === "assembly" && ins < 2) issues.push(`${n.name} (montering) bör ha minst två inflöden.`);
    if ((n.kind === "station" || n.kind === "assembly") && distMean(n.processTime) < 1)
      issues.push(`${n.name} har cykeltid under 1 s – orimligt snabbt; simuleringen kan avbrytas i förtid.`);
  }
  if (!m.nodes.some((n) => n.kind === "source")) issues.push("Modellen saknar källa.");
  if (!m.nodes.some((n) => n.kind === "sink")) issues.push("Modellen saknar utlopp.");
  return issues;
}

export default function ModelPage() {
  const { model, setModel, updateNode, loadPreset } = useModel();
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [connect, setConnect] = useState(false);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const node = model.nodes.find((n) => n.id === selected) ?? null;
  const issues = useMemo(() => validate(model), [model]);

  const addNode = (kind: NodeKind) => {
    const lineId = node?.lineId ?? model.lines[0]?.id ?? "L1";
    const maxX = Math.max(0, ...model.nodes.filter((n) => n.lineId === lineId).map((n) => n.x));
    const refY = model.nodes.find((n) => n.lineId === lineId)?.y ?? 200;
    const count = model.nodes.filter((n) => n.kind === kind).length + 1;
    const base: ModelNode = { id: uid(kind[0]), name: `${KIND_LABEL[kind].split(" ")[0]} ${count}`, kind, lineId, x: maxX + 140, y: refY };
    if (kind === "source") base.interarrival = { type: "exp", mean: 60 };
    if (kind === "buffer") Object.assign(base, { capacity: 5, transitTime: 0 });
    if (kind === "station" || kind === "assembly") Object.assign(base, { servers: 1, processTime: { type: "tri", min: 45, mode: 55, max: 70 }, mtbf: 0, mttr: 600, scrapRate: 0 });
    const edges = [...model.edges];
    if (node && node.kind !== "sink") edges.push({ id: uid("e"), from: node.id, to: base.id });
    setModel({ ...model, nodes: [...model.nodes, base], edges });
    setSelected(base.id);
  };

  const removeSelected = () => {
    if (selectedEdge) {
      setModel({ ...model, edges: model.edges.filter((e) => e.id !== selectedEdge) });
      setSelectedEdge(null);
      return;
    }
    if (!node) return;
    setModel({ ...model, nodes: model.nodes.filter((n) => n.id !== node.id), edges: model.edges.filter((e) => e.from !== node.id && e.to !== node.id) });
    setSelected(null);
  };

  const onNodeClick = (id: string) => {
    setSelectedEdge(null);
    if (!connect) return;
    if (!connectFrom) return setConnectFrom(id);
    if (connectFrom !== id && !model.edges.some((e) => e.from === connectFrom && e.to === id)) {
      setModel({ ...model, edges: [...model.edges, { id: uid("e"), from: connectFrom, to: id }] });
    }
    setConnectFrom(null);
  };

  const addLine = () => {
    const i = model.lines.length;
    setModel({ ...model, lines: [...model.lines, { id: uid("L"), name: `Linje ${i + 1}`, color: LINE_COLORS[i % LINE_COLORS.length] }] });
  };

  const [shared, setShared] = useState<string | null>(null);
  const share = async () => {
    try {
      const url = await shareUrl(model);
      await navigator.clipboard.writeText(url);
      setShared("✓ Länk kopierad");
    } catch {
      setShared("Kunde inte kopiera");
    }
    setTimeout(() => setShared(null), 2500);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(model, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${model.name.replace(/[^\wåäö-]+/gi, "_")}.json`;
    a.click();
  };
  const importJson = async (f: File) => {
    try {
      setModel(validateModel(JSON.parse(await f.text())));
      setSelected(null);
    } catch (e) {
      alert(`Kunde inte läsa modellen: ${e instanceof Error ? e.message : e}`);
    }
  };

  const num = (v: string) => (v === "" ? 0 : +v);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Modell & layout"
        description="Bygg fabriken: lägg till källor, buffertar, stationer och utlopp, koppla ihop dem och ange cykeltider, stopp och kapaciteter. Dra noder för att flytta dem."
        actions={
          <>
            <select className="input w-52" value="" onChange={(e) => { if (e.target.value) { loadPreset(e.target.value); setSelected(null); } }}>
              <option value="">Ladda mall…</option>
              {PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <button className="btn" onClick={share}>{shared ?? "🔗 Dela länk"}</button>
            <button className="btn" onClick={exportJson}>⇩ Exportera</button>
            <button className="btn" onClick={() => fileRef.current?.click()}>⇧ Importera</button>
            <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-4">
          <Card>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <input className="input w-64" value={model.name} onChange={(e) => setModel({ ...model, name: e.target.value })} aria-label="Modellnamn" />
              <span className="mx-1 h-6 w-px bg-[var(--border)]" />
              {(Object.keys(KIND_LABEL) as NodeKind[]).map((k) => (
                <button key={k} className="btn" onClick={() => addNode(k)}>
                  ＋ {KIND_LABEL[k].split(" ")[0]}
                </button>
              ))}
              <span className="mx-1 h-6 w-px bg-[var(--border)]" />
              <button className={`btn ${connect ? "btn-active" : ""}`} onClick={() => { setConnect(!connect); setConnectFrom(null); }}>
                ⤳ {connect ? (connectFrom ? "Välj mål…" : "Välj start…") : "Koppla"}
              </button>
              <button className="btn btn-danger" disabled={!node && !selectedEdge} onClick={removeSelected}>
                ✕ Ta bort {selectedEdge ? "koppling" : ""}
              </button>
            </div>
            <FactoryCanvas
              model={model}
              editable
              selected={selected}
              connectFrom={connectFrom}
              onSelect={(id) => { setSelected(id); if (!id) setSelectedEdge(null); }}
              onNodeClick={onNodeClick}
              onEdgeClick={(id) => { setSelectedEdge(id); setSelected(null); }}
              onMoveNode={(id, x, y) => updateNode(id, { x, y })}
              height={520}
            />
            <p className="mt-2 text-[12px] text-[var(--muted)]">
              Tips: Markera en nod och klicka ＋ för att lägga till en ny nod direkt efter den (kopplas automatiskt). Klicka på en pil för att markera kopplingen.
              {selectedEdge && <span className="ml-1 text-[#fab219]">Koppling markerad.</span>}
            </p>
          </Card>

          <Card title="Linjer" actions={<button className="btn" onClick={addLine}>＋ Linje</button>}>
            <div className="flex flex-wrap gap-2">
              {model.lines.map((l) => (
                <div key={l.id} className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-2 py-1.5">
                  <input type="color" value={l.color} onChange={(e) => setModel({ ...model, lines: model.lines.map((x) => (x.id === l.id ? { ...x, color: e.target.value } : x)) })} className="h-6 w-6 cursor-pointer rounded bg-transparent" aria-label="Färg" />
                  <input className="input w-36" value={l.name} onChange={(e) => setModel({ ...model, lines: model.lines.map((x) => (x.id === l.id ? { ...x, name: e.target.value } : x)) })} />
                  <span className="text-[11px] text-[var(--muted)]">{model.nodes.filter((n) => n.lineId === l.id).length} noder</span>
                </div>
              ))}
            </div>
          </Card>

          {issues.length > 0 && (
            <Card title="Modellkontroll">
              <ul className="space-y-1 text-[13px] text-[#fab219]">
                {issues.map((i, k) => (
                  <li key={k}>! {i}</li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card title={node ? `Egenskaper – ${KIND_LABEL[node.kind]}` : "Egenskaper"}>
            {!node ? (
              <p className="text-[13px] text-[var(--muted)]">Markera en nod i layouten för att redigera den.</p>
            ) : (
              <div className="space-y-3">
                <label className="block">
                  <span className="label">Namn</span>
                  <input className="input" value={node.name} onChange={(e) => updateNode(node.id, { name: e.target.value })} />
                </label>
                <label className="block">
                  <span className="label">Linje</span>
                  <select className="input" value={node.lineId} onChange={(e) => updateNode(node.id, { lineId: e.target.value })}>
                    {model.lines.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </label>

                {node.kind === "source" && (
                  <>
                    <DistInput label="Tid mellan ankomster" value={node.interarrival} onChange={(d) => updateNode(node.id, { interarrival: d })} />
                    <p className="text-[11.5px] text-[var(--muted)]">Konstant 0 = obegränsad tillgång (linjen styr takten).</p>
                    <label className="block">
                      <span className="label">Max antal (0 = obegränsat)</span>
                      <input className="input" type="number" min={0} value={node.limit ?? 0} onChange={(e) => updateNode(node.id, { limit: num(e.target.value) })} />
                    </label>
                  </>
                )}

                {node.kind === "buffer" && (
                  <div className="grid grid-cols-2 gap-2">
                    <label>
                      <span className="label">Kapacitet (st)</span>
                      <input className="input" type="number" min={1} value={node.capacity ?? 1} onChange={(e) => updateNode(node.id, { capacity: Math.max(1, Math.round(num(e.target.value))) })} />
                    </label>
                    <label>
                      <span className="label">Transporttid (s)</span>
                      <input className="input" type="number" min={0} value={node.transitTime ?? 0} onChange={(e) => updateNode(node.id, { transitTime: Math.max(0, num(e.target.value)) })} />
                    </label>
                  </div>
                )}

                {(node.kind === "station" || node.kind === "assembly") && (
                  <>
                    <DistInput label="Cykeltid" value={node.processTime} onChange={(d) => updateNode(node.id, { processTime: d })} />
                    <div className="grid grid-cols-2 gap-2">
                      <label>
                        <span className="label">Parallella maskiner</span>
                        <input className="input" type="number" min={1} max={20} value={node.servers ?? 1} onChange={(e) => updateNode(node.id, { servers: Math.max(1, Math.round(num(e.target.value))) })} />
                      </label>
                      <label>
                        <span className="label">Kassation (%)</span>
                        <input className="input" type="number" min={0} max={100} step={0.1} value={Math.round((node.scrapRate ?? 0) * 1000) / 10} onChange={(e) => updateNode(node.id, { scrapRate: Math.min(1, Math.max(0, num(e.target.value) / 100)) })} />
                      </label>
                      <label>
                        <span className="label">MTBF (min, 0 = inga fel)</span>
                        <input className="input" type="number" min={0} value={Math.round((node.mtbf ?? 0) / 60)} onChange={(e) => updateNode(node.id, { mtbf: Math.max(0, num(e.target.value)) * 60 })} />
                      </label>
                      <label>
                        <span className="label">MTTR (min)</span>
                        <input className="input" type="number" min={0} value={Math.round((node.mttr ?? 0) / 60)} onChange={(e) => updateNode(node.id, { mttr: Math.max(0, num(e.target.value)) * 60 })} />
                      </label>
                    </div>
                    {(node.mtbf ?? 0) > 0 && (
                      <p className="text-[11.5px] text-[var(--muted)]">
                        Teoretisk tillgänglighet: {Math.round(((node.mtbf ?? 0) / ((node.mtbf ?? 0) + (node.mttr ?? 0))) * 1000) / 10} %
                      </p>
                    )}
                    {node.kind === "assembly" && <p className="text-[11.5px] text-[var(--muted)]">Montering väntar tills en detalj från varje inflöde finns (kit) och slår ihop dem till en.</p>}
                  </>
                )}

                {node.kind !== "sink" && model.edges.filter((e) => e.from === node.id).length > 1 && (
                  <label className="block">
                    <span className="label">Fördelning till efterföljare</span>
                    <select className="input" value={node.routing ?? "roundRobin"} onChange={(e) => updateNode(node.id, { routing: e.target.value as ModelNode["routing"] })}>
                      <option value="roundRobin">Turordning (round robin)</option>
                      <option value="shortestQueue">Kortast kö</option>
                      <option value="first">Prioritet (första lediga)</option>
                      <option value="random">Slumpmässig</option>
                    </select>
                  </label>
                )}

                <div className="border-t border-[var(--border)] pt-3 text-[12px] text-[var(--muted)]">
                  <div>In: {model.edges.filter((e) => e.to === node.id).map((e) => model.nodes.find((n) => n.id === e.from)?.name).join(", ") || "–"}</div>
                  <div>Ut: {model.edges.filter((e) => e.from === node.id).map((e) => model.nodes.find((n) => n.id === e.to)?.name).join(", ") || "–"}</div>
                </div>
                <button className="btn" onClick={() => {
                  const c = clone(node);
                  c.id = uid(node.kind[0]);
                  c.name = `${node.name} (kopia)`;
                  c.y += 90;
                  setModel({ ...model, nodes: [...model.nodes, c] });
                  setSelected(c.id);
                }}>⧉ Duplicera</button>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
