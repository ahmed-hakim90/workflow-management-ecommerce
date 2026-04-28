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
} as const;
