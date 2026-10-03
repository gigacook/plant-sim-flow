// Diskret händelsestyrd simulering (DES) av materialflöde genom en fabrik.
// Semantik: blockering efter bearbetning, FIFO-buffertar med valfri transporttid,
// tidsbaserade stopp (MTBF/MTTR, preemptivt återupptagande), montering (kitting)
// och flaskhalsanalys enligt aktiv-period-metoden.

import { Rng } from "./random.ts";
import type {
  BufferStats,
  Model,
  ModelEdge,
  ModelNode,
  RunConfig,
  RunResult,
  SeriesPoint,
  ServerState,
  SinkStats,
  SourceStats,
  StationStats,
} from "./types.ts";

interface Part {
  id: number;
  created: number;
}

type EvType = "arrival" | "complete" | "fail" | "repair" | "bufferReady" | "sample" | "warmup" | "end";

interface Ev {
  t: number;
  seq: number;
  type: EvType;
  node: number;
  server: number;
  token: number;
}

class Heap {
  private a: Ev[] = [];
  get size() {
    return this.a.length;
  }
  peek(): Ev | undefined {
    return this.a[0];
  }
  private less(x: Ev, y: Ev) {
    return x.t < y.t || (x.t === y.t && x.seq < y.seq);
  }
  push(e: Ev) {
    const a = this.a;
    a.push(e);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(a[i], a[p])) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }
  pop(): Ev | undefined {
    const a = this.a;
    if (a.length === 0) return undefined;
    const top = a[0];
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && this.less(a[l], a[m])) m = l;
        if (r < a.length && this.less(a[r], a[m])) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
}

interface Server {
  state: Exclude<ServerState, "failed">;
  part: Part | null;
  until: number;
  remaining: number;
  token: number;
  since: number;
  readySince: number;
}

interface RT {
  idx: number;
  node: ModelNode;
  out: { edge: ModelEdge; target: number }[];
  preds: string[];
  rr: number;
  // källa
  pending: Part | null;
  pendingSince: number;
  created: number;
  blockedTime: number;
  // buffert
  queue: { part: Part; readyAt: number; enteredAt: number }[];
  levelArea: number;
  levelSince: number;
  maxLevel: number;
  fullTime: number;
  emptyTime: number;
  waitSum: number;
  waitN: number;
  readyScheduled: number;
  // station
  servers: Server[];
  failed: boolean;
  failToken: number;
  kit: Map<string, Part>;
  acc: Record<ServerState, number>;
  processed: number;
  scrapped: number;
  activeSince: number | null;
  activeSum: number;
  activeN: number;
  bottleneckTime: number;
  // utlopp
  count: number;
  leadSum: number;
}

export interface MoveEvent {
  t: number;
  from: string;
  to: string;
  edge: string;
}

export interface NodeSnapshot {
  id: string;
  kind: ModelNode["kind"];
  /** Station: tillstånd per maskin. */
  servers?: ServerState[];
  failed?: boolean;
  level?: number;
  capacity?: number;
  blocked?: boolean;
  count?: number;
  kit?: number;
  kitSize?: number;
  bottleneck?: boolean;
  utilization?: number;
}

export interface Snapshot {
  t: number;
  wip: number;
  output: number;
  scrap: number;
  nodes: Record<string, NodeSnapshot>;
}

const isStation = (k: ModelNode["kind"]) => k === "station" || k === "assembly";

export class Simulation {
  readonly model: Model;
  readonly cfg: RunConfig;
  t = 0;
  private rng: Rng;
  private failRng: Rng;
  private q = new Heap();
  private seq = 0;
  private nodes: RT[] = [];
  private byId = new Map<string, RT>();
  private partSeq = 0;
  private wip = 0;
  private wipArea = 0;
  private wipSince = 0;
  private statStart = 0;
  private output = 0;
  private scrap = 0;
  private lastSampleOutput = 0;
  private leadTimes: number[] = [];
  private edgeFlow: Record<string, number> = {};
  private series: SeriesPoint[] = [];
  private bnLast = 0;
  private bnCurrent: RT | null = null;
  private events = 0;
  private finished = false;
  /** Logg över förflyttningar (för animering). Töms av konsumenten. */
  moves: MoveEvent[] = [];
  trackMoves = false;

