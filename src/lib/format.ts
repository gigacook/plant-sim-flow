const nf1 = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 });

export const num = (x: number, d = 1) =>
  d === 0 ? nf0.format(x) : new Intl.NumberFormat("sv-SE", { maximumFractionDigits: d, minimumFractionDigits: d }).format(x);
export const n1 = (x: number) => nf1.format(x);
export const n0 = (x: number) => nf0.format(x);
export const pct = (x: number, d = 0) => `${num(x * 100, d)} %`;

/** Tid i sekunder → läsbar text. */
export function dur(sec: number): string {
  if (!isFinite(sec)) return "–";
  if (sec < 90) return `${nf0.format(sec)} s`;
  if (sec < 5400) return `${nf1.format(sec / 60)} min`;
  return `${nf1.format(sec / 3600)} h`;
}

export function clock(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
