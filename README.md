# PlantFlow – fabriksflödessimulering

Webbapp (Next.js + React + TypeScript) för att simulera, analysera och optimera
materialflöden genom en fabrik med en eller flera linjer – i stil med Plant Simulation.

## Funktioner

- **Dashboard** – KPI:er (genomflöde med 95 % KI, ledtid, PIA, OEE), flödeskarta med
  flödesvolymer, stationstillstånd (arbetar/väntar/blockerad/stopp), flaskhalsanalys
  (aktiv-period-metoden), buffertbeläggning, ledtidsfördelning och automatiska förbättringsförslag.
- **Live-simulering** – animerat fabriksgolv där detaljer flyttas mellan stationer i realtid,
  maskinstatus per maskin, momentan flaskhals och trenddiagram. Hastighet 1×–600×.
- **Modell & layout** – grafisk editor: källor, buffertar/transportörer, stationer,
  monteringsstationer (kitting) och utlopp. Cykeltidsfördelningar, MTBF/MTTR, kassation,
  parallella maskiner, routingregler, flera linjer. Import/export som JSON.
- **Analys & scenarier** – parameterstudier med replikeringar och konfidensintervall,
  samt jämförelse av sparade scenarier.
- **Optimering** – simulerad glödgning över buffertstorlekar och maskinantal med
  ekonomisk målfunktion (täckningsbidrag − kostnader) och krav på minsta genomflöde.

All simulering körs i webbläsaren i en Web Worker (diskret händelsestyrd motor i
`src/lib/sim`), så sidan kan hostas statiskt. Motorn är ren TypeScript och kan även köras i Node.

## Kom igång

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # röktest av simuleringsmotorn i Node
npm run build      # statisk export till ./out
```

Deploy: varje push till `main` bygger sidan och publicerar den på branchen `gh-pages`
(`.github/workflows/deploy.yml`). Aktivera en gång under Settings → Pages → Deploy from a branch → `gh-pages` / `(root)`.
Live: https://gigacook.github.io/3d-geo-encoder-/
