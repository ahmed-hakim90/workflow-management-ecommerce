import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDevMockBackend } from "@/lib/dev/mock-backend";
import {
  assignTenantPackage,
  assertTenantCanCreateUser,
  assertTenantCanUseIntegration,
  createPlatformPackage,
  getTenantEntitlements,
} from "@/lib/services/platform-packages.service";
import { getPlatformTenantOverview } from "@/lib/services/platform-tenant-overview.service";

const originalDevMockData = process.env.DEV_MOCK_DATA;

beforeEach(() => {
  process.env.DEV_MOCK_DATA = "true";
  resetDevMockBackend();
});

afterAll(() => {
  if (originalDevMockData === undefined) {
    delete process.env.DEV_MOCK_DATA;
  } else {
    process.env.DEV_MOCK_DATA = originalDevMockData;
  }
});

describe("platform packages", () => {
  it("assigns packages to tenants and exposes them in platform overview", async () => {
    const pkg = await createPlatformPackage({
      name: "Growth",
      limits: { maxUsers: 25, maxOrdersPerMonth: 2000 },
      features: { outboundWebhooks: true },
      supportTier: "priority",
    });

    await assignTenantPackage({
      tenantId: "default",
      packageId: pkg.id,
      assignedBy: "test-admin",
    });

    await expect(getTenantEntitlements("default")).resolves.toMatchObject({
      tenantId: "default",
      packageId: pkg.id,
    });
    await expect(getPlatformTenantOverview("default")).resolves.toMatchObject({
      package: { id: pkg.id, name: "Growth" },
      counts: { users: 3, orders: 6 },
    });
  });

  it("enforces user limits and integration entitlements", async () => {
    const pkg = await createPlatformPackage({
      name: "Locked",
      limits: { maxUsers: 3 },
      features: { outboundWebhooks: false },
    });
    await assignTenantPackage({
      tenantId: "default",
      packageId: pkg.id,
      assignedBy: "test-admin",
    });

    await expect(assertTenantCanCreateUser("default")).rejects.toMatchObject({
      status: 402,
    });
    await expect(
      assertTenantCanUseIntegration("default", "outboundWebhooks"),
    ).rejects.toMatchObject({ status: 402 });
    await expect(
      assertTenantCanUseIntegration("default", "woocommerce"),
    ).resolves.toBeUndefined();
  });
});
