export const COLLECTIONS = {
  tenants: "tenants",
  orders: "orders",
  shipments: "shipments",
  tickets: "tickets",
  users: "users",
  userStats: "user_stats",
  analyticsDaily: "analytics_daily",
  activityLogs: "activity_logs",
  tenantSettings: "tenant_settings",
  tenantSlugs: "tenant_slugs",
  integrationEvents: "integration_events",
  /** WooCommerce (and future) inbound webhook attempt outcomes per tenant. */
  webhookIngestLogs: "webhook_ingest_logs",
  /** Append-only order-scoped audit rows (ingest + critical transitions). */
  orderEvents: "order_events",
  /** Outbound tenant webhook deliveries for order status changes. */
  outboundWebhookLogs: "outbound_webhook_logs",
  /** Denormalized counts for dashboard stage metrics (see order-stage-rollup.service). */
  tenantOrderStageRollup: "tenant_order_stage_stats",
  /** Internal platform-admin identities (separate from tenant users). */
  platformAdmins: "platform_admins",
  /** Internal SaaS package definitions managed by platform admins. */
  platformPackages: "platform_packages",
  /** Per-tenant package assignment and entitlement overrides. */
  tenantEntitlements: "tenant_entitlements",
  /** WhatsApp / inbox conversations (summary docs). */
  chatConversations: "chat_conversations",
  /** Subcollection: `chat_conversations/{id}/messages`. */
  chatMessages: "messages",
  /** Quick replies / template shortcuts per tenant. */
  messageTemplates: "message_templates",
  /** Outbound automation / n8n delivery audit. */
  automationRuns: "automation_runs",
  /** Meta WhatsApp webhook debug log. */
  whatsappWebhookLogs: "whatsapp_webhook_logs",
  /** Idempotency: doc id `${tenantId}_${whatsappMessageId}`. */
  whatsappMessageDedupe: "whatsapp_message_dedupe",
  /** Append-only tenant-scoped events (automation + ops bus). */
  omsEvents: "oms_events",
  /** Dead-letter rows for failed n8n/automation delivery after retries. */
  automationDlq: "automation_dlq",
  /** Idempotency for QStash outbound WhatsApp jobs — doc id `${tenantId}_${dedupeKey}`. */
  outboundQueueDedupe: "outbound_queue_dedupe",
} as const;
