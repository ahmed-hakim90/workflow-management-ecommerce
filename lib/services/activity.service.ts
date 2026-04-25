import { getDb } from "@/lib/db/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";
import type { ActivityEntityType, ActivityLog } from "@/lib/types/models";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import {
  mockAppendActivity,
  mockListActivities,
} from "@/lib/dev/mock-backend";

export async function logActivity(input: {
  tenantId: string;
  action: string;
  entityType: ActivityEntityType;
  entityId: string;
  userId: string;
  metadata?: Record<string, unknown>;
}) {
  if (isDevMockDataEnabled()) {
    mockAppendActivity(input);
    return;
  }
  const db = getDb();
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  await db.collection(COLLECTIONS.activityLogs).doc(id).set({
    id,
    tenantId: input.tenantId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    userId: input.userId,
    metadata: input.metadata ?? {},
    timestamp,
  });
}

export async function listActivitiesForEntity(input: {
  tenantId: string;
  entityType: ActivityEntityType;
  entityId: string;
  limit?: number;
}): Promise<ActivityLog[]> {
  const limit = Math.min(input.limit ?? 100, 500);
  if (isDevMockDataEnabled()) {
    return mockListActivities({
      tenantId: input.tenantId,
      entityType: input.entityType,
      entityId: input.entityId,
      limit,
    });
  }
  const db = getDb();
  const q = await db
    .collection(COLLECTIONS.activityLogs)
    .where("tenantId", "==", input.tenantId)
    .where("entityType", "==", input.entityType)
    .where("entityId", "==", input.entityId)
    .orderBy("timestamp", "desc")
    .limit(limit)
    .get();
  return q.docs.map((d) => d.data() as ActivityLog);
}
