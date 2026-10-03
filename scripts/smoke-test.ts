import { simulate } from "../src/lib/sim/engine.ts";
import { PRESETS, DEFAULT_RUN } from "../src/lib/sim/presets.ts";
import { replicate } from "../src/lib/sim/analysis.ts";

let failed = false;
for (const p of PRESETS) {
  const t0 = Date.now();
  const r = simulate(p.model, DEFAULT_RUN);
  const ms = Date.now() - t0;
  console.log(
    `${p.label.padEnd(24)} ut=${r.totalOutput} tp=${r.throughputPerHour.toFixed(1)}/h wip=${r.avgWip.toFixed(1)} lt=${(r.avgLeadTime / 60).toFixed(1)}min little=${(r.littleLeadTime / 60).toFixed(1)}min flaskhals=${r.bottleneckId} events=${r.events} ${ms}ms`,
  );
  for (const s of r.stations) {
    const sum = s.working + s.waiting + s.blocked + s.failed;
    if (Math.abs(sum - 1) > 1e-6) { console.error("tillståndsandelar summerar ej till 1", s); failed = true; }
  }
  if (r.totalOutput <= 0) { console.error("ingen produktion", p.id); failed = true; }
  const rep = replicate(p.model, DEFAULT_RUN, 5);
  console.log(`   5 repl: tp=${rep.throughput.mean.toFixed(1)} ± ${rep.throughput.ci.toFixed(1)}`);
}
if (failed) process.exit(1);
console.log("OK");
