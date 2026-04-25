import { getDb } from "@/lib/db/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import {
  mockListTickets,
  mockCreateTicket,
  mockAssignTicket,
  mockResolveTicket,
} from "@/lib/dev/mock-backend";
import type { Ticket, TicketStatus, TicketType } from "@/lib/types/models";
import { logActivity } from "@/lib/services/activity.service";
import { createShipmentForOrder } from "@/lib/services/shipments.service";

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
  const ticket: Ticket = {
    id,
    tenantId: input.tenantId,
    order_id: input.order_id,
    type: input.type,
    status: "open",
    notes: input.notes,
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
  return ticket;
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
  actorUserId: string;
}): Promise<Ticket> {
  if (isDevMockDataEnabled()) return mockResolveTicket(input);
  const db = getDb();
  const ref = db.collection(COLLECTIONS.tickets).doc(input.ticketId);
  const snap = await ref.get();
  const t = snap.data() as Ticket | undefined;
  if (!t || t.tenantId !== input.tenantId) throw new Error("Ticket not found");

  const shipmentIds = [...(t.shipmentIds ?? [])];
  if (input.createExchangeShipment && t.type === "exchange") {
    const s = await createShipmentForOrder({
      tenantId: input.tenantId,
      orderId: t.order_id,
      type: "exchange",
      actorUserId: input.actorUserId,
    });
    shipmentIds.push(s.id);
  }

  const now = new Date().toISOString();
  const next: Ticket = {
    ...t,
    shipmentIds,
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
  });
  return next;
}
