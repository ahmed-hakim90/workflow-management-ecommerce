# Hakimo OMS (workflow-management-ecommerce)

Production-oriented Order Management System: Next.js App Router, Firestore, Zustand, WooCommerce webhooks, Bosta integration (mock without API key), warehouse AWB scanning, ticketing, KPI dashboards.

## Quick start

```bash
cp .env.example .env.local
# Set FIREBASE_SERVICE_ACCOUNT_JSON (single-line JSON string) and OMS_API_SECRET
npm install
npm run dev
```

Open the app and enter the same `OMS_API_SECRET` in the header bar (dev UX). All staff API calls require:

- `Authorization: Bearer <OMS_API_SECRET>`
- `X-Tenant-Id`, `X-User-Id`, `X-User-Role`

WooCommerce webhook: `POST /api/webhooks/woocommerce?tenant=<tenantId>`. Store the **per-tenant** webhook secret in **Settings → Tenant & integrations → Integrations** (Firestore `tenant_settings.integrations.woocommerce.webhookSecret`). Optional single-tenant/dev fallback: env `WOOCOMMERCE_WEBHOOK_SECRET`.

Bosta: per-tenant **API key** and optional **base URL** in the same Integrations screen (`tenant_settings.integrations.bosta`). Env `BOSTA_API_KEY` / `BOSTA_BASE_URL` are optional fallbacks when the tenant has no key.

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

Tenant isolation is enforced in services by `tenantId` on every document and query filters. Replace the MVP bearer + headers auth with Firebase Auth / Clerk before production, keeping server-side tenant guards.
