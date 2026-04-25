import { getDb } from "@/lib/db/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import { mockClaimIntegrationEvent } from "@/lib/dev/mock-backend";

/**
 * Idempotency for webhooks using a stable external delivery id.
 */
export async function claimIntegrationEvent(input: {
  tenantId: string;
  source: string;
  deliveryId: string;
  payloadSummary?: Record<string, unknown>;
}): Promise<"new" | "duplicate"> {
  if (isDevMockDataEnabled()) return mockClaimIntegrationEvent(input);
  const db = getDb();
  const id = `${input.tenantId}_${input.source}_${input.deliveryId}`;
  const ref = db.collection(COLLECTIONS.integrationEvents).doc(id);
  const snap = await ref.get();
  if (snap.exists) return "duplicate";
  await ref.set({
    id,
    tenantId: input.tenantId,
    source: input.source,
    deliveryId: input.deliveryId,
    payloadSummary: input.payloadSummary ?? {},
    createdAt: new Date().toISOString(),
  });
  return "new";
}
