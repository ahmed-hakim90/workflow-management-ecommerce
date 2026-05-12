import { getSupabaseServiceRoleClient } from "@/lib/db/supabase-server";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import type {
  MessageTemplate,
  MessageTemplateEventKey,
  N8nOmsEventType,
  TemplateApprovalStatus,
} from "@/lib/types/chat";

const mockTemplates: MessageTemplate[] = [];

function templateToRow(t: MessageTemplate) {
  return {
    id: t.id,
    tenant_id: t.tenantId,
    title: t.title,
    body: t.body,
    event_key: t.eventKey,
    whatsapp_template_name: t.whatsappTemplateName,
    category: t.category,
    approval_status: t.approvalStatus,
    linked_oms_event: t.linkedOmsEvent,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
  };
}

function rowToTemplate(row: Record<string, unknown>): MessageTemplate {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    title: row.title as string,
    body: row.body as string,
    eventKey: row.event_key as MessageTemplateEventKey | undefined,
    whatsappTemplateName: row.whatsapp_template_name as string | undefined,
    category: row.category as string | undefined,
    approvalStatus: row.approval_status as TemplateApprovalStatus | undefined,
    linkedOmsEvent: row.linked_oms_event as N8nOmsEventType | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function isMessageTemplateVisibleInInbox(t: MessageTemplate): boolean {
  if (t.approvalStatus === "rejected") return false;
  if (t.approvalStatus === "pending") return false;
  return true;
}

export async function listMessageTemplates(
  tenantId: string,
): Promise<MessageTemplate[]> {
  if (isDevMockDataEnabled()) {
    return mockTemplates
      .filter((t) => t.tenantId === tenantId)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("message_templates")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map(rowToTemplate);
}

export async function getMessageTemplate(
  tenantId: string,
  id: string,
): Promise<MessageTemplate | null> {
  if (isDevMockDataEnabled()) {
    const t = mockTemplates.find((m) => m.id === id && m.tenantId === tenantId);
    return t ?? null;
  }
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("message_templates")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToTemplate(data) : null;
}

export type MessageTemplateWriteInput = {
  title: string;
  body: string;
  whatsappTemplateName?: string | null;
  eventKey?: MessageTemplateEventKey | null;
  category?: string | null;
  approvalStatus?: TemplateApprovalStatus;
  linkedOmsEvent?: N8nOmsEventType | null;
};

function normalizeWrite(
  tenantId: string,
  input: MessageTemplateWriteInput,
  id: string,
  now: string,
  createdAt?: string,
): MessageTemplate {
  const row: MessageTemplate = {
    id,
    tenantId,
    title: input.title.trim(),
    body: input.body.trim(),
    createdAt: createdAt ?? now,
    updatedAt: now,
  };
  if (input.whatsappTemplateName?.trim()) {
    row.whatsappTemplateName = input.whatsappTemplateName.trim();
  }
  if (input.eventKey) row.eventKey = input.eventKey;
  if (input.category?.trim()) row.category = input.category.trim();
  if (input.approvalStatus) row.approvalStatus = input.approvalStatus;
  if (input.linkedOmsEvent) row.linkedOmsEvent = input.linkedOmsEvent;
  return row;
}

export async function createMessageTemplate(
  tenantId: string,
  input: MessageTemplateWriteInput,
): Promise<MessageTemplate> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const approvalStatus = input.approvalStatus ?? "pending";
  const row = normalizeWrite(
    tenantId,
    { ...input, approvalStatus },
    id,
    now,
  );
  if (isDevMockDataEnabled()) {
    mockTemplates.push(row);
    return row;
  }
  const { error } = await getSupabaseServiceRoleClient()
    .from("message_templates")
    .insert(templateToRow(row));
  if (error) throw error;
  return row;
}

export async function updateMessageTemplate(
  tenantId: string,
  id: string,
  input: Partial<MessageTemplateWriteInput>,
): Promise<MessageTemplate | null> {
  const prev = await getMessageTemplate(tenantId, id);
  if (!prev) return null;
  const now = new Date().toISOString();
  const merged: MessageTemplateWriteInput = {
    title: input.title !== undefined ? input.title : prev.title,
    body: input.body !== undefined ? input.body : prev.body,
    whatsappTemplateName:
      input.whatsappTemplateName !== undefined
        ? input.whatsappTemplateName
        : prev.whatsappTemplateName ?? null,
    eventKey:
      input.eventKey !== undefined ? input.eventKey : prev.eventKey ?? null,
    category:
      input.category !== undefined ? input.category : prev.category ?? null,
    approvalStatus:
      input.approvalStatus !== undefined
        ? input.approvalStatus
        : prev.approvalStatus,
    linkedOmsEvent:
      input.linkedOmsEvent !== undefined
        ? input.linkedOmsEvent
        : prev.linkedOmsEvent ?? null,
  };
  const row = normalizeWrite(tenantId, merged, id, now, prev.createdAt);
  if (isDevMockDataEnabled()) {
    const i = mockTemplates.findIndex((m) => m.id === id);
    if (i >= 0) mockTemplates[i] = row;
    return row;
  }
  const { error } = await getSupabaseServiceRoleClient()
    .from("message_templates")
    .upsert(templateToRow(row));
  if (error) throw error;
  return row;
}

export async function deleteMessageTemplate(
  tenantId: string,
  id: string,
): Promise<boolean> {
  const prev = await getMessageTemplate(tenantId, id);
  if (!prev) return false;
  if (isDevMockDataEnabled()) {
    const i = mockTemplates.findIndex((m) => m.id === id);
    if (i >= 0) mockTemplates.splice(i, 1);
    return true;
  }
  const { error } = await getSupabaseServiceRoleClient()
    .from("message_templates")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);
  if (error) throw error;
  return true;
}

export async function seedDefaultQuickRepliesIfEmpty(tenantId: string) {
  if (isDevMockDataEnabled()) {
    if (mockTemplates.some((t) => t.tenantId === tenantId)) return;
    const now = new Date().toISOString();
    mockTemplates.push(
      {
        id: crypto.randomUUID(),
        tenantId,
        title: "تحية",
        body: "أهلاً، كيف يمكننا مساعدتك؟",
        category: "general",
        approvalStatus: "approved",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        tenantId,
        title: "متابعة الطلب",
        body: "نُتابع طلبك وسنوافيك بالتحديث قريباً.",
        category: "shipping",
        approvalStatus: "approved",
        createdAt: now,
        updatedAt: now,
      },
    );
    return;
  }
  const existing = await listMessageTemplates(tenantId);
  if (existing.length > 0) return;
  const now = new Date().toISOString();
  const defaults: MessageTemplate[] = [
    {
      id: crypto.randomUUID(),
      tenantId,
      title: "تحية",
      body: "أهلاً، كيف يمكننا مساعدتك؟",
      category: "general",
      approvalStatus: "approved",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      tenantId,
      title: "متابعة الطلب",
      body: "نُتابع طلبك وسنوافيك بالتحديث قريباً.",
      category: "shipping",
      approvalStatus: "approved",
      createdAt: now,
      updatedAt: now,
    },
  ];
  const { error } = await getSupabaseServiceRoleClient()
    .from("message_templates")
    .insert(defaults.map(templateToRow));
  if (error) throw error;
}
