// Local MOCK of the Cloudflare Pages setup – no account, no network.
// 1) Runs the Pages Functions against an in-memory KV with simulated, signed provider deliveries.
// 2) Checks that ./out is deployable within Cloudflare Pages free-plan limits and contains no private material.
// Run: npm run build && npm run mock:cloudflare
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { onRequestPost, type Env } from "../cloudflare/functions/api/billing-webhook.ts";
import { onRequestGet } from "../cloudflare/functions/api/access.ts";
import { sign } from "../src/lib/billing/webhook-signature.ts";

let failed = false;
const check = (ok: boolean, label: string) => {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failed = true;
};

// ---------- 1. Functions ----------
const kv = new Map<string, string>();
const env: Env = {
  WEBHOOK_SECRET: "whsec_" + btoa("mock-cloudflare-secret"),
  ENTITLEMENTS: { get: async (k) => kv.get(k) ?? null, put: async (k, v) => void kv.set(k, v) },
};
const base = "https://taktlab.mock.pages.dev";
let n = 0;
async function deliver(type: string, data: Record<string, unknown>, opts: { id?: string; secret?: string; createdAt?: string } = {}) {
  const raw = JSON.stringify({ type, created_at: opts.createdAt ?? new Date().toISOString(), data });
  const id = opts.id ?? `msg_${++n}`;
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = await sign(opts.secret ?? env.WEBHOOK_SECRET, id, ts, raw);
  const res = await onRequestPost({ request: new Request(`${base}/api/billing-webhook`, { method: "POST", body: raw, headers: { "webhook-id": id, "webhook-timestamp": ts, "webhook-signature": `v1,${sig}` } }), env });
  return { status: res.status, text: await res.text() };
}
const access = async (email: string) => (await onRequestGet({ request: new Request(`${base}/api/access?email=${encodeURIComponent(email)}`), env })).json() as Promise<{ status: string; access: boolean }>;
const P = { product_id: "prod_mock_teacher_kit", customer_email: "teacher@example.invalid" };
const until = new Date(Date.now() + 365 * 864e5).toISOString();

const origLog = console.log;
console.log = (...a: unknown[]) => (typeof a[0] === "string" && a[0].startsWith('{"webhook"') ? undefined : origLog(...a));
check((await deliver("checkout.created", P)).text === "applied", "checkout.created → pending");
check((await access(P.customer_email)).status === "pending", "access: pending gives no access");
check((await deliver("order.paid", { ...P, access_until: until }, { id: "msg_paid" })).text === "applied", "order.paid → applied");
check((await access(P.customer_email)).access === true, "access granted after verified payment");
check((await deliver("order.paid", { ...P, access_until: until }, { id: "msg_paid" })).text === "duplicate", "duplicate delivery is idempotent");
check((await deliver("order.paid", { ...P, customer_email: "evil@example.invalid", access_until: until }, { secret: "whsec_" + btoa("wrong") })).status === 400, "forged signature → 400");
check((await access("evil@example.invalid")).access === false, "forged request granted nothing");
check((await deliver("order.paid", { ...P, product_id: "prod_unknown" })).text === "ignored", "unknown product → acknowledged and ignored");
check((await deliver("order.refunded", P)).text === "applied", "refund → applied");
check((await access(P.customer_email)).status === "refunded", "access revoked after refund");
const bad = await onRequestPost({ request: new Request(`${base}/api/billing-webhook`, { method: "POST", body: "x" }), env });
check(bad.status === 400, "missing signature headers → 400");
console.log = origLog;

// ---------- 2. Deploy-readiness of ./out (Cloudflare Pages free plan limits) ----------
const MAX_FILES = 20_000;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const files: string[] = [];
const walk = (d: string) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
};
try {
  walk("out");
  const biggest = Math.max(...files.map((f) => statSync(f).size));
  check(files.length > 0 && files.length <= MAX_FILES, `out/: ${files.length} files (limit ${MAX_FILES})`);
  check(biggest <= MAX_FILE_BYTES, `largest file ${(biggest / 1024).toFixed(0)} KiB (limit 25 MiB)`);
  const text = files.filter((f) => /\.(html|txt|js|css|json)$/.test(f)).map((f) => readFileSync(f, "utf8")).join("\n");
  check(!/private-commercial|larar-handledning|pilot-scorecard|outreach-drafts/.test(text), "no private planning material in out/");
  // Personal values live only in the gitignored .env.local; never hard-code them here.
  let personalValues: string[] = [];
  try {
    personalValues = readFileSync(".env.local", "utf8")
      .split("\n")
      .filter((l) => /^NEXT_PUBLIC_(FOUNDER_NAME|FOUNDER_BIO|CONTACT_EMAIL)=./.test(l))
      .map((l) => l.slice(l.indexOf("=") + 1).trim());
  } catch {
    /* no .env.local (e.g. CI) – nothing personal to look for */
  }
  if (personalValues.some((v) => text.includes(v))) console.log("! out/ contains personal details from .env.local – fine locally, but do NOT deploy this build (CI builds without them)");
  else console.log("✓ no personal details in out/");
} catch {
  check(false, "out/ missing – run npm run build first");
}

console.log(failed ? "\nMOCK CLOUDFLARE: FAILED" : "\nMOCK CLOUDFLARE: OK (simulated – nothing deployed)");
if (failed) process.exit(1);
