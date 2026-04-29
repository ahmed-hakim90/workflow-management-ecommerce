import { getDb } from "@/lib/db/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import {
  mockListTickets,
  mockCreateTicket,
  mockAssignTicket,
  mockResolveTicket,
  mockGetTicket,
  mockAddTicketNote,
  mockDeleteTicket,
} from "@/lib/dev/mock-backend";
import type {
  Ticket,
  TicketResolutionKind,
  TicketStatus,
  TicketType,
} from "@/lib/types/models";
import { logActivity } from "@/lib/services/activity.service";
import { createShipmentForOrder } from "@/lib/services/shipments.service";
import { getOrder } from "@/lib/services/orders.service";
import { recordTicketOpenedAnalytics } from "@/lib/services/analytics-daily.service";

export async function listTickets(
  tenantId: string,
  opts?: { status?: TicketStatus },
): Promise<Ticket[]> {
  if (isDevMockDataEnabled()) return mockListTickets(tenantId, opts);
  const db = getDb();
  const snap = await db
    .collection(COLLECTIONS.tickets)
    .where("tenantId", "==", tenantId)
    .orderBy("updatedAt", "desc")
    .limit(400)
    .get();
  let rows = snap.docs.map((d) => d.data() as Ticket);
  if (opts?.status) {
    rows = rows.filter((t) => t.status === opts.status);
  }
  return rows.slice(0, 200);
}

export async function countTickets(tenantId: string): Promise<number> {
  if (isDevMockDataEnabled()) return mockListTickets(tenantId).length;
  const db = getDb();
  const snap = await db
    .collection(COLLECTIONS.tickets)
    .where("tenantId", "==", tenantId)
    .count()
    .get();
  return snap.data().count;
}

export async function createTicket(input: {
  tenantId: string;
  order_id: string;
  type: TicketType;
  notes?: string;
  actorUserId: string;
}): Promise<Ticket> {
  if (isDevMockDataEnabled()) return mockCreateTicket(input);
  const db = getDb();
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
  await db.collection(COLLECTIONS.tickets).doc(id).set(ticket);
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
  return ticket;
}

export async function getTicket(
  tenantId: string,
  ticketId: string,
): Promise<Ticket | null> {
  if (isDevMockDataEnabled()) return mockGetTicket(tenantId, ticketId);
  const db = getDb();
  const snap = await db.collection(COLLECTIONS.tickets).doc(ticketId).get();
  const t = snap.data() as Ticket | undefined;
  if (!t || t.tenantId !== tenantId) return null;
  return t;
}

export async function deleteTicket(input: {
  tenantId: string;
  ticketId: string;
  actorUserId: string;
}): Promise<void> {
  if (isDevMockDataEnabled()) return mockDeleteTicket(input);
  const db = getDb();
  const ref = db.collection(COLLECTIONS.tickets).doc(input.ticketId);
  const snap = await ref.get();
  const t = snap.data() as Ticket | undefined;
  if (!t || t.tenantId !== input.tenantId) throw new Error("Ticket not found");
  await logActivity({
    tenantId: input.tenantId,
    action: "ticket.deleted",
    entityType: "ticket",
    entityId: input.ticketId,
    userId: input.actorUserId,
    metadata: { orderId: t.order_id, type: t.type, status: t.status },
  });
  await ref.delete();
}

export async function addTicketNote(input: {
  tenantId: string;
  ticketId: string;
  body: string;
  actorUserId: string;
}): Promise<Ticket> {
  if (isDevMockDataEnabled()) return mockAddTicketNote(input);
  const db = getDb();
  const ref = db.collection(COLLECTIONS.tickets).doc(input.ticketId);
  const snap = await ref.get();
  const t = snap.data() as Ticket | undefined;
  if (!t || t.tenantId !== input.tenantId) throw new Error("Ticket not found");
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
  await ref.set(next);
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
  const db = getDb();
  const ref = db.collection(COLLECTIONS.tickets).doc(input.ticketId);
  const snap = await ref.get();
  const t = snap.data() as Ticket | undefined;
  if (!t || t.tenantId !== input.tenantId) throw new Error("Ticket not found");
  const now = new Date().toISOString();
  const next: Ticket = {
    ...t,
    assigned_to: input.assigneeUserId,
    status: t.status === "open" ? "in_progress" : t.status,
    updatedAt: now,
  };
  await ref.set(next);
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
  const db = getDb();
  const ref = db.collection(COLLECTIONS.tickets).doc(input.ticketId);
  const snap = await ref.get();
  const t = snap.data() as Ticket | undefined;
  if (!t || t.tenantId !== input.tenantId) throw new Error("Ticket not found");

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
  await ref.set(next);
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