  constructor(model: Model, cfg: RunConfig) {
    this.model = model;
    this.cfg = cfg;
    this.rng = new Rng(cfg.seed);
    this.failRng = new Rng(cfg.seed * 7919 + 17);

    model.nodes.forEach((node, idx) => {
      const servers = isStation(node.kind) ? Math.max(1, Math.round(node.servers ?? 1)) : 0;
      const rt: RT = {
        idx,
        node,
        out: [],
        preds: [],
        rr: 0,
        pending: null,
        pendingSince: 0,
        created: 0,
        blockedTime: 0,
        queue: [],
        levelArea: 0,
        levelSince: 0,
        maxLevel: 0,
        fullTime: 0,
        emptyTime: 0,
        waitSum: 0,
        waitN: 0,
        readyScheduled: -1,
        servers: Array.from({ length: servers }, () => ({
          state: "idle" as const,
          part: null,
          until: 0,
          remaining: 0,
          token: 0,
          since: 0,
          readySince: 0,
        })),
        failed: false,
        failToken: 0,
        kit: new Map(),
        acc: { idle: 0, busy: 0, blocked: 0, failed: 0 },
        processed: 0,
        scrapped: 0,
        activeSince: null,
        activeSum: 0,
        activeN: 0,
        bottleneckTime: 0,
        count: 0,
        leadSum: 0,
      };
      this.nodes.push(rt);
      this.byId.set(node.id, rt);
    });
    for (const e of model.edges) {
      const a = this.byId.get(e.from);
      const b = this.byId.get(e.to);
      if (!a || !b || a === b) continue;
      a.out.push({ edge: e, target: b.idx });
      b.preds.push(a.node.id);
      this.edgeFlow[e.id] = 0;
    }

    for (const rt of this.nodes) {
      if (rt.node.kind === "source") this.schedule(0, "arrival", rt.idx);
      if (isStation(rt.node.kind) && (rt.node.mtbf ?? 0) > 0) {
        this.schedule(this.failRng.exp(rt.node.mtbf!), "fail", rt.idx);
      }
    }
    if (cfg.warmup > 0) this.schedule(cfg.warmup, "warmup", -1);
    this.schedule(cfg.warmup + cfg.sampleInterval, "sample", -1);
    this.schedule(cfg.warmup + cfg.duration, "end", -1);
  }

  get endTime() {
    return this.cfg.warmup + this.cfg.duration;
  }

  get done() {
    return this.finished;
  }

  private schedule(t: number, type: EvType, node: number, server = -1, token = 0) {
    this.q.push({ t, seq: this.seq++, type, node, server, token });
  }

  // ---------- Statistik-hjälpare ----------

  private accountStation(rt: RT) {
    for (const s of rt.servers) {
      const st: ServerState = rt.failed ? "failed" : s.state;
      rt.acc[st] += this.t - s.since;
      s.since = this.t;
    }
  }

  private accountBuffer(rt: RT) {
    const dt = this.t - rt.levelSince;
    const n = rt.queue.length;
    rt.levelArea += n * dt;
    if (n >= (rt.node.capacity ?? 1)) rt.fullTime += dt;
    if (n === 0) rt.emptyTime += dt;
    rt.levelSince = this.t;
  }

  private accountWip(delta: number) {
    this.wipArea += this.wip * (this.t - this.wipSince);
    this.wipSince = this.t;
    this.wip += delta;
  }

  private isActive(rt: RT) {
    if (rt.failed) return true;
    return rt.servers.some((s) => s.state === "busy");
  }

  private updateActivity() {
    let best: RT | null = null;
    for (const rt of this.nodes) {
      if (!isStation(rt.node.kind)) continue;
      const active = this.isActive(rt);
      if (active && rt.activeSince === null) rt.activeSince = this.t;
      else if (!active && rt.activeSince !== null) {
        if (this.t >= this.statStart) {
          rt.activeSum += this.t - Math.max(rt.activeSince, this.statStart);
          rt.activeN++;
        }
        rt.activeSince = null;
      }
      if (rt.activeSince !== null && (best === null || rt.activeSince < best.activeSince!)) best = rt;
    }
    this.bnCurrent = best;
  }

  private accrueBottleneck() {
    if (this.bnCurrent && this.t > this.bnLast) this.bnCurrent.bottleneckTime += this.t - this.bnLast;
    this.bnLast = this.t;
  }

  // ---------- Flödeslogik ----------

