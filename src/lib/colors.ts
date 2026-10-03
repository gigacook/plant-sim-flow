// Statusfärger (fasta, används alltid med etikett) och mörka diagramtokens.
export const STATE_COLORS = {
  working: "#0ca30c",
  waiting: "#6b6a65",
  blocked: "#fab219",
  failed: "#d03b3b",
} as const;

export const STATE_LABELS = {
  working: "Arbetar",
  waiting: "Väntar (svält)",
  blocked: "Blockerad",
  failed: "Stopp/fel",
} as const;

export const SERVER_COLORS = {
  busy: STATE_COLORS.working,
  idle: STATE_COLORS.waiting,
  blocked: STATE_COLORS.blocked,
  failed: STATE_COLORS.failed,
} as const;

export const SERIES = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];

export const CHART = {
  grid: "#2c2c2a",
  axis: "#383835",
  muted: "#898781",
  text: "#c3c2b7",
  surface: "#1a1a19",
};
