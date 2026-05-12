# Chat / WhatsApp data model

Firestore collections (see `lib/db/collections.ts` and `lib/types/chat.ts`).

## `chat_conversations`

Summary document for inbox lists.

| Field | Notes |
|-------|--------|
| `tenantId` | Required on all tenant data. |
| `channel` | `whatsapp`. |
| `customerPhone` | E.164-normalized string. |
| `customerName` | Display name. |
| `linkedOrderId` | Empty string when unlinked (supports queries). |
| `assignedUserId` / `assignedUserName` | Optional; name denormalized for list UI. |
| `status` | Includes `open`, `pending`, `bot_active`, `human_takeover`, `closed`, `awaiting_customer_reply`, `awaiting_internal_action`, `pending_followup`. |
| `department` | Optional routing queue label (indexed filters + inbox UI). |
| `slaFirstResponseDueAt` / `slaResolutionDueAt` / `slaBreachedAt` / `slaWarningSentAt` / `slaBreached` | SLA engine fields (see [docs/conversation-state-machine.md](./conversation-state-machine.md)). |
| `botEnabled` / `humanTakeover` | Automation gating. |
| `unreadCount` / `hasUnread` | `hasUnread` supports indexed “unread” filter. |
| `lastMessageText` / `lastMessageAt` | Denormalized preview. |
| `createdAt` / `updatedAt` | ISO strings. |

## `chat_conversations/{id}/messages` (subcollection `messages`)

| Field | Notes |
|-------|--------|
| `direction` | `incoming \| outgoing \| internal`. |
| `type` | `text \| template \| image \| audio \| document \| interactive`. |
| `whatsappMessageId` | Meta id when applicable. |
| `status` | `queued \| sent \| delivered \| read \| failed`. |
| `metadata` | JSON; errors, timestamps, etc. |

Pagination: `orderBy(createdAt desc)` + cursor document id.

## `whatsapp_message_dedupe`

Document id: `${tenantId}_${whatsappMessageId}`. Created in the same transaction as the inbound message to prevent duplicates when Meta retries webhooks.

## `message_templates`

Quick replies per tenant (`title`, `body`, optional `whatsappTemplateName`).

## `automation_runs`

Audit rows for n8n POST attempts (`eventType`, `status`, `payloadSummary`, `errorMessage`).

## `oms_events`

Append-only tenant event log for automation and analytics (`eventType`, `occurredAt`, `payload`, `correlationId`, `source`, optional `deliveryStatus`). See [docs/automation-events.md](./automation-events.md).

## `automation_dlq`

Dead-letter payloads after final failure delivering to n8n or worker retries.

## `whatsapp_webhook_logs`

Truncated raw body + outcome for debugging (no secrets).

## Firestore indexes

See `firestore.indexes.json`: composites on `chat_conversations` for `tenantId` + `lastMessageAt`, `hasUnread`, `assignedUserId`, `status`, `linkedOrderId`, `customerPhone`; collection group on `messages` for `tenantId` + `whatsappMessageId` (status updates).
