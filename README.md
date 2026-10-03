# PlantFlow – Factory Flow Simulation

PlantFlow is a web app for simulating, analysing and optimising material flow through a factory with one or more production lines. It is inspired by Siemens Plant Simulation, but much simpler, and it runs entirely in the browser.

You build a model of the factory (sources, buffers, stations, assembly stations, sinks) and run a discrete-event simulation. The app then shows dashboards with KPIs, bottleneck analysis, scenario comparisons and automatic optimisation. The UI is in Swedish and uses a dark theme.

- **Live:** https://gigacook.github.io/plant-sim-flow/
- **Source code:** `main`
- **Deploy:** GitHub Actions builds on every push to `main` and publishes the static site to the `gh-pages` branch, which GitHub Pages serves.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # smoke test of the simulation engine in Node
npm run build      # static export to ./out
```

## Tech stack

- Next.js 15 (App Router) with static export (`output: "export"`), React 19, TypeScript
- Tailwind CSS v4 for styling
- Recharts 2.15 for charts
- Zustand (persisted to localStorage) for state
- No backend: all simulation runs in a Web Worker in the browser.
- The simulation engine is dependency-free TypeScript and also runs in Node (`scripts/smoke-test.ts`).
- `basePath` is taken from the repository name at build time (`NEXT_PUBLIC_BASE_PATH`).

## Code structure

| Path | Purpose |
|---|---|
| `src/lib/sim/types.ts` | Model and result types |
| `src/lib/sim/engine.ts` | Discrete-event simulation engine (`Simulation` class, `simulate()`) |
| `src/lib/sim/random.ts` | Seedable PRNG (mulberry32) and distributions |
| `src/lib/sim/presets.ts` | Three ready-made factory models and the default run settings |
| `src/lib/sim/analysis.ts` | Replications, confidence intervals, parameter sweeps, run averaging, rule-based insights |
| `src/lib/sim/optimize.ts` | Simulated annealing over buffer sizes and machine counts |
| `src/lib/sim/worker.ts` | Web Worker that runs replicate / sweep / optimize jobs |
| `src/lib/sim/client.ts` | Promise API for the worker (`runJob`, `stopJobs`) |
| `src/lib/store/` | Zustand store (model, run settings, scenarios) and the `useRun` hook |
| `src/components/` | `FactoryCanvas` (SVG layout), charts, UI components, shell/navigation |
| `src/app/` | Pages: `/` (dashboard), `/live`, `/modell`, `/analys`, `/optimering` |

## Data model

- `Model = { name, lines[], nodes[], edges[] }`
- `Line = { id, name, color }`
- `Edge = { id, from, to }`: a directed connection between two nodes
- `Node = { id, name, kind, lineId, x, y, ...parameters }`

Node kinds:

- **source**: generates parts.
  - `interarrival`: time between arrivals, as a distribution in seconds.
  - `limit`: maximum number of parts (0 = unlimited).
  - A constant interarrival of 0 means unlimited supply, so the line sets the pace.
- **buffer**: a buffer or conveyor, FIFO.
  - `capacity`: number of slots.
  - `transitTime`: minimum time a part spends in it, in seconds.
- **station**: a machine or workstation.
  - `servers`: number of parallel machines.
  - `processTime`: cycle time, as a distribution.
  - `mtbf` / `mttr`: time-based failures, in seconds.
  - `scrapRate`: share of parts scrapped (0..1).
- **assembly**: like a station, but waits for one part from *every* incoming edge (a kit) and merges them into one part.
- **sink**: counts finished parts and records their lead times.

Routing when a node has several outgoing edges: `roundRobin`, `shortestQueue`, `first` (priority) or `random`.

Distributions: `const`, `exp`, `normal` (truncated at 0), `tri` (triangular), `uniform`. All times are in seconds.

## Simulation engine semantics

- Discrete-event simulation with a binary-heap event queue.
- Event types: `arrival`, `complete`, `fail`, `repair`, `bufferReady`, `sample`, `warmup`, `end`.
- Blocking after service: a finished part stays on its machine until the next node downstream can accept it.
- Propagation after each event: every node with a part ready to leave is sorted by how long it has waited, so merges are served first-come-first-served. Parts are then moved until nothing more can move.
- Sources block when downstream is full. The next arrival is scheduled only after the waiting part has left the source.
- Failures:
  - Failures are time-based, with exponentially distributed MTBF and MTTR, and stop the whole station.
  - Processing in progress pauses during a failure and resumes afterwards (preemptive resume).
  - A finished part cannot leave a station that is down.
- Scrap is drawn at random when processing completes.
- Warm-up period: all statistics are reset at the warm-up time.
- Process and failure events use separate seedable random streams. This makes runs reproducible and enables common random numbers (CRN) when comparing configurations.
- Performance: 8 simulated hours take about 40–100 ms per run.

## Outputs and KPIs (`RunResult`)

- **Throughput and output:** throughput (parts/h), total output, scrap.
- **Lead time:** mean, P50, P95 and a histogram. Little's law (WIP / throughput) is shown for comparison.
- **WIP:** time-weighted mean and a time series.
- **Per station:**
  - Share of time working, waiting (starved), blocked and down.
  - Parts processed and scrapped.
  - OEE = availability × performance × quality.
- **Bottleneck:** detected with the active-period method (Roser).
  - The station whose current active period has lasted longest is the momentary bottleneck. Its share of time is accumulated.
  - This is simplified: only "sole" bottlenecks are tracked, not shifting ones.
- **Per buffer:** average level, maximum level, share of time full, share of time empty, average waiting time.
- **Per source:** parts created and share of time blocked.
- **Per sink:** count, throughput and mean lead time.
- **Flow per edge:** number of parts, used for the flow map.
- **Time series:** sampled at fixed intervals (WIP, cumulative output, output rate, buffer levels).

## Analysis

- **Replications:** runs with different seeds, reported as mean ± 95 % confidence interval (Student's t).
- **`averageRuns`:** averages station, buffer and flow statistics across replications.
- **Parameter sweep:** varies one parameter of one object over a range.
  - Parameters: buffer capacity, machine count, cycle-time factor, interarrival factor, MTBF, MTTR.
  - Results: throughput, lead time and WIP, each with a confidence band.
- **Rule-based insights** flag:
  - the bottleneck, and low availability in the bottleneck
  - blocked stations (> 15 %) and starved stations (> 45 %)
  - buffers that are often full
  - capacity-limited inflow

## Optimisation

- **Decision variables:** buffer capacity and/or machine count per station, with a min/max per variable.
- **Objective:** profit/h = contribution margin × throughput − buffer slots × cost/h − machines × cost/h. A penalty applies when throughput falls below a required minimum.
- **Algorithm:** simulated annealing.
  - Geometric cooling.
  - Neighbours change 1–2 variables by a random step.
  - Evaluated configurations are cached.
  - Each candidate is evaluated with N replications using CRN.
- **Shown live:** convergence curve, throughput-vs-cost scatter plot, and the recommended configuration compared with the current one. "Apply to model" copies the result into the model.

## Pages

1. **Dashboard (`/`)**
   - Run settings: model template, run length, warm-up, replications, seed.
   - KPI row: throughput ± CI, output, lead time (P95), WIP (Little), OEE of the bottleneck, bottleneck station.
   - SVG flow map: edge width shows flow volume, each station has a state bar, the bottleneck is highlighted, and hovering shows details.
   - Charts: station states (stacked 100 % bars), bottleneck share, throughput over time, WIP over time, buffer utilisation, lead-time histogram.
   - Insights list, station table with the OEE breakdown, and "Save as scenario".
2. **Live simulation (`/live`)**
   - The simulation runs in real time on the main thread (`requestAnimationFrame`).
   - Controls: speed 1×–600×, pause, reset, +1 h.
   - Visuals: animated parts moving along edges, a state colour per station, one status dot per machine, buffer fill levels, and a pulsing frame on the momentary bottleneck.
   - Station status panel and trend charts (output rate, WIP).
3. **Model & layout (`/modell`)**
   - Visual editor:
     - add nodes of each kind
     - drag to move nodes (10 px grid)
     - connect mode: click a start node, then a target
     - delete a node or connection
     - duplicate a node
   - Property panel per node kind, with a distribution editor.
   - Line management (name, colour), model validation (missing inflow or outflow, etc.), and JSON import/export.
4. **Analysis & scenarios (`/analys`)**
   - Parameter sweep: three charts (throughput, lead time, WIP) with CI bands, plus a results table.
   - Scenario comparison: bar chart with error bars and a table. Saved scenarios can be reloaded or deleted.
5. **Optimisation (`/optimering`)**
   - Variable table, economic parameters, iterations, replications per candidate, start/stop, and live results (see above).

## Built-in templates

- **Single line:** source → storage → OP10 → conveyor → OP20 → conveyor → OP30 → storage.
- **Two lines + packing:** lines A and B (three stations each) merge into a shared packing buffer → packing station → shipping.
- **Assembly:** chassis and engine sub-assembly lines with unlimited supply → assembly station (kit) → final inspection → delivery.

## Visual language

- State colours follow Plant Simulation:
  - green = working
  - grey = waiting/starved
  - yellow = blocked
  - red = down/failed
- Each line has its own colour (blue, orange, green, …).
- Dark theme.
- State colours are always shown with a label or legend.

## Known limitations and simplifications

- **Scope:**
  - No product mix or variants, no setup/changeover times, no shifts or breaks.
  - No operators or staff as a shared resource; no tools or AGVs.
- **Failures:** time-based, not operation-based; MTTR is exponentially distributed.
- **Flow logic:**
  - No rework loops or probability-based routing; scrap removes the part.
  - Assembly takes exactly one part per incoming edge; there is no bill of materials with quantities.
  - Conveyors are modelled as a FIFO buffer with a minimum transit time, not as length and speed.
- **Statistics:**
  - Little's law does not match exactly for assembly, because WIP counts the components before they are merged.
  - The bottleneck method is simplified (no shifting bottlenecks).
- **Platform:**
  - Data is stored only in the browser's localStorage. There is no login, sharing or backend.
  - The layout is 2D only, with no 3D view.
  - Optimisation handles only integer variables (buffer sizes, machine counts).

## Possible directions

- Product variants with their own cycle times, a changeover matrix, sequencing and batching
- Shift calendars, breaks, and staff as a limited resource
- Rework loops and percentage-based routing
- Operation-based failures, Weibull/Erlang distributions, planned maintenance
- A 3D view of the factory floor (e.g. three.js) using the same engine
- Import of real data (CSV/MES) to calibrate cycle times and failures
- Gantt view per station, Sankey diagrams for flows, value stream mapping (VSM)
- More optimisation objectives and algorithms (genetic algorithms, Pareto fronts, line balancing)
- A backend (Node/Vercel) for heavy experiments, model sharing and multiple users
- An AI assistant that reads results and suggests improvements in natural language
- Report export (PDF) and before/after comparison
