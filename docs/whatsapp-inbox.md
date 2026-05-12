# WhatsApp Inbox (Cloud API)

Internal OMS inbox for WhatsApp conversations: list, reply, internal notes, order linking, and automation hooks.

## Configuration from Settings (recommended)

Staff with **Settings → API keys** access can configure Meta Cloud API fields in the **WhatsApp Cloud API** card:

- Callback URL is shown for copy/paste into Meta.
- **Verify token**, **Phone number ID**, optional **Business account ID**, **Access token**, and optional per-tenant **App secret** are saved via `PATCH /api/settings/integrations` into `tenant_settings.integrations.whatsapp` (secrets are never returned in full; only last-4 hints).

Full Arabic walkthrough (Meta + OMS + production): [docs/handbook-ar.md](./handbook-ar.md#ربط-واتساب-whatsapp-cloud-api--خطوة-بخطوة).

## Environment variables (server only)

| Variable | Purpose |
|----------|---------|
| `WHATSAPP_APP_SECRET` | Meta app secret for `X-Hub-Signature-256` on inbound webhooks (unless tenant sets `integrations.whatsapp.appSecret`). |
| `AUTOMATION_SECRET` | Bearer token for `/api/internal/automation/*` and `/api/automations/n8n/whatsapp-event`. |
| `N8N_HMAC_SECRET` | Default HMAC secret when signing outbound events to n8n (tenant can set `automation.n8nWebhookSecret`). |
| `N8N_DEFAULT_WEBHOOK_URL` | Optional dev fallback when `automation.n8nWebhookUrl` is unset. |

Never expose Cloud API access tokens or app secrets to the browser.

## Tenant settings (Firestore)

Stored under Firestore `tenant_settings` → `integrations.whatsapp` (types in `TenantWhatsAppCloudIntegration`); the Settings UI writes the same document:

- `verifyToken` — must match Meta “Verify token” for webhook setup.
- `accessToken` — long-lived system user token for Graph API.
- `phoneNumberId` — sending + webhook `phone_number_id` validation.
- `appSecret` — optional per-tenant override for webhook signature.

Automation fields on `automation` document:

- `whatsappAutomationEnabled` — enables n8n events + optional order confirmation template flow.
- `n8nWebhookUrl` / `n8nWebhookSecret` — outbound automation target + HMAC.
- `orderConfirmationTemplateName` / `orderConfirmationTemplateLanguage` — approved template for new-order confirmation.

## Webhook URL

Register in Meta:

- **Callback URL:** `https://<your-domain>/api/webhooks/whatsapp?tenant=<tenantIdOrSlug>`
- **Verify token:** same as `integrations.whatsapp.verifyToken`
- **Subscribe to:** `messages`, `message_status` (and fields your app needs)

`GET` returns the `hub.challenge` when verify token matches. `POST` verifies `X-Hub-Signature-256`, normalizes payloads, dedupes by WhatsApp message id, updates conversations/messages, and optionally calls n8n.

## Staff APIs

- `GET /api/inbox/conversations` — filters: `all|unread|mine|bot|needs_human|closed`; optional `limit`, `phoneContains`, `department`, cursor `cursor` for paging (see [docs/whatsapp-architecture.md](./whatsapp-architecture.md)).
- `GET/PATCH /api/inbox/conversations/[id]`
- `GET /api/inbox/conversations/[id]/messages?cursor=&limit=`
- `POST /api/inbox/conversations/[id]/notes` — internal notes.
- `POST /api/inbox/conversations/[id]/read` — clears unread.
- `POST /api/whatsapp/send-message` — `{ conversationId, body }` (requires `inbox:write`).

## Roles

See RBAC matrix: `page:inbox`, `inbox:read`, `inbox:write`, `inbox:manage`, `inbox:read_linked_order`. Warehouse lists conversations only when `linkedOrderId` matches an order they pass in the query.

## Related

- [docs/whatsapp-architecture.md](./whatsapp-architecture.md) — end-to-end automation and queues
- [docs/automation-events.md](./automation-events.md) — `oms_events` catalog
- [docs/conversation-state-machine.md](./conversation-state-machine.md) — status, SLA, routing
- [docs/chat-data-model.md](./chat-data-model.md) — Firestore fields
