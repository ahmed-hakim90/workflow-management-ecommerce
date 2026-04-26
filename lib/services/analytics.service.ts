import type { OrderStatus } from "@/lib/types/models";
import { getDb } from "@/lib/db/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";
import type { UserStats } from "@/lib/types/models";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import { mockGetUserStatsForToday } from "@/lib/dev/mock-backend";
import { listOrders } from "@/lib/services/orders.service";
import {
  getTenantOrderStageRollup,
  rebuildTenantOrderStageRollup,
} from "@/lib/services/order-stage-rollup.service";

const KANBAN_STATUSES: OrderStatus[] = [
  "pending_confirmation",
  "confirmed",
  "invoicing",
  "ready_for_warehouse",
  "packed",
  "shipped",
];

export async function getOrdersPerStage(tenantId: string) {
  if (isDevMockDataEnabled()) {
    const orders = await listOrders(tenantId);
    const counts: Record<string, number> = {};
    for (const s of KANBAN_STATUSES) counts[s] = 0;
    for (const o of orders) {
      if (o.status in counts) {
        counts[o.status] += 1;
      }
    }
    return {
      ...counts,
      warehouse: (counts["ready_for_warehouse"] ?? 0) + (counts["packed"] ?? 0),
    };
  }

  let rollup = await getTenantOrderStageRollup(tenantId);
  if (!rollup) {
    await rebuildTenantOrderStageRollup(tenantId);
    rollup = await getTenantOrderStageRollup(tenantId);
  }

  const stages = rollup?.stages;
  if (!stages) {
    const z: Record<string, number> = {};
    for (const s of KANBAN_STATUSES) z[s] = 0;
    return { ...z, warehouse: 0 };
  }

  return {
    ...stages,
    warehouse:
      (stages.ready_for_warehouse ?? 0) + (stages.packed ?? 0),
  };
}

export async function getUserStatsForToday(
  tenantId: string,
  userId: string,
): Promise<UserStats | null> {
  if (isDevMockDataEnabled()) return mockGetUserStatsForToday(tenantId, userId);
  const date = new Date().toISOString().slice(0, 10);
  const id = `${tenantId}_${userId}_${date}`;
  const db = getDb();
  const snap = await db.collection(COLLECTIONS.userStats).doc(id).get();
  if (!snap.exists) {
    return {
      id,
      tenantId,
      userId,
      date,
      confirmed: 0,
      invoiced: 0,
      packed: 0,
      updatedAt: new Date().toISOString(),
    };
  }
  return snap.data() as UserStats;
}
