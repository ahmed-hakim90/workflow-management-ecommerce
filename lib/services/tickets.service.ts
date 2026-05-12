import { getSupabaseServiceRoleClient } from "@/lib/db/supabase-server";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import {
  mockListTickets,
  mockCreateTicket,
  mockAssignTicket,
  mockCloseTicket,
  mockResolveTicket,
  mockGetTicket,
  mockAddTicketNote,
  mockDeleteTicket,
  mockListTicketsByOrder,
} from "@/lib/dev/mock-backend";
import type {
  Ticket,
  TicketResolutionKind,
  TicketStatus,
  TicketType,
} from "@/lib/types/models";
import { logActivity } from "@/lib/services/activity.service";
import { getTenantAutomation } from "@/lib/services/tenant-settings.service";
import { emitOmsEventDeferred } from "@/lib/services/events/oms-event-emitter.service";
import { createShipmentForOrder } from "@/lib/services/shipments.service";
import { getOrder } from "@/lib/services/orders.service";
import {
  recordTicketOpenedAnalytics,
  recordTicketResolvedAnalytics,
} from "@/lib/services/analytics-daily.service";

type TicketRow = {
  id: string;
  tenant_id: string;
  order_id: string | null;
  type: TicketType;
  status: TicketStatus;
  assigned_to?: string | null;
  shipment_ids?: string[] | null;
  subject?: string | null;
  description?: string | null;
  resolution?: Ticket["resolution"] | null;
  notes_history?: Ticket["notesHistory"] | null;
  created_at: string;
  updated_at: string;
};

function rowToTicket(row: TicketRow): Ticket {
  const notesHistory = row.notes_history ?? [];
  return {
    id: row.id,
    tenantId: row.tenant_id,
    order_id: row.order_id ?? "",
    type: row.type,
    status: row.status,
    assigned_to: row.assigned_to ?? undefined,
    shipmentIds: row.shipment_ids ?? [],
    notes: notesHistory[0]?.body,
    notesHistory,
    resolution: row.resolution ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } as Ticket;
}

function ticketToRow(ticket: Ticket) {
  return {
    id: ticket.id,
    tenant_id: ticket.tenantId,
    order_id: ticket.order_id,
    type: ticket.type,
    status: ticket.status,
    assigned_to: ticket.assigned_to,
    shipment_ids: ticket.shipmentIds ?? [],
    resolution: ticket.resolution,
    notes_history: ticket.notesHistory ?? [],
    created_at: ticket.createdAt,
    updated_at: ticket.updatedAt,
  };
}

async function setTicket(ticket: Ticket) {
  const { error } = await getSupabaseServiceRoleClient()
    .from("tickets")
    .upsert(ticketToRow(ticket));
  if (error) throw error;
}

export async function listTickets(
  tenantId: string,
  opts?: { status?: TicketStatus; orderId?: string },
): Promise<Ticket[]> {
  if (isDevMockDataEnabled()) return mockListTickets(tenantId, opts);
  let q = getSupabaseServiceRoleClient()
    .from("tickets")
    .select("*")
    .eq("tenant_id", tenantId);
  if (opts?.status) q = q.eq("status", opts.status);
  if (opts?.orderId) q = q.eq("order_id", opts.orderId);
  const { data, error } = await q
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  let rows = (data ?? []).map((row) => rowToTicket(row as TicketRow));
  if (opts?.status) {
    rows = rows.filter((t) => t.status === opts.status);
  }
  return rows.slice(0, 200);
}

export async function listTicketsByOrder(
  tenantId: string,
  orderId: string,
): Promise<Ticket[]> {
  if (isDevMockDataEnabled()) return mockListTicketsByOrder(tenantId, orderId);
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("tickets")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("order_id", orderId)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((row) => rowToTicket(row as TicketRow));
}

export async function countTickets(tenantId: string): Promise<number> {
  if (isDevMockDataEnabled()) return mockListTickets(tenantId).length;
  const { count, error } = await getSupabaseServiceRoleClient()
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  if (error) throw error;
  return count ?? 0;
}

