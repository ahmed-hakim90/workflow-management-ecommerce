import { z } from "zod";
import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonError, jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import {
  deleteAccount,
  updateAccount,
  type AccountType,
} from "@/lib/repositories/accounts.repository";

export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ accountId: string }>;
};

const accountSchema = z.object({
  parentId: z.string().uuid().nullable().optional(),
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(120),
  nameAr: z.string().trim().min(1).max(120),
  accountType: z.enum(["asset", "liability", "equity", "revenue", "expense"]),
  notes: z.string().trim().max(500).nullable().optional(),
});

export async function PUT(req: Request, { params }: RouteParams) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "account:manage");
    const { accountId } = await params;
    const body = accountSchema.parse(await req.json());

    const account = await updateAccount(ctx.tenantId, accountId, {
      parentId: body.parentId ?? null,
      code: body.code,
      name: body.name,
      nameAr: body.nameAr,
      accountType: body.accountType as AccountType,
      notes: body.notes ?? null,
    });
    if (!account) return jsonError("Account not found", 404);
    return jsonOk({ account });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "account:manage");
    const { accountId } = await params;

    const deleted = await deleteAccount(ctx.tenantId, accountId);
    if (!deleted) return jsonError("Account not found", 404);
    return jsonOk({ deleted: true });
  } catch (e) {
    return handleRouteError(e);
  }
}
