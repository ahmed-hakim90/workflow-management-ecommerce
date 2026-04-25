# ADR 0001: Hakimo OMS architecture

## Status

Accepted

## Context

Hakimo OMS is a multi-tenant order management system on Next.js (App Router) + Firestore, with WooCommerce and Bosta integrations.

## Decision

- **Runtime**: Next.js route handlers under `app/api/**` implement the HTTP API. Server-only code lives in `lib/`.
- **Data**: Cloud Firestore with `tenantId` on every domain document for isolation. All queries filter by `tenantId`.
- **Auth (phase 1)**: Staff calls use `Authorization: Bearer <OMS_API_SECRET>` plus `X-Tenant-Id`, `X-User-Id`, `X-User-Role`. Webhooks use `WOOCOMMERCE_WEBHOOK_SECRET` for HMAC verification. This is a deliberate MVP seam; production should replace staff headers with a real IdP (e.g. Firebase Auth / Clerk) while keeping tenant guards server-side.
- **State**: Order lifecycle is enforced by a centralized state machine in `lib/logic/order-state-machine.ts` (no ad-hoc status writes).
- **Activity**: All mutating services append `activity_logs` for audit.
- **Integrations**: Bosta client is behind `lib/integrations/bosta.ts` with mock behavior when `BOSTA_API_KEY` is absent.
- **Automation**: Tenant settings document drives `auto_create_shipment` and `create_shipment_stage` in `lib/logic/automation.ts`.

## Consequences

- Tenant isolation depends on disciplined server-side filtering; add CI checks / integration tests for cross-tenant access.
- Webhook idempotency uses `integration_events` keyed by delivery id.
- Firestore composite indexes may be required as query patterns grow; `firestore.indexes.json` documents the initial set.
