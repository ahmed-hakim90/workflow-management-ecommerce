# Queue architecture (QStash) / الطوابير

## Logical queues

[`lib/services/queue/oms-queue.service.ts`](../lib/services/queue/oms-queue.service.ts) maps names to internal HTTPS workers:

| Logical name | Worker route |
|--------------|--------------|
| `incomingWebhookProcessing` | `/api/internal/workers/whatsapp-inbound` |
| `outgoingMessages` | `/api/internal/workers/whatsapp-outbound` |
| `automationEvents` | `/api/internal/workers/automation-event` |
| `retries` | `/api/internal/workers/n8n-retry` |
| `failedEvents` | (DLQ via `automation_dlq` — no separate HTTP queue) |

Low-level publisher: [`lib/services/queue/qstash-queue.service.ts`](../lib/services/queue/qstash-queue.service.ts) (`publishJsonToWorker`).

## Environment

- `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`
- `OMS_PUBLIC_BASE_URL` (no trailing slash)
- `WHATSAPP_OUTBOUND_QUEUE=1` — enqueue template sends from `/api/internal/automation/send-template`

## Idempotency

- Inbound WhatsApp: `whatsapp_message_dedupe`
- Outbound template jobs: `outbound_queue_dedupe` (`${tenantId}_${dedupeKey}`)

## BullMQ future

Keep worker **handlers thin** and **HTTP-signed** so the same handler can be invoked from a BullMQ consumer later.

```mermaid
flowchart LR
  P[Producer]
  Q[QStash]
  W[Next_worker_route]
  P --> Q --> W
```

## Operational (AR)

- بدون Redis/QStash: المعالجة تعود **متزامنة** على مسار الويبهوك (أبطأ لكن تعمل).
- فحص SLA مجدول: `GET/POST /api/cron/inbox-sla` أو جدولة QStash إلى `/api/internal/cron/inbox-sla`.