  private canAccept(rt: RT, fromId: string): boolean {
    switch (rt.node.kind) {
      case "sink":
        return true;
      case "buffer":
        return rt.queue.length < Math.max(1, rt.node.capacity ?? 1);
      case "station":
        return !rt.failed && rt.servers.some((s) => s.state === "idle");
      case "assembly":
        return !rt.failed && !rt.kit.has(fromId);
      default:
        return false;
    }
  }

  private occupancy(rt: RT): number {
    switch (rt.node.kind) {
      case "buffer":
        return rt.queue.length / Math.max(1, rt.node.capacity ?? 1);
      case "station":
      case "assembly":
        return rt.servers.filter((s) => s.state !== "idle").length / rt.servers.length;
      default:
        return 0;
    }
  }

  private startProcess(rt: RT, s: Server, part: Part) {
    this.accountStation(rt);
    s.state = "busy";
    s.part = part;
    s.token++;
    const d = this.rng.sample(rt.node.processTime);
    s.until = this.t + d;
    this.schedule(s.until, "complete", rt.idx, rt.servers.indexOf(s), s.token);
  }

  private accept(rt: RT, part: Part, fromId: string) {
    switch (rt.node.kind) {
      case "sink": {
        const lt = this.t - part.created;
        this.accountWip(-1);
        if (this.t >= this.statStart) {
          rt.count++;
          rt.leadSum += lt;
          this.output++;
          this.leadTimes.push(lt);
        }
        return;
      }
      case "buffer": {
        this.accountBuffer(rt);
        const readyAt = this.t + (rt.node.transitTime ?? 0);
        rt.queue.push({ part, readyAt, enteredAt: this.t });
        rt.maxLevel = Math.max(rt.maxLevel, rt.queue.length);
        if (rt.queue.length === 1 && readyAt > this.t) this.scheduleBufferReady(rt, readyAt);
        return;
      }
      case "station": {
        const s = rt.servers.find((x) => x.state === "idle")!;
        this.startProcess(rt, s, part);
        return;
      }
      case "assembly": {
        rt.kit.set(fromId, part);
        return;
      }
    }
  }

  private scheduleBufferReady(rt: RT, at: number) {
    if (rt.readyScheduled === at) return;
    rt.readyScheduled = at;
    this.schedule(at, "bufferReady", rt.idx);
  }

  private tryStartAssembly(rt: RT): boolean {
    if (rt.failed || rt.preds.length === 0 || rt.kit.size < rt.preds.length) return false;
    const s = rt.servers.find((x) => x.state === "idle");
    if (!s) return false;
    let created = Infinity;
    for (const p of rt.kit.values()) created = Math.min(created, p.created);
    this.accountWip(-(rt.kit.size - 1));
    rt.kit.clear();
    this.startProcess(rt, s, { id: ++this.partSeq, created });
    return true;
  }

  private chooseTarget(rt: RT, fromId: string): { edge: ModelEdge; target: RT } | null {
    const options = rt.out
      .map((o) => ({ edge: o.edge, target: this.nodes[o.target] }))
      .filter((o) => this.canAccept(o.target, fromId));
    if (options.length === 0) return null;
    if (options.length === 1) return options[0];
    switch (rt.node.routing ?? "roundRobin") {
      case "first":
        return options[0];
      case "random":
        return options[Math.floor(this.rng.next() * options.length)];
      case "shortestQueue": {
        let best = options[0];
        let bo = this.occupancy(best.target);
        for (const o of options) {
          const oc = this.occupancy(o.target);
          if (oc < bo) {
            best = o;
            bo = oc;
          }
        }
        return best;
      }
      case "roundRobin":
      default: {
        const n = rt.out.length;
        for (let k = 0; k < n; k++) {
          const cand = rt.out[(rt.rr + k) % n];
          const hit = options.find((o) => o.edge.id === cand.edge.id);
          if (hit) {
            rt.rr = (rt.rr + k + 1) % n;
            return hit;
          }
        }
        return options[0];
      }
    }
  }

  private recordMove(rt: RT, edge: ModelEdge) {
    if (this.t >= this.statStart) this.edgeFlow[edge.id]++;
    if (this.trackMoves) this.moves.push({ t: this.t, from: rt.node.id, to: edge.to, edge: edge.id });
  }

