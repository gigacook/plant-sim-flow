# Cloudflare Pages (mock)

Planned hosting for the commercial site, because GitHub Pages does not allow sites "primarily directed at facilitating commercial transactions". **Nothing here is connected to a Cloudflare account yet.**

| Path | What it is | Status |
|---|---|---|
| `functions/api/billing-webhook.ts` | Webhook endpoint: verify signature → adapt payload → idempotent entitlement update in KV | Mock-tested |
| `functions/api/access.ts` | Server-side access check | Mock-tested (needs auth before production) |
| `wrangler.toml.example` | Project config template (no ids, no secrets) | Example |

Run the local mock (in-memory KV, simulated provider deliveries, plus a deploy-readiness check of `out/`):

```bash
npm run build && npm run mock:cloudflare
```

Going live later:
1. Create the Pages project.
2. Build command `npm run build`, output `out`.
3. Add the KV binding and the `WEBHOOK_SECRET` secret.
4. Set `NEXT_PUBLIC_BILLING_MODE=live` and the `NEXT_PUBLIC_*` variables.
