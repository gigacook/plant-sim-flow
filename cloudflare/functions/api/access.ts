// Cloudflare Pages Function: GET /api/access?email=…&product=…  → { status, access }
// STATUS: MOCK-TESTED ONLY. In production, require an authenticated session or a signed link instead of a
// bare e-mail parameter – otherwise anyone can check whether an address has bought.
import { effectiveStatus, hasAccess, emptyStore, type EntitlementStore } from "../../../src/lib/billing/entitlements.ts";
import type { Env } from "./billing-webhook.ts";

export async function onRequestGet({ request, env }: { request: Request; env: Env }): Promise<Response> {
  const url = new URL(request.url);
  const email = (url.searchParams.get("email") ?? "").trim().toLowerCase();
  const product = url.searchParams.get("product") ?? "teacher-kit";
  const store: EntitlementStore = JSON.parse((await env.ENTITLEMENTS.get("store")) ?? "null") ?? emptyStore();
  return Response.json({ status: effectiveStatus(store, email, product), access: hasAccess(store, email, product) });
}