export async function createTicket(input: {
  tenantId: string;
  order_id: string;
  type: TicketType;
  notes?: string;
  actorUserId: string;
}): Promise<Ticket> {
  if (isDevMockDataEnabled()) {
    const ticket = await mockCreateTicket(input);
    await maybeNotifyTicketCreatedN8n(input.tenantId, ticket, input);
    return ticket;
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const firstNote = input.notes?.trim()
    ? {
        id: crypto.randomUUID(),
        body: input.notes.trim(),
        userId: input.actorUserId,
        createdAt: now,
      }
    : undefined;
  const ticket: Ticket = {
    id,
    tenantId: input.tenantId,
    order_id: input.order_id,
    type: input.type,
    status: "open",
    notes: firstNote?.body,
    notesHistory: firstNote ? [firstNote] : [],
    shipmentIds: [],
    createdAt: now,
    updatedAt: now,
  };
  await setTicket(ticket);
  await logActivity({
    tenantId: input.tenantId,
    action: "ticket.created",
    entityType: "ticket",
    entityId: id,
    userId: input.actorUserId,
    metadata: { type: input.type, orderId: input.order_id },
  });
  const order = await getOrder(input.tenantId, input.order_id);
  await recordTicketOpenedAnalytics({
    ticket,
    orderValue: order?.payment.total_amount ?? 0,
  });
  await maybeNotifyTicketCreatedN8n(input.tenantId, ticket, input);
  return ticket;
}

async function maybeNotifyTicketCreatedN8n(
  tenantId: string,
  ticket: Ticket,
  input: { order_id: string; type: TicketType },
) {
  const automation = await getTenantAutomation(tenantId);
  if (!automation.whatsappAutomationEnabled) return;
  emitOmsEventDeferred({
    source: "api",
    event: "ticket.created",
    tenantId,
    metadata: {
      ticketId: ticket.id,
      orderId: input.order_id,
      type: input.type,
    },
  });
}

export async function getTicket(
  tenantId: string,
  ticketId: string,
): Promise<Ticket | null> {
  if (isDevMockDataEnabled()) return mockGetTicket(tenantId, ticketId);
  const { data, error } = await getSupabaseServiceRoleClient()
    .from("tickets")
    .select("*")
    .eq("id", ticketId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToTicket(data as TicketRow) : null;
}

export async function deleteTicket(input: {
  tenantId: string;
  ticketId: string;
  actorUserId: string;
}): Promise<void> {
  if (isDevMockDataEnabled()) return mockDeleteTicket(input);
  const t = await getTicket(input.tenantId, input.ticketId);
  if (!t) throw new Error("Ticket not found");
  await logActivity({
    tenantId: input.tenantId,
    action: "ticket.deleted",
    entityType: "ticket",
    entityId: input.ticketId,
    userId: input.actorUserId,
    metadata: { orderId: t.order_id, type: t.type, status: t.status },
  });
  const { error } = await getSupabaseServiceRoleClient()
    .from("tickets")
    .delete()
    .eq("id", input.ticketId)
    .eq("tenant_id", input.tenantId);
  if (error) throw error;
}

export async function addTicketNote(input: {
  tenantId: string;
  ticketId: string;
  body: string;
  actorUserId: string;
}): Promise<Ticket> {
  if (isDevMockDataEnabled()) return mockAddTicketNote(input);
  const t = await getTicket(input.tenantId, input.ticketId);
  if (!t) throw new Error("Ticket not found");
  const now = new Date().toISOString();
  const note = {
    id: crypto.randomUUID(),
    body: input.body,
    userId: input.actorUserId,
    createdAt: now,
  };
  const next: Ticket = {
    ...t,
    notes: t.notes ?? input.body,
    notesHistory: [...(t.notesHistory ?? []), note],
    updatedAt: now,
  };
  await setTicket(next);
  const order = await getOrder(input.tenantId, t.order_id);
  await recordTicketResolvedAnalytics({
    ticket: next,
    orderValue: order?.payment.total_amount ?? 0,
  });
  await logActivity({
    tenantId: input.tenantId,
    action: "ticket.note_added",
    entityType: "ticket",
    entityId: input.ticketId,
    userId: input.actorUserId,
    metadata: { noteId: note.id },
  });
  return next;
}

export async function assignTicket(input: {
  tenantId: string;
  ticketId: string;
  assigneeUserId: string | null;
  actorUserId: string;
}): Promise<Ticket> {
  if (isDevMockDataEnabled()) return mockAssignTicket(input);
  const t = await getTicket(input.tenantId, input.ticketId);
  if (!t) throw new Error("Ticket not found");
  const now = new Date().toISOString();
  const next: Ticket = {
    ...t,
    assigned_to: input.assigneeUserId,
    status: t.status === "open" ? "in_progress" : t.status,
    updatedAt: now,
  };
  await setTicket(next);
  await logActivity({
    tenantId: input.tenantId,
    action: "ticket.assigned",
    entityType: "ticket",
    entityId: input.ticketId,
    userId: input.actorUserId,
    metadata: { assigneeUserId: input.assigneeUserId },
  });
  return next;
}

export async function closeTicket(input: {
  tenantId: string;
  ticketId: string;
  actorUserId: string;
}): Promise<Ticket> {
  if (isDevMockDataEnabled()) return mockCloseTicket(input);
  const t = await getTicket(input.tenantId, input.ticketId);
  if (!t) throw new Error("Ticket not found");
  if (t.status !== "resolved") {
    throw new Error("Only resolved tickets can be closed");
  }
  const now = new Date().toISOString();
  const next: Ticket = {
    ...t,
    status: "closed",
    updatedAt: now,
  };
  await setTicket(next);
  await logActivity({
    tenantId: input.tenantId,
    action: "ticket.closed",
    entityType: "ticket",
    entityId: input.ticketId,
    userId: input.actorUserId,
    metadata: {
      orderId: t.order_id,
      type: t.type,
      previousStatus: t.status,
    },
  });
  return next;
}

export async function resolveTicket(input: {
  tenantId: string;
  ticketId: string;
  createExchangeShipment?: boolean;
  createShipmentType?: "return" | "exchange";
  resolutionKind?: TicketResolutionKind;
  resolutionDetails?: string;
  refundAmount?: number;
  actorUserId: string;
}): Promise<Ticket> {
  if (isDevMockDataEnabled()) return mockResolveTicket(input);
  const t = await getTicket(input.tenantId, input.ticketId);
  if (!t) throw new Error("Ticket not found");

  const shipmentIds = [...(t.shipmentIds ?? [])];
  const shipmentType =
    input.createShipmentType ??
    (input.createExchangeShipment && t.type === "exchange" ? "exchange" : undefined);
  let createdShipmentId: string | undefined;
  if (shipmentType) {
    const s = await createShipmentForOrder({
      tenantId: input.tenantId,
      orderId: t.order_id,
      type: shipmentType,
      actorUserId: input.actorUserId,
    });
    shipmentIds.push(s.id);
    createdShipmentId = s.id;
  }

  const now = new Date().toISOString();
  const kind =
    input.resolutionKind ??
    (shipmentType === "return"
      ? "return"
      : shipmentType === "exchange"
        ? "exchange"
        : "resolved");
  const resolution = {
    kind,
    ...(input.resolutionDetails ? { details: input.resolutionDetails } : {}),
    ...(input.refundAmount != null ? { refundAmount: input.refundAmount } : {}),
    ...(createdShipmentId ? { shipmentId: createdShipmentId } : {}),
    resolvedByUserId: input.actorUserId,
    resolvedAt: now,
  };
  const next: Ticket = {
    ...t,
    shipmentIds,
    resolution,
    status: "resolved",
    updatedAt: now,
  };
  await setTicket(next);
  await logActivity({
    tenantId: input.tenantId,
    action: "ticket.resolved",
    entityType: "ticket",
    entityId: input.ticketId,
    userId: input.actorUserId,
    metadata: {
      kind,
      ...(createdShipmentId ? { shipmentId: createdShipmentId } : {}),
      ...(input.refundAmount != null ? { refundAmount: input.refundAmount } : {}),
    },
  });
  return next;
}
