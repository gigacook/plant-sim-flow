import type { Dist } from "./types.ts";

/** Snabb, seedbar PRNG (mulberry32) – ger reproducerbara körningar och gemensamma slumptal (CRN). */
export class Rng {
  private s: number;
  private spare: number | null = null;

  constructor(seed: number) {
    this.s = (seed >>> 0) || 0x9e3779b9;
  }

  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  normal(): number {
    if (this.spare !== null) {
      const v = this.spare;
      this.spare = null;
      return v;
    }
    let u = 0;
    let v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    const r = Math.sqrt(-2 * Math.log(u));
    this.spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  }

  exp(mean: number): number {
    if (mean <= 0) return 0;
    return -mean * Math.log(1 - this.next());
  }

  sample(d: Dist | undefined): number {
    if (!d) return 0;
    switch (d.type) {
      case "const":
        return Math.max(0, d.value);
      case "exp":
        return this.exp(d.mean);
      case "normal":
        return Math.max(0, d.mean + d.sd * this.normal());
      case "uniform":
        return d.min + (d.max - d.min) * this.next();
      case "tri": {
        const { min: a, mode: c, max: b } = d;
        if (b <= a) return a;
        const u = this.next();
        const f = (c - a) / (b - a);
        return u < f ? a + Math.sqrt(u * (b - a) * (c - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - c));
      }
    }
  }
}

export function distMean(d: Dist | undefined): number {
  if (!d) return 0;
  switch (d.type) {
    case "const":
      return d.value;
    case "exp":
      return d.mean;
    case "normal":
      return d.mean;
    case "uniform":
      return (d.min + d.max) / 2;
    case "tri":
      return (d.min + d.mode + d.max) / 3;
  }
}

export function scaleDist(d: Dist, f: number): Dist {
  switch (d.type) {
    case "const":
      return { type: "const", value: d.value * f };
    case "exp":
      return { type: "exp", mean: d.mean * f };
    case "normal":
      return { type: "normal", mean: d.mean * f, sd: d.sd * f };
    case "uniform":
      return { type: "uniform", min: d.min * f, max: d.max * f };
    case "tri":
      return { type: "tri", min: d.min * f, mode: d.mode * f, max: d.max * f };
  }
}

export function describeDist(d: Dist | undefined): string {
  if (!d) return "–";
  const r = (x: number) => (Math.round(x * 10) / 10).toString();
  switch (d.type) {
    case "const":
      return `${r(d.value)} s`;
    case "exp":
      return `Exp(${r(d.mean)} s)`;
    case "normal":
      return `N(${r(d.mean)}, ${r(d.sd)})`;
    case "uniform":
      return `U(${r(d.min)}–${r(d.max)})`;
    case "tri":
      return `Tri(${r(d.min)}, ${r(d.mode)}, ${r(d.max)})`;
  }
}
