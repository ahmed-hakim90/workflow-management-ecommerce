import { z } from "zod";
import { requireTenant } from "@/lib/auth/context";
import { assertCan } from "@/lib/auth/rbac";
import { jsonOk } from "@/lib/http/json";
import { handleRouteError } from "@/lib/http/with-api";
import {
  createAccount,
  listAccounts,
  type AccountType,
} from "@/lib/repositories/accounts.repository";

export const runtime = "nodejs";

const accountSchema = z.object({
  parentId: z.string().uuid().nullable().optional(),
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(120),
  nameAr: z.string().trim().min(1).max(120),
  accountType: z.enum(["asset", "liability", "equity", "revenue", "expense"]),
  notes: z.string().trim().max(500).nullable().optional(),
});

export async function GET(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "account:read");

    const accounts = await listAccounts(ctx.tenantId);
    return jsonOk({ accounts });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireTenant(req);
    assertCan(ctx, "account:manage");
    const body = accountSchema.parse(await req.json());

    const account = await createAccount(ctx.tenantId, {
      parentId: body.parentId ?? null,
      code: body.code,
      name: body.name,
      nameAr: body.nameAr,
      accountType: body.accountType as AccountType,
      notes: body.notes ?? null,
    });
    return jsonOk({ account }, { status: 201 });
  } catch (e) {
    return handleRouteError(e);
  }
}
