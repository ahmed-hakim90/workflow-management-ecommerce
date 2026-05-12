import { getSupabaseServiceRoleClient } from "@/lib/db/supabase-server";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";
import {
  mockClaimIntegrationEvent,
  mockReleaseIntegrationEventClaim,
} from "@/lib/dev/mock-backend";

/**
 * Idempotency for inbound webhook deliveries only.
 * `deliveryId` is the provider's webhook delivery id, not an OMS shipment id.
 */
export async function claimIntegrationEvent(input: {
  tenantId: string;
  source: string;
  deliveryId: string;
  payloadSummary?: Record<string, unknown>;
}): Promise<"new" | "duplicate"> {
  if (isDevMockDataEnabled()) return mockClaimIntegrationEvent(input);
  const { error } = await getSupabaseServiceRoleClient()
    .from("integration_events")
    .insert({
      tenant_id: input.tenantId,
      source: input.source,
      delivery_id: input.deliveryId,
      payload_hash: JSON.stringify(input.payloadSummary ?? {}),
    });
  if (error) {
    if (error.code === "23505") return "duplicate";
    throw error;
  }
  return "new";
}

/**
 * Call when processing failed after a fresh `claimIntegrationEvent` so the same
 * `deliveryId` can be retried (e.g. WooCommerce re-sends the webhook).
 */
export async function releaseIntegrationEventClaim(input: {
  tenantId: string;
  source: string;
  deliveryId: string;
}): Promise<void> {
  if (isDevMockDataEnabled()) {
    mockReleaseIntegrationEventClaim(input);
    return;
  }
  const { error } = await getSupabaseServiceRoleClient()
    .from("integration_events")
    .delete()
    .eq("tenant_id", input.tenantId)
    .eq("source", input.source)
    .eq("delivery_id", input.deliveryId);
  if (error) throw error;
}
