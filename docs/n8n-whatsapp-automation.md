# n8n + WhatsApp automation

OMS emits signed JSON to your n8n webhook and accepts secured callbacks for order actions.

## Outbound: `sendToN8n`

When `whatsappAutomationEnabled` is true (and a webhook URL is configured), the server may POST to:

- `automation.n8nWebhookUrl`, or
- `N8N_DEFAULT_WEBHOOK_URL` (fallback)

Headers:

- `Content-Type: application/json`
- `X-OMS-Signature: hex(hmac_sha256(n8nWebhookSecret || N8N_HMAC_SECRET, rawBody))` when a secret is set.

### Event types (`event` field)

| Event | When |
|-------|------|
| `whatsapp.message.received` | Inbound WhatsApp message stored; skipped when `humanTakeover` is true. |
| `whatsapp.message.sent` | Agent sent a message via `/api/whatsapp/send-message`. |
| `order.confirmation.requested` | New WooCommerce order created; conversation linked + template attempted. |
| `order.confirmed` | After internal automation confirms the order. |
| `order.cancelled` | After internal automation cancels the order. |
| `conversation.needs_human` | Escalation from automation or customer intent. |
| `ticket.created` | Support ticket created (when automation flag enabled). |

Payload always includes `tenantId` and relevant ids (`conversationId`, `orderId`, `messageId`, …). Check `humanTakeover` and `botEnabled` before auto-replying in n8n.

## Inbound (secured)

### Option A — dedicated internal routes (recommended)

- `POST /api/internal/automation/order-confirmation`  
  Body: `{ tenantId, orderId, action: "confirm"|"cancel"|"needs_human", reason?, conversationId? }`  
  Header: `Authorization: Bearer <AUTOMATION_SECRET>`

- `POST /api/internal/automation/send-template`  
  Sends an approved template unless `humanTakeover` is active on the conversation.

### Option B — n8n bridge

- `POST /api/automations/n8n/whatsapp-event`  
  Same bearer secret. For `event: "order.confirmation"` with `action` + `orderId`, delegates to the same logic as option A.

## Human takeover

Agents use **Take over** in the Inbox UI (`humanTakeover: true`, `botEnabled: false`). While true, the OMS does not emit `whatsapp.message.received` to n8n, and `send-template` returns `409 human_takeover_active`.

## Verification in n8n

1. Read raw body as string.
2. Recompute HMAC-SHA256 with your shared secret.
3. Constant-time compare to `X-OMS-Signature`.
