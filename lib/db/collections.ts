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
  /** Denormalized counts for dashboard stage metrics (see order-stage-rollup.service). */
  tenantOrderStageRollup: "tenant_order_stage_stats",
} as const;
