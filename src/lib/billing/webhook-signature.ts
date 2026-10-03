// Verify webhooks signed per the "Standard Webhooks" spec (https://www.standardwebhooks.com/),
// which several billing providers use (Polar documents it; others: check their docs).
// Signed content: `${webhook-id}.${webhook-timestamp}.${rawBody}`, HMAC-SHA256, base64.
// Header `webhook-signature` may hold several space-separated `v1,<sig>` entries (key rotation).
//
// Works in Node >= 20 and Cloudflare Workers (Web Crypto only). TESTED: see entitlements.test.ts.

export interface WebhookHeaders {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
}

export class WebhookVerificationError extends Error {}

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: ArrayBuffer): string {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Secret as given by the provider, e.g. "whsec_<base64>". Some providers give raw text secrets: pass {rawSecret:true}. */
export async function sign(secret: string, id: string, timestamp: string, body: string, opts: { rawSecret?: boolean } = {}): Promise<string> {
  const keyBytes = opts.rawSecret ? new TextEncoder().encode(secret) : b64ToBytes(secret.replace(/^whsec_/, ""));
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
  return bytesToB64(mac);
}

/**
 * Throws WebhookVerificationError unless the signature is valid and the timestamp is within tolerance.
 * IMPORTANT: pass the raw request body exactly as received (before JSON.parse).
 */
export async function verifyWebhook(
  secret: string,
  headers: WebhookHeaders,
  rawBody: string,
  opts: { toleranceSec?: number; nowSec?: number; rawSecret?: boolean } = {},
): Promise<void> {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) throw new WebhookVerificationError("missing headers");
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) throw new WebhookVerificationError("bad timestamp");
  const now = opts.nowSec ?? Math.floor(Date.now() / 1000);
  const tol = opts.toleranceSec ?? 300;
  if (Math.abs(now - ts) > tol) throw new WebhookVerificationError("timestamp outside tolerance");
  const expected = await sign(secret, id, timestamp, rawBody, { rawSecret: opts.rawSecret });
  const ok = signature
    .split(" ")
    .map((p) => p.split(","))
    .some(([ver, sig]) => ver === "v1" && typeof sig === "string" && timingSafeEqual(sig, expected));
  if (!ok) throw new WebhookVerificationError("signature mismatch");
}
