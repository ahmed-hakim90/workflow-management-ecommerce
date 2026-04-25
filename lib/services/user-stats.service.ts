import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@/lib/db/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import { mockIncrementUserStat } from "@/lib/dev/mock-backend";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export async function incrementUserStat(input: {
  tenantId: string;
  userId: string;
  field: "confirmed" | "invoiced" | "packed";
}) {
  if (isDevMockDataEnabled()) {
    mockIncrementUserStat(input);
    return;
  }
  const db = getDb();
  const date = todayKey();
  const id = `${input.tenantId}_${input.userId}_${date}`;
  const ref = db.collection(COLLECTIONS.userStats).doc(id);
  await ref.set(
    {
      id,
      tenantId: input.tenantId,
      userId: input.userId,
      date,
      [input.field]: FieldValue.increment(1),
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}