  private propagate() {
    for (let guard = 0; guard < 100000; guard++) {
      const cands: { rt: RT; since: number; server: number }[] = [];
      for (const rt of this.nodes) {
        switch (rt.node.kind) {
          case "source":
            if (rt.pending) cands.push({ rt, since: rt.pendingSince, server: -1 });
            break;
          case "buffer": {
            const f = rt.queue[0];
            if (f && f.readyAt <= this.t) cands.push({ rt, since: Math.max(f.readyAt, f.enteredAt), server: -1 });
            break;
          }
          case "station":
          case "assembly":
            if (rt.failed) break;
            rt.servers.forEach((s, i) => {
              if (s.state === "blocked") cands.push({ rt, since: s.readySince, server: i });
            });
            break;
        }
      }
      cands.sort((a, b) => a.since - b.since);
      let moved = false;
      for (const c of cands) {
        const rt = c.rt;
        let part: Part | null = null;
        if (rt.node.kind === "source") part = rt.pending;
        else if (rt.node.kind === "buffer") part = rt.queue[0]?.part ?? null;
        else part = rt.servers[c.server].part;
        if (!part) continue;
        const choice = this.chooseTarget(rt, rt.node.id);
        if (!choice) continue;

        // Ta bort detaljen från ursprunget
        if (rt.node.kind === "source") {
          rt.blockedTime += Math.max(0, this.t - Math.max(rt.pendingSince, this.statStart));
          rt.pending = null;
          part.created = this.t;
          this.accountWip(+1);
          const limit = rt.node.limit ?? 0;
          if (limit === 0 || rt.created < limit) {
            this.schedule(this.t + this.rng.sample(rt.node.interarrival), "arrival", rt.idx);
          }
        } else if (rt.node.kind === "buffer") {
          this.accountBuffer(rt);
          const item = rt.queue.shift()!;
          if (this.t >= this.statStart) {
            rt.waitSum += this.t - item.enteredAt;
            rt.waitN++;
          }
          const nf = rt.queue[0];
          if (nf && nf.readyAt > this.t) this.scheduleBufferReady(rt, nf.readyAt);
        } else {
          this.accountStation(rt);
          const s = rt.servers[c.server];
          s.state = "idle";
          s.part = null;
        }
        this.recordMove(rt, choice.edge);
        this.accept(choice.target, part, rt.node.id);
        moved = true;
      }
      for (const rt of this.nodes) {
        if (rt.node.kind === "assembly" && this.tryStartAssembly(rt)) moved = true;
      }
      if (!moved) break;
    }
  }

  // ---------- Händelser ----------

  private handle(e: Ev) {
    const rt = e.node >= 0 ? this.nodes[e.node] : null;
    switch (e.type) {
      case "arrival": {
        const r = rt!;
        r.pending = { id: ++this.partSeq, created: this.t };
        r.pendingSince = this.t;
        r.created++;
        break;
      }
      case "complete": {
        const r = rt!;
        const s = r.servers[e.server];
        if (s.token !== e.token || s.state !== "busy" || r.failed) return;
        this.accountStation(r);
        if (this.t >= this.statStart) r.processed++;
        if ((r.node.scrapRate ?? 0) > 0 && this.rng.next() < r.node.scrapRate!) {
          if (this.t >= this.statStart) {
            r.scrapped++;
            this.scrap++;
          }
          this.accountWip(-1);
          s.state = "idle";
          s.part = null;
        } else {
          s.state = "blocked";
          s.readySince = this.t;
        }
        break;
      }
      case "fail": {
        const r = rt!;
        this.accountStation(r);
        r.failed = true;
        r.failToken++;
        for (const s of r.servers) {
          if (s.state === "busy") {
            s.remaining = s.until - this.t;
            s.token++;
          }
        }
        this.schedule(this.t + this.failRng.exp(r.node.mttr ?? 0), "repair", r.idx, -1, r.failToken);
        break;
      }
      case "repair": {
        const r = rt!;
        if (e.token !== r.failToken) return;
        this.accountStation(r);
        r.failed = false;
        r.servers.forEach((s, i) => {
          if (s.state === "busy") {
            s.until = this.t + s.remaining;
            s.token++;
            this.schedule(s.until, "complete", r.idx, i, s.token);
          }
        });
        this.schedule(this.t + this.failRng.exp(r.node.mtbf ?? 0), "fail", r.idx);
        break;
      }
      case "bufferReady":
        rt!.readyScheduled = -1;
        break;
      case "warmup":
        this.resetStats();
        return;
      case "sample":
        this.takeSample();
        this.schedule(this.t + this.cfg.sampleInterval, "sample", -1);
        return;
      case "end":
        this.finished = true;
        return;
    }
    this.propagate();
  }

