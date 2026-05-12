import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import {
  listChatConversations,
  listWarehouseLinkedConversations,
} from "@/lib/services/chat/conversations.service";
import { getUser } from "@/lib/services/users.service";
import type { InboxListFilter } from "@/lib/types/chat";

const FILTERS: InboxListFilter[] = [
  "all",
  "unread",
  "mine",
  "bot",
  "needs_human",
  "closed",
];

export async function GET(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "inbox:read");
    const url = new URL(req.url);
    const raw = url.searchParams.get("filter") ?? "all";
    const filter = (FILTERS.includes(raw as InboxListFilter)
      ? raw
      : "all") as InboxListFilter;

    if (ctx.role === "warehouse") {
      const linkedOrderId = url.searchParams.get("linkedOrderId")?.trim();
      if (!linkedOrderId) {
        return jsonOk([]);
      }
      const rows = await listWarehouseLinkedConversations({
        tenantId: ctx.tenantId,
        linkedOrderId,
      });
      return jsonOk(rows);
    }

    const onlyLinkedOrders = ctx.role === "confirmation";
    const limitRaw = Number(url.searchParams.get("limit") ?? "200");
    const maxRows = Number.isFinite(limitRaw)
      ? Math.min(200, Math.max(1, Math.floor(limitRaw)))
      : 200;
    const searchPhoneContains =
      url.searchParams.get("phoneContains")?.trim() || undefined;
    const department = url.searchParams.get("department")?.trim() || undefined;
    const cursor = url.searchParams.get("cursor")?.trim() || undefined;
    const { conversations: rawRows, nextCursor } = await listChatConversations({
      tenantId: ctx.tenantId,
      filter,
      userId: ctx.userId,
      onlyLinkedOrders,
      maxRows,
      searchPhoneContains,
      department,
      startAfterId: cursor,
    });

    let rows = rawRows;
    const userIds = [
      ...new Set(
        rows.map((r) => r.assignedUserId).filter(Boolean) as string[],
      ),
    ];
    const names: Record<string, string> = {};
    await Promise.all(
      userIds.map(async (uid) => {
        const u = await getUser(ctx.tenantId, uid);
        if (u) names[uid] = u.name;
      }),
    );
    rows = rows.map((r) => ({
      ...r,
      assignedUserName: r.assignedUserId
        ? names[r.assignedUserId] ?? r.assignedUserName
        : r.assignedUserName,
    }));

    return jsonOk({ conversations: rows, nextCursor });
  } catch (e) {
    return handleRouteError(e);
  }
}
