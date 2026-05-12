# Conversation state machine / حالات المحادثة

## Status values (technical)

`ChatConversationStatus` in [`lib/types/chat.ts`](../lib/types/chat.ts):

- `open`, `pending`, `bot_active`, `human_takeover`, `closed`
- `awaiting_customer_reply`, `awaiting_internal_action`, `pending_followup`

## New operational fields

- `department` — routing bucket (e.g. confirmation / shipping).
- `automationPausedReason` — optional pause explanation for staff.

## API transitions

`PATCH /api/inbox/conversations/:id` supports:

- `assignedUserId` — emits `conversation.assigned`; if reassigning from a previous owner, also emits `conversation.transferred`.
- `takeOver` / `releaseToBot`
- `escalate: { department, reason? }` — sets `awaiting_internal_action`, emits `conversation.escalated`
- `scheduleFollowup: true` — sets `pending_followup`, emits `conversation.followup_scheduled`
- `automationPausedReason`

## OMS timeline events

Prefer `oms_events` rows for automation/analytics (no heavy subcollection by default):

- `conversation.assigned`, `conversation.transferred`, `conversation.escalated`, `conversation.followup_scheduled`, `conversation.needs_human`

```mermaid
stateDiagram-v2
  [*] --> open
  open --> bot_active
  bot_active --> pending
  pending --> human_takeover
  human_takeover --> bot_active: releaseToBot
  pending --> awaiting_internal_action: escalate
  bot_active --> pending_followup: scheduleFollowup
  pending --> closed
  human_takeover --> closed
```

## Operational (AR)

- **التصعيد**: يعطّل البوت تلقائياً عبر تحديث الحالة ويُرسل حدثاً إلى n8n للتوجيه.
