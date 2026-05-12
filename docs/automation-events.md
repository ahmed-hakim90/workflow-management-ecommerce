# Automation events (`oms_events`) / أحداث الأتمتة

## Event envelope (technical)

Firestore collection: `oms_events` (append-only semantics; delivery fields may be merged).

| Field | Purpose |
|-------|---------|
| `tenantId` | Tenant scope |
| `eventType` | Same string as n8n `event` |
| `occurredAt` | ISO timestamp |
| `correlationId` | Trace id; duplicated under `payload.metadata.correlationId` |
| `source` | `api` \| `webhook` \| `worker` \| `cron` \| `system` |
| `payload` | Full n8n-oriented JSON |
| `deliveryStatus` | `pending` \| `delivered` \| `failed` |
| `retryCount` | Incremented on failed n8n attempts |
| `lastDeliveryError` | Short error snippet |

## Required event types (identifiers)

Aligned with `N8nOmsEventType` in code and [`lib/constants/n8n-oms-events.ts`](../lib/constants/n8n-oms-events.ts):

- `whatsapp.message.received`, `whatsapp.message.sent`
- `order.confirmation.requested`, `order.confirmed`, `order.cancelled`
- `conversation.assigned`, `conversation.needs_human`
- `conversation.transferred`, `conversation.escalated`, `conversation.followup_scheduled`
- `sla.warning`, `sla.breached`
- `shipment.created`, `ticket.created`
- `chat.reply.classified`

## Flow

```mermaid
sequenceDiagram
  participant API as emitOmsEvent
  participant FS as Firestore_oms_events
  participant N8 as n8n_webhook
  participant Q as QStash_retry
  API->>FS: append row pending
  API->>N8: POST HMAC
  N8-->>API: ok_or_fail
  API->>FS: deliveryStatus delivered_or_failed
  Note over API,Q: On transient fail, Q retries worker n8n-retry
```

## Operational (AR)

- **التدقيق**: صف `oms_events` هو المرجع لما حدث فعلياً حتى لو فشل n8n.
- **التصحيح**: راقب `retryCount` و `lastDeliveryError` ثم `automation_dlq` بعد نفاد إعادة QStash.

## Internal auth

| Route | Header / verification |
|-------|------------------------|
| `/api/internal/automation/*` | `Authorization: Bearer AUTOMATION_SECRET` |
| `/api/internal/workers/*` | QStash signature |
| `/api/cron/inbox-sla` | `Authorization: Bearer CRON_SECRET` (prod) |
