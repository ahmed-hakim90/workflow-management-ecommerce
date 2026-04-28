import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDevMockBackend } from "@/lib/dev/mock-backend";
import { requirePlatformAdmin } from "@/lib/auth/platform-context";

const originalDevMockData = process.env.DEV_MOCK_DATA;
const originalSecret = process.env.PLATFORM_ADMIN_SECRET;

beforeEach(() => {
  process.env.DEV_MOCK_DATA = "true";
  delete process.env.PLATFORM_ADMIN_SECRET;
  resetDevMockBackend();
});

afterAll(() => {
  if (originalDevMockData === undefined) {
    delete process.env.DEV_MOCK_DATA;
  } else {
    process.env.DEV_MOCK_DATA = originalDevMockData;
  }
  if (originalSecret === undefined) {
    delete process.env.PLATFORM_ADMIN_SECRET;
  } else {
    process.env.PLATFORM_ADMIN_SECRET = originalSecret;
  }
});

function requestWithToken(token: string) {
  return new Request("https://oms.example.test/api/platform/companies", {
    headers: { authorization: `Bearer ${token}` },
  });
}

describe("requirePlatformAdmin", () => {
  it("accepts the separate platform admin token in mock mode", async () => {
    await expect(
      requirePlatformAdmin(requestWithToken("dev-super-admin")),
    ).resolves.toMatchObject({
      adminId: "platform-admin",
      role: "owner",
      authenticated: true,
    });
  });

  it("rejects tenant staff API keys and role headers", async () => {
    const req = new Request("https://oms.example.test/api/platform/companies", {
      headers: {
        authorization: "Bearer demo-staff-api-key-mock-only",
        "x-tenant-id": "default",
        "x-user-id": "user-admin-1",
        "x-user-role": "admin",
      },
    });

    await expect(requirePlatformAdmin(req)).rejects.toMatchObject({
      status: 401,
    });
  });
});
