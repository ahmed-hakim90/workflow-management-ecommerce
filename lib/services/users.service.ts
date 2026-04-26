import { getDb } from "@/lib/db/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import {
  mockListUsers,
  mockCreateUser,
  mockGetUser,
  mockGetUserByFirebaseUid,
  mockUpdateUser,
} from "@/lib/dev/mock-backend";
import type { User, UserRole } from "@/lib/types/models";
import { logActivity } from "@/lib/services/activity.service";

export async function listUsers(tenantId: string): Promise<User[]> {
  if (isDevMockDataEnabled()) return mockListUsers(tenantId);
  const db = getDb();
  const q = await db
    .collection(COLLECTIONS.users)
    .where("tenantId", "==", tenantId)
    .get();
  return q.docs.map((d) => d.data() as User);
}

export async function createUser(input: {
  tenantId: string;
  name: string;
  email?: string;
  firebaseUid?: string;
  role: UserRole;
  permissions?: string[];
  daily_target?: number;
  actorUserId: string;
}): Promise<User> {
  if (isDevMockDataEnabled()) return mockCreateUser(input);
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const user: User = {
    id,
    tenantId: input.tenantId,
    name: input.name,
    email: input.email,
    firebaseUid: input.firebaseUid,
    role: input.role,
    permissions: input.permissions ?? [],
    daily_target: input.daily_target ?? 0,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection(COLLECTIONS.users).doc(id).set(user);
  await logActivity({
    tenantId: input.tenantId,
    action: "user.created",
    entityType: "user",
    entityId: id,
    userId: input.actorUserId,
    metadata: { role: input.role },
  });
  return user;
}

export async function getUser(
  tenantId: string,
  userId: string,
): Promise<User | null> {
  if (isDevMockDataEnabled()) return mockGetUser(tenantId, userId);
  const db = getDb();
  const snap = await db.collection(COLLECTIONS.users).doc(userId).get();
  const u = snap.data() as User | undefined;
  if (!u || u.tenantId !== tenantId) return null;
  return u;
}

export async function getUserByFirebaseUid(
  firebaseUid: string,
): Promise<User | null> {
  if (isDevMockDataEnabled()) return mockGetUserByFirebaseUid(firebaseUid);
  const db = getDb();
  const q = await db
    .collection(COLLECTIONS.users)
    .where("firebaseUid", "==", firebaseUid)
    .limit(1)
    .get();
  if (q.empty) return null;
  return q.docs[0].data() as User;
}

export async function updateUser(input: {
  tenantId: string;
  targetUserId: string;
  name?: string;
  role?: UserRole;
  daily_target?: number;
  actorUserId: string;
}): Promise<User> {
  if (isDevMockDataEnabled()) return mockUpdateUser(input);
  const db = getDb();
  const ref = db.collection(COLLECTIONS.users).doc(input.targetUserId);
  const snap = await ref.get();
  const prev = snap.data() as User | undefined;
  if (!prev || prev.tenantId !== input.tenantId) {
    throw new Error("User not found");
  }
  const now = new Date().toISOString();
  const next: User = {
    ...prev,
    name: input.name ?? prev.name,
    role: input.role ?? prev.role,
    daily_target:
      input.daily_target !== undefined ? input.daily_target : prev.daily_target,
    updatedAt: now,
  };
  await ref.set(next);
  await logActivity({
    tenantId: input.tenantId,
    action: "user.updated",
    entityType: "user",
    entityId: input.targetUserId,
    userId: input.actorUserId,
    metadata: { role: next.role, daily_target: next.daily_target },
  });
  return next;
}
