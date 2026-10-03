// Cloudflare Pages Function: POST /api/billing-webhook
// STATUS: MOCK-TESTED ONLY (scripts/mock-cloudflare.ts runs it against an in-memory KV). Not deployed.
//
// Production wiring (when moving off mock):
//   - bind a KV namespace as ENTITLEMENTS and set the secret WEBHOOK_SECRET (wrangler secret / dashboard)
//   - point the payment provider's webhook URL to https://<site>/api/billing-webhook
//   - adapt src/lib/billing/adapter.ts to the real provider's payload and product ids
import { verifyWebhook } from "../../../src/lib/billing/webhook-signature.ts";
import { adaptProviderEvent } from "../../../src/lib/billing/adapter.ts";
import { applyEvent, emptyStore, type EntitlementStore } from "../../../src/lib/billing/entitlements.ts";

export interface KVLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}
export interface Env {
  WEBHOOK_SECRET: string;
  ENTITLEMENTS: KVLike;
}

const STORE_KEY = "store";

export async function onRequestPost({ request, env }: { request: Request; env: Env }): Promise<Response> {
  if (!env.WEBHOOK_SECRET) return new Response("not configured", { status: 500 });
  const raw = await request.text(); // raw body – required for signature verification
  try {
    await verifyWebhook(env.WEBHOOK_SECRET, {
      id: request.headers.get("webhook-id"),
      timestamp: request.headers.get("webhook-timestamp"),
      signature: request.headers.get("webhook-signature"),
    }, raw);
  } catch {
    return new Response("invalid signature", { status: 400 });
  }
  let payload: { type: string; created_at: string; data: Record<string, unknown> };
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("bad json", { status: 400 });
  }
  const ev = adaptProviderEvent(payload);
  if (!ev) return new Response("ignored", { status: 200 }); // acknowledge so the provider stops retrying

  // NOTE: KV is eventually consistent and has no transactions. Fine for a pilot's volume; use D1 or a
  // Durable Object if concurrent deliveries for the same customer become realistic.
  const store: EntitlementStore = JSON.parse((await env.ENTITLEMENTS.get(STORE_KEY)) ?? "null") ?? emptyStore();
  const r = applyEvent(store, { ...ev, eventId: request.headers.get("webhook-id")! });
  if (r.outcome !== "duplicate") await env.ENTITLEMENTS.put(STORE_KEY, JSON.stringify(r.store));
  console.log(JSON.stringify({ webhook: request.headers.get("webhook-id"), type: ev.type, outcome: r.outcome }));
  return new Response(r.outcome, { status: 200 });
}
