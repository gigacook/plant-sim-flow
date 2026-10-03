// Övningsmodeller för undervisning. Studentversionerna (uppgiftstext + modell) är publika;
// facit och lärarhandledning ingår inte i koden.

import { LINE_COLORS } from "./presets.ts";
import type { Model } from "./types.ts";

export interface Exercise {
  id: string;
  title: string;
  minutes: number;
  concepts: string[];
  intro: string;
  tasks: string[];
  model: Model;
}

const line = (id: string, name: string, i = 0) => ({ id, name, color: LINE_COLORS[i] });

const bottleneck: Model = {
  name: "Övning 1 – Hitta flaskhalsen",
  lines: [line("L1", "Linje")],
  nodes: [
    { id: "src", name: "Råmaterial", kind: "source", lineId: "L1", x: 60, y: 200, interarrival: { type: "const", value: 0 } },
    { id: "s1", name: "S1 Kapning", kind: "station", lineId: "L1", x: 230, y: 200, servers: 1, processTime: { type: "tri", min: 36, mode: 40, max: 46 } },
    { id: "b1", name: "Buffert 1", kind: "buffer", lineId: "L1", x: 400, y: 200, capacity: 4 },
    { id: "s2", name: "S2 Borrning", kind: "station", lineId: "L1", x: 570, y: 200, servers: 1, processTime: { type: "tri", min: 44, mode: 48, max: 54 } },
    { id: "b2", name: "Buffert 2", kind: "buffer", lineId: "L1", x: 740, y: 200, capacity: 4 },
    { id: "s3", name: "S3 Gradning", kind: "station", lineId: "L1", x: 910, y: 200, servers: 1, processTime: { type: "tri", min: 40, mode: 44, max: 50 } },
    { id: "b3", name: "Buffert 3", kind: "buffer", lineId: "L1", x: 1080, y: 200, capacity: 4 },
    { id: "s4", name: "S4 Kontroll", kind: "station", lineId: "L1", x: 1250, y: 200, servers: 1, processTime: { type: "tri", min: 34, mode: 38, max: 44 } },
    { id: "sink", name: "Färdigt", kind: "sink", lineId: "L1", x: 1410, y: 200 },
  ],
  edges: [
    { id: "e1", from: "src", to: "s1" },
    { id: "e2", from: "s1", to: "b1" },
    { id: "e3", from: "b1", to: "s2" },
    { id: "e4", from: "s2", to: "b2" },
    { id: "e5", from: "b2", to: "s3" },
    { id: "e6", from: "s3", to: "b3" },
    { id: "e7", from: "b3", to: "s4" },
    { id: "e8", from: "s4", to: "sink" },
  ],
};

const buffers: Model = {
  name: "Övning 2 – Buffertar och variation",
  lines: [line("L1", "Linje")],
  nodes: [
    { id: "src", name: "Råmaterial", kind: "source", lineId: "L1", x: 60, y: 200, interarrival: { type: "const", value: 0 } },
    { id: "m1", name: "M1 Formning", kind: "station", lineId: "L1", x: 260, y: 200, servers: 1, processTime: { type: "tri", min: 35, mode: 50, max: 65 }, mtbf: 1800, mttr: 300 },
    { id: "buf", name: "Mellanbuffert", kind: "buffer", lineId: "L1", x: 470, y: 200, capacity: 1 },
    { id: "m2", name: "M2 Härdning", kind: "station", lineId: "L1", x: 680, y: 200, servers: 1, processTime: { type: "tri", min: 35, mode: 50, max: 65 }, mtbf: 1800, mttr: 300 },
    { id: "sink", name: "Färdigt", kind: "sink", lineId: "L1", x: 880, y: 200 },
  ],
  edges: [
    { id: "e1", from: "src", to: "m1" },
    { id: "e2", from: "m1", to: "buf" },
    { id: "e3", from: "buf", to: "m2" },
    { id: "e4", from: "m2", to: "sink" },
  ],
};

const little: Model = {
  name: "Övning 3 – Beläggning, kö och Littles lag",
  lines: [line("L1", "Cell")],
  nodes: [
    { id: "src", name: "Order", kind: "source", lineId: "L1", x: 60, y: 200, interarrival: { type: "exp", mean: 75 } },
    { id: "q", name: "Orderkö", kind: "buffer", lineId: "L1", x: 280, y: 200, capacity: 500 },
    { id: "cell", name: "Bearbetningscell", kind: "station", lineId: "L1", x: 500, y: 200, servers: 1, processTime: { type: "exp", mean: 60 } },
    { id: "sink", name: "Levererat", kind: "sink", lineId: "L1", x: 720, y: 200 },
  ],
  edges: [
    { id: "e1", from: "src", to: "q" },
    { id: "e2", from: "q", to: "cell" },
    { id: "e3", from: "cell", to: "sink" },
  ],
};

export const EXERCISES: Exercise[] = [
  {
    id: "flaskhals",
    title: "Hitta flaskhalsen",
    minutes: 20,
    concepts: ["Flaskhals", "Kapacitet", "Blockering och svält"],
    intro: "En linje med fyra stationer och obegränsad tillgång på material. Ledningen vill öka genomflödet och har råd att förbättra en station.",
    tasks: [
      "Kör simuleringen. Vilken station är flaskhals, och hur ser du det i tillståndsdiagrammet?",
      "Gissa först: vad händer med genomflödet om S1 får 10 % kortare cykeltid? Om S2 får det? Testa båda.",
      "Förklara resultatet med begreppen blockering och svält. Vilken station blir flaskhals efter förbättringen?",
      "Hur mycket kan genomflödet som mest öka innan nästa station begränsar?",
    ],
    model: bottleneck,
  },
  {
    id: "buffertar",
    title: "Buffertar och variation",
    minutes: 25,
    concepts: ["Variation", "Stopp (MTBF/MTTR)", "Buffertdimensionering"],
    intro: "Två lika snabba maskiner med variation och slumpmässiga stopp. Mellan dem finns en buffert med plats för en detalj.",
    tasks: [
      "Kör simuleringen och notera genomflöde och hur stor del av tiden M1 blockeras och M2 svälter.",
      "Gör en parameterstudie (Analys) av Mellanbuffertens kapacitet från 1 till 20. Rita eller beskriv kurvan.",
      "Var tycker du att det är rimligt att stanna? Motivera med både genomflöde och PIA/ledtid.",
      "Ta bort stoppen (MTBF = 0) och upprepa. Vad säger skillnaden om varför buffertar behövs?",
    ],
    model: buffers,
  },
  {
    id: "little",
    title: "Beläggning, kö och Littles lag",
    minutes: 20,
    concepts: ["Beläggningsgrad", "Kötid", "Littles lag (PIA = genomflöde × ledtid)"],
    intro: "En bearbetningscell som tar emot slumpmässigt inkommande order. Cellen klarar i snitt 60 order per timme.",
    tasks: [
      "Kör simuleringen. Kontrollera Littles lag: stämmer PIA ≈ genomflöde × ledtid?",
      "Ställ körtiden på 40 h. Gör en parameterstudie av Orders ankomstintervall (faktor 1,6 → 0,85). Hur förändras ledtiden när beläggningen närmar sig 100 %?",
      "Varför växer kön så kraftigt nära full beläggning, fast cellen ”hinner med” i genomsnitt?",
      "Vilken beläggningsgrad skulle du rekommendera för cellen, och vad kostar det i ledtid?",
    ],
    model: little,
  },
];