  private resetStats() {
    this.statStart = this.t;
    this.accountWip(0);
    this.wipArea = 0;
    this.output = 0;
    this.scrap = 0;
    this.lastSampleOutput = 0;
    this.leadTimes = [];
    for (const k of Object.keys(this.edgeFlow)) this.edgeFlow[k] = 0;
    for (const rt of this.nodes) {
      if (isStation(rt.node.kind)) {
        this.accountStation(rt);
        rt.acc = { idle: 0, busy: 0, blocked: 0, failed: 0 };
        rt.processed = 0;
        rt.scrapped = 0;
        rt.activeSum = 0;
        rt.activeN = 0;
        rt.bottleneckTime = 0;
      }
      if (rt.node.kind === "buffer") {
        this.accountBuffer(rt);
        rt.levelArea = 0;
        rt.fullTime = 0;
        rt.emptyTime = 0;
        rt.maxLevel = rt.queue.length;
        rt.waitSum = 0;
        rt.waitN = 0;
      }
      if (rt.node.kind === "source") rt.blockedTime = 0;
      if (rt.node.kind === "sink") {
        rt.count = 0;
        rt.leadSum = 0;
      }
    }
  }

  private takeSample() {
    const buffers: Record<string, number> = {};
    for (const rt of this.nodes) if (rt.node.kind === "buffer") buffers[rt.node.id] = rt.queue.length;
    const dOut = this.output - this.lastSampleOutput;
    this.lastSampleOutput = this.output;
    this.series.push({
      t: this.t,
      wip: this.wip,
      output: this.output,
      rate: (dOut * 3600) / this.cfg.sampleInterval,
      buffers,
    });
  }

  /** Kör simuleringen fram till tiden `until` (eller slutet). */
  advanceTo(until: number) {
    const stop = Math.min(until, this.endTime);
    while (!this.finished) {
      const e = this.q.peek();
      if (!e || e.t > stop) break;
      this.q.pop();
      this.t = e.t;
      this.accrueBottleneck();
      this.handle(e);
      this.events++;
      this.updateActivity();
    }
    if (!this.finished) {
      this.t = Math.max(this.t, stop);
      this.accrueBottleneck();
    }
  }

  run(): RunResult {
    this.advanceTo(Infinity);
    return this.result();
  }

  snapshot(): Snapshot {
    const nodes: Record<string, NodeSnapshot> = {};
    for (const rt of this.nodes) {
      const n = rt.node;
      const s: NodeSnapshot = { id: n.id, kind: n.kind };
      if (n.kind === "source") s.blocked = rt.pending !== null && rt.pendingSince < this.t;
      if (n.kind === "buffer") {
        s.level = rt.queue.length;
        s.capacity = n.capacity ?? 1;
      }
      if (isStation(n.kind)) {
        s.servers = rt.servers.map((x) => (rt.failed ? "failed" : x.state));
        s.failed = rt.failed;
        s.bottleneck = this.bnCurrent === rt;
        const tot = rt.acc.idle + rt.acc.busy + rt.acc.blocked + rt.acc.failed;
        s.utilization = tot > 0 ? rt.acc.busy / tot : 0;
        if (n.kind === "assembly") {
          s.kit = rt.kit.size;
          s.kitSize = rt.preds.length;
        }
      }
      if (n.kind === "sink") s.count = rt.count;
      nodes[n.id] = s;
    }
    return { t: this.t, wip: this.wip, output: this.output, scrap: this.scrap, nodes };
  }

