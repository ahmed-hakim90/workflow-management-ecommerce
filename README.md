# Store OMS (workflow-management-ecommerce)

Production-oriented Order Management System: Next.js App Router, Supabase Postgres/Auth, Zustand, WooCommerce webhooks and REST status sync, Bosta shipment creation (official SDK when API key and address defaults are set), warehouse AWB scanning, ticketing, KPI dashboards.

**Arabic handbook (setup, architecture, full WhatsApp linking):** [docs/handbook-ar.md](docs/handbook-ar.md)

## Quick start

```bash
cp .env.example .env.local
# Set SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
npm install
npm run dev
```

**Staff (browser) auth:** use Supabase Auth, or a **per-tenant** `staffApiKey` in `Authorization: Bearer` with `X-Tenant-Id`, `X-User-Id`, `X-User-Role` (see `lib/auth/context.ts`). The Settings → API screen stores the session’s Bearer key locally for demos and integrations that cannot use an access token.

WooCommerce webhook: `POST /api/webhooks/woocommerce?tenant=<tenantId>`. A webhook secret is **required** to accept traffic: set the **per-tenant** value in **Settings → Integrations** (`tenant_settings.integrations.woocommerce.webhookSecret`) or, for single-tenant/dev, env `WOOCOMMERCE_WEBHOOK_SECRET`. The handler verifies WooCommerce HMAC on the raw body (`X-WC-Webhook-Signature`); **401** is returned only when the signature is missing or wrong. If neither a tenant secret nor the env fallback is set, the endpoint returns **503** (misconfiguration). Invalid JSON and payload processing errors return **400**. Each delivery attempt is recorded in Supabase under `webhook_ingest_logs` for the tenant. **Settings → Integrations** shows a checklist (`webhookDiagnostics` from `GET /api/settings/integrations`) and recent rows (`GET /api/settings/webhook-ingest-logs`).

**Production (e.g. Vercel) env for inbound webhooks:** Copy values to the project’s **Server** environment, not only `.env.local` on a laptop. Required for order persistence: **`SUPABASE_URL`** and **`SUPABASE_SERVICE_ROLE_KEY`**. For HMAC: **either** the per-tenant secret in Integrations **or** `WOOCOMMERCE_WEBHOOK_SECRET` on the server. For a stable public URL in links and the webhook: **`NEXT_PUBLIC_APP_URL`** = your production `https://…` domain; if unset, Vercel can fall back to `VERCEL_URL` (preview/prod hostnames). WooCommerce’s Delivery URL should use the **same** `tenant` query param as the tenant id in the OMS.

**WooCommerce REST (push status):** In the same Integrations screen, set store URL plus REST API consumer key/secret. When staff change an order’s lifecycle in the OMS, we `PUT` the matching WooCommerce order status (see `lib/logic/woocommerce-status-map.ts`). Failures are logged under `integration.woocommerce.status_sync_failed` in activity.

Bosta: per-tenant **API key**, optional **API host** (`https://app.bosta.co` or staging), and **default city / zone** (required for real AWBs) in Integrations. Without a key, shipments use mock AWBs. Env `BOSTA_API_KEY` / `BOSTA_BASE_URL` are optional fallbacks when the tenant has no key.

**Rate limiting:** Optional Upstash Redis (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) enables per-IP limits on routes that use `requireStaffContext` (`lib/http/api-rate-limit.ts`). Webhooks are unaffected.

**Staff auth:** Supabase access tokens are preferred. Legacy tenant `staffApiKey` auth still works for scripts using `Authorization` with `X-Tenant-Id`, `X-User-Id`, and `X-User-Role`.

## Structure

- `app/api/*` — HTTP API (orders, shipments, tickets, users, webhooks, admin summary, automation settings)
- `lib/types` — domain models
- `lib/logic` — state machine, payment math, automation rules
- `lib/services` — Supabase-backed services + activity log
- `lib/integrations` — WooCommerce + Bosta
- `store/zustand` — persisted dev session for UI
- `docs/adr` — architecture decision records
- `supabase/migrations` — Postgres schema, indexes, and RLS policies

## Scripts

- `npm run dev` — Turbopack dev server
- `npm run build` — production build
- `npm test` — Vitest unit tests (state machine, RBAC, payment, automation)
- `npm run lint` — ESLint

## Security notes

Tenant isolation is enforced in Supabase RLS and service-layer `tenantId` filters. For production, prefer Supabase Auth access tokens so browsers do not rely on shared tenant staff secrets; keep server-side tenant guards in all services.
