/**
 * أسماء منطقية للطوابير — تنفَّذ حالياً عبر QStash وتبقى قابلة للاستبدال بـ BullMQ لاحقاً.
 */
export type OmsLogicalQueue =
  | "incomingWebhookProcessing"
  | "outgoingMessages"
  | "automationEvents"
  | "retries"
  | "failedEvents";