  result(): RunResult {
    // Avsluta pågående ackumulatorer
    for (const rt of this.nodes) {
      if (isStation(rt.node.kind)) this.accountStation(rt);
      if (rt.node.kind === "buffer") this.accountBuffer(rt);
    }
    this.accountWip(0);
    const T = Math.max(1e-9, this.t - this.statStart);

    const stations: StationStats[] = [];
    const buffers: BufferStats[] = [];
    const sources: SourceStats[] = [];
    const sinks: SinkStats[] = [];
    for (const rt of this.nodes) {
      const n = rt.node;
      if (isStation(n.kind)) {
        const tot = Math.max(1e-9, rt.acc.idle + rt.acc.busy + rt.acc.blocked + rt.acc.failed);
        const working = rt.acc.busy / tot;
        const failed = rt.acc.failed / tot;
        const availability = 1 - failed;
        const performance = availability > 0 ? working / availability : 0;
        const quality = rt.processed > 0 ? (rt.processed - rt.scrapped) / rt.processed : 1;
        let activeSum = rt.activeSum;
        let activeN = rt.activeN;
        if (rt.activeSince !== null) {
          activeSum += this.t - Math.max(rt.activeSince, this.statStart);
          activeN++;
        }
        stations.push({
          id: n.id,
          name: n.name,
          lineId: n.lineId,
          kind: n.kind,
          servers: rt.servers.length,
          working,
          waiting: rt.acc.idle / tot,
          blocked: rt.acc.blocked / tot,
          failed,
          processed: rt.processed,
          scrapped: rt.scrapped,
          availability,
          performance,
          quality,
          oee: availability * performance * quality,
          bottleneckShare: rt.bottleneckTime / T,
          meanActivePeriod: activeN > 0 ? activeSum / activeN : 0,
        });
      } else if (n.kind === "buffer") {
        buffers.push({
          id: n.id,
          name: n.name,
          lineId: n.lineId,
          capacity: n.capacity ?? 1,
          avgLevel: rt.levelArea / T,
          maxLevel: rt.maxLevel,
          fullShare: rt.fullTime / T,
          emptyShare: rt.emptyTime / T,
          avgWait: rt.waitN > 0 ? rt.waitSum / rt.waitN : 0,
        });
      } else if (n.kind === "source") {
        const blocked = rt.blockedTime + (rt.pending ? this.t - Math.max(rt.pendingSince, this.statStart) : 0);
        sources.push({ id: n.id, name: n.name, lineId: n.lineId, created: rt.created, blockedShare: Math.max(0, blocked) / T });
      } else if (n.kind === "sink") {
        sinks.push({
          id: n.id,
          name: n.name,
          lineId: n.lineId,
          count: rt.count,
          throughputPerHour: (rt.count * 3600) / T,
          avgLeadTime: rt.count > 0 ? rt.leadSum / rt.count : 0,
        });
      }
    }

    const lts = [...this.leadTimes].sort((a, b) => a - b);
    const q = (p: number) => (lts.length ? lts[Math.min(lts.length - 1, Math.floor(p * lts.length))] : 0);
    const avgLead = lts.length ? lts.reduce((a, b) => a + b, 0) / lts.length : 0;
    const throughputPerHour = (this.output * 3600) / T;
    const avgWip = this.wipArea / T;

    let bottleneck: StationStats | null = null;
    for (const s of stations) {
      if (!bottleneck || s.bottleneckShare > bottleneck.bottleneckShare) bottleneck = s;
    }

    // Histogram över ledtid
    const hist: RunResult["leadTimeHistogram"] = [];
    if (lts.length) {
      const lo = lts[0];
      const hi = lts[lts.length - 1];
      const bins = 20;
      const w = Math.max(1, (hi - lo) / bins);
      for (let i = 0; i < bins; i++) hist.push({ from: lo + i * w, to: lo + (i + 1) * w, count: 0 });
      for (const v of lts) hist[Math.min(bins - 1, Math.floor((v - lo) / w))].count++;
    }

    return {
      duration: T,
      throughputPerHour,
      totalOutput: this.output,
      totalScrap: this.scrap,
      avgWip,
      avgLeadTime: avgLead,
      p50LeadTime: q(0.5),
      p95LeadTime: q(0.95),
      littleLeadTime: throughputPerHour > 0 ? (avgWip / throughputPerHour) * 3600 : 0,
      oee: bottleneck ? bottleneck.oee : 0,
      bottleneckId: bottleneck && bottleneck.bottleneckShare > 0 ? bottleneck.id : null,
      stations,
      buffers,
      sources,
      sinks,
      edgeFlow: { ...this.edgeFlow },
      series: this.series,
      leadTimeHistogram: hist,
      events: this.events,
    };
  }
}

export function simulate(model: Model, cfg: RunConfig): RunResult {
  return new Simulation(model, cfg).run();
}
