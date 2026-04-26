# Store OMS (workflow-management-ecommerce)

Production-oriented Order Management System: Next.js App Router, Firestore, Zustand, WooCommerce webhooks and REST status sync, Bosta shipment creation (official SDK when API key and address defaults are set), warehouse AWB scanning, ticketing, KPI dashboards.

## Quick start

```bash
cp .env.example .env.local
# Set FIREBASE_SERVICE_ACCOUNT_JSON (single-line JSON string) and NEXT_PUBLIC_FIREBASE_* (web app)
npm install
npm run dev
```

**Staff (browser) auth:** use Firebase sign-in, or a **per-tenant** `staffApiKey` in `Authorization: Bearer` with `X-Tenant-Id`, `X-User-Id`, `X-User-Role` (see `lib/auth/context.ts`). The Settings → API screen stores the session’s Bearer key locally for demos and integrations that cannot use an ID token.

WooCommerce webhook: `POST /api/webhooks/woocommerce?tenant=<tenantId>`. A webhook secret is **required** to accept traffic: set the **per-tenant** value in **Settings → Integrations** (`tenant_settings.integrations.woocommerce.webhookSecret`) or, for single-tenant/dev, env `WOOCOMMERCE_WEBHOOK_SECRET`. The handler verifies WooCommerce HMAC on the raw body (`X-WC-Webhook-Signature`); **401** is returned only when the signature is missing or wrong. If neither a tenant secret nor the env fallback is set, the endpoint returns **503** (misconfiguration). Invalid JSON and payload processing errors return **400**.

**WooCommerce REST (push status):** In the same Integrations screen, set store URL plus REST API consumer key/secret. When staff change an order’s lifecycle in the OMS, we `PUT` the matching WooCommerce order status (see `lib/logic/woocommerce-status-map.ts`). Failures are logged under `integration.woocommerce.status_sync_failed` in activity.

Bosta: per-tenant **API key**, optional **API host** (`https://app.bosta.co` or staging), and **default city / zone** (required for real AWBs) in Integrations. Without a key, shipments use mock AWBs. Env `BOSTA_API_KEY` / `BOSTA_BASE_URL` are optional fallbacks when the tenant has no key.

**Rate limiting:** Optional Upstash Redis (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) enables per-IP limits on routes that use `requireStaffContext` (`lib/http/api-rate-limit.ts`). Webhooks are unaffected.

**Staff auth:** Default (`STAFF_AUTH_MODE` unset or `legacy`) allows Firebase ID tokens, or the tenant’s `staffApiKey` in `Authorization` with `X-User-Id` / `X-User-Role`. Set `STAFF_AUTH_MODE=firebase` with `FIREBASE_SERVICE_ACCOUNT_JSON` to allow **only** Firebase ID tokens on `requireStaffContext` routes.

## Structure

- `app/api/*` — HTTP API (orders, shipments, tickets, users, webhooks, admin summary, automation settings)
- `lib/types` — domain models
- `lib/logic` — state machine, payment math, automation rules
- `lib/services` — Firestore services + activity log
- `lib/integrations` — WooCommerce + Bosta
- `store/zustand` — persisted dev session for UI
- `docs/adr` — architecture decision records
- `firestore.indexes.json` — composite indexes (extend as queries grow)

## Scripts

- `npm run dev` — Turbopack dev server
- `npm run build` — production build
- `npm test` — Vitest unit tests (state machine, RBAC, payment, automation)
- `npm run lint` — ESLint

## Security notes

Tenant isolation is enforced in services by `tenantId` on every document and query filters. For production, prefer Firebase sign-in plus `STAFF_AUTH_MODE=firebase` so browsers cannot impersonate staff with a shared secret; keep server-side tenant guards in all services.
