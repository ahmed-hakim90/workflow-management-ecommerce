import { getSupabaseServiceRoleClient } from "@/lib/db/supabase-server";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import {
  DEFAULT_FIRST_RESPONSE_MINUTES,
  addMinutesIso,
} from "@/lib/logic/sla";
import { emitOmsEventDeferred } from "@/lib/services/events/oms-event-emitter.service";
import { getTenantAutomation } from "@/lib/services/tenant-settings.service";
import { updateChatConversation } from "@/lib/services/chat/conversations.service";
import { listTenants } from "@/lib/services/tenants.service";
import type { ChatConversation } from "@/lib/types/chat";

/**
 * بعد رسالة واردة من العميل: نضع مؤقت أول رد للفريق.
 */
export async function touchSlaOnInboundCustomerMessage(input: {
  tenantId: string;
  conversationId: string;
}): Promise<void> {
  if (isDevMockDataEnabled()) return;
  const auto = await getTenantAutomation(input.tenantId);
  const minutes =
    auto.inboxSlaFirstResponseMinutes ?? DEFAULT_FIRST_RESPONSE_MINUTES;
  if (minutes <= 0) return;

  const due = addMinutesIso(minutes);
  await updateChatConversation(input.tenantId, input.conversationId, {
        slaFirstResponseDueAt: due,
        slaWarningSentAt: null,
        slaBreached: false,
  });
}

/**
 * بعد رد موظف (واتساب ناجح): نلغي مؤقت أول رد.
 */
export async function clearSlaOnStaffOutbound(input: {
  tenantId: string;
  conversationId: string;
}): Promise<void> {
  if (isDevMockDataEnabled()) return;
  await updateChatConversation(input.tenantId, input.conversationId, {
        slaFirstResponseDueAt: null,
        slaWarningSentAt: null,
        slaBreached: false,
        slaBreachedAt: null,
  });
}

export async function runInboxSlaScanForTenant(tenantId: string): Promise<{
  breaches: number;
}> {
  if (isDevMockDataEnabled()) return { breaches: 0 };
  const auto = await getTenantAutomation(tenantId);
  const minutes =
    auto.inboxSlaFirstResponseMinutes ?? DEFAULT_FIRST_RESPONSE_MINUTES;
  if (minutes <= 0) return { breaches: 0 };

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("chat_conversations")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("has_unread", true)
    .lte("sla_first_response_due_at", nowIso)
    .limit(80);
  if (error) throw error;

  let breaches = 0;

  for (const row of data ?? []) {
    const conv = {
      id: row.id,
      tenantId: row.tenant_id,
      status: row.status,
      humanTakeover: row.human_takeover,
      slaBreached: row.sla_breached,
      slaFirstResponseDueAt: row.sla_first_response_due_at,
      linkedOrderId: row.linked_order_id ?? "",
    } as ChatConversation;
    if (conv.status === "closed") continue;
    if (conv.humanTakeover) continue;
    if (conv.slaBreached === true) continue;
    const dueMs = Date.parse(conv.slaFirstResponseDueAt ?? "");
    if (!Number.isFinite(dueMs) || dueMs > now) continue;

    const automation = await getTenantAutomation(tenantId);
    const nowStr = new Date().toISOString();
    await updateChatConversation(tenantId, conv.id, {
      slaBreached: true,
      slaBreachedAt: nowStr,
      status: conv.status === "bot_active" ? "pending" : conv.status,
      botEnabled: false,
    });
    emitOmsEventDeferred({
      source: "cron",
      event: "sla.breached",
      tenantId,
      conversationId: conv.id,
      orderId: conv.linkedOrderId?.trim() || undefined,
      skipN8n: !automation.whatsappAutomationEnabled,
      metadata: {
        dueAt: conv.slaFirstResponseDueAt,
        kind: "first_response",
      },
    });
    breaches += 1;
  }

  return { breaches };
}

/** فحص تحذير قبل التجاوز — استعلام منفصل لصفوف لم يحن بعد موعدها لكن قريبة. */
export async function runInboxSlaWarningScanForTenant(
  tenantId: string,
): Promise<number> {
  if (isDevMockDataEnabled()) return 0;
  const auto = await getTenantAutomation(tenantId);
  const minutes =
    auto.inboxSlaFirstResponseMinutes ?? DEFAULT_FIRST_RESPONSE_MINUTES;
  if (minutes <= 0) return 0;

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  /** نُطلق التحذير عندما يبقى أقل من ~90 ثانية على الموعد. */
  const horizonIso = new Date(now + 95_000).toISOString();
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("chat_conversations")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("has_unread", true)
    .gt("sla_first_response_due_at", nowIso)
    .lte("sla_first_response_due_at", horizonIso)
    .limit(120);
  if (error) throw error;

  let warnings = 0;
  for (const row of data ?? []) {
    const conv = {
      id: row.id,
      tenantId: row.tenant_id,
      status: row.status,
      slaBreached: row.sla_breached,
      slaWarningSentAt: row.sla_warning_sent_at,
      slaFirstResponseDueAt: row.sla_first_response_due_at,
      linkedOrderId: row.linked_order_id ?? "",
    } as ChatConversation;
    if (conv.status === "closed" || conv.slaBreached === true) continue;
    if (conv.slaWarningSentAt) continue;

    const automation = await getTenantAutomation(tenantId);
    const wAt = new Date().toISOString();
    await updateChatConversation(tenantId, conv.id, { slaWarningSentAt: wAt });
    emitOmsEventDeferred({
      source: "cron",
      event: "sla.warning",
      tenantId,
      conversationId: conv.id,
      orderId: conv.linkedOrderId?.trim() || undefined,
      skipN8n: !automation.whatsappAutomationEnabled,
      metadata: {
        dueAt: conv.slaFirstResponseDueAt,
        kind: "first_response",
      },
    });
    warnings += 1;
  }
  return warnings;
}

/** يُستدعى من Vercel Cron أو عامل QStash — فحص كل المستأجرين بدفعات صغيرة. */
export async function runGlobalInboxSlaCron(): Promise<{
  tenants: number;
  warnings: number;
  breaches: number;
}> {
  const tenants = await listTenants();
  let warnings = 0;
  let breaches = 0;
  for (const t of tenants) {
    warnings += await runInboxSlaWarningScanForTenant(t.id);
    const b = await runInboxSlaScanForTenant(t.id);
    breaches += b.breaches;
  }
  return { tenants: tenants.length, warnings, breaches };
}
