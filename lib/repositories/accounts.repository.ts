import { getSupabaseServiceRoleClient } from "@/lib/db/supabase-server";
import { isDevMockDataEnabled } from "@/lib/dev/mock-flag";

export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";

export type ChartAccount = {
  id: string;
  tenantId: string;
  parentId: string | null;
  code: string;
  name: string;
  nameAr: string;
  accountType: AccountType;
  isSystem: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AccountWriteInput = {
  parentId?: string | null;
  code: string;
  name: string;
  nameAr: string;
  accountType: AccountType;
  notes?: string | null;
};

type AccountRow = {
  id: string;
  tenant_id: string;
  parent_id: string | null;
  code: string;
  name: string;
  name_ar: string;
  account_type: AccountType;
  is_system: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const mockAccounts: ChartAccount[] = [];

function rowToAccount(row: AccountRow): ChartAccount {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    parentId: row.parent_id,
    code: row.code,
    name: row.name,
    nameAr: row.name_ar,
    accountType: row.account_type,
    isSystem: row.is_system,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function accountToRow(account: ChartAccount): AccountRow {
  return {
    id: account.id,
    tenant_id: account.tenantId,
    parent_id: account.parentId,
    code: account.code,
    name: account.name,
    name_ar: account.nameAr,
    account_type: account.accountType,
    is_system: account.isSystem,
    notes: account.notes,
    created_at: account.createdAt,
    updated_at: account.updatedAt,
  };
}

function normalizeInput(input: AccountWriteInput): AccountWriteInput {
  return {
    parentId: input.parentId ?? null,
    code: input.code.trim(),
    name: input.name.trim(),
    nameAr: input.nameAr.trim(),
    accountType: input.accountType,
    notes: input.notes?.trim() ? input.notes.trim() : null,
  };
}

function sortAccounts(accounts: ChartAccount[]) {
  return [...accounts].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
}

function defaultMockAccounts(tenantId: string): ChartAccount[] {
  const now = new Date().toISOString();
  const root = (
    code: string,
    name: string,
    nameAr: string,
    accountType: AccountType,
  ): ChartAccount => ({
    id: crypto.randomUUID(),
    tenantId,
    parentId: null,
    code,
    name,
    nameAr,
    accountType,
    isSystem: true,
    notes: null,
    createdAt: now,
    updatedAt: now,
  });

  const roots = [
    root("1000", "Assets", "الأصول", "asset"),
    root("2000", "Liabilities", "الالتزامات", "liability"),
    root("3000", "Equity", "حقوق الملكية", "equity"),
    root("4000", "Revenue", "الإيرادات", "revenue"),
    root("5000", "Expenses", "المصروفات", "expense"),
  ];
  const byCode = new Map(roots.map((account) => [account.code, account]));
  const child = (
    parentCode: string,
    code: string,
    name: string,
    nameAr: string,
    accountType: AccountType,
  ): ChartAccount => ({
    id: crypto.randomUUID(),
    tenantId,
    parentId: byCode.get(parentCode)?.id ?? null,
    code,
    name,
    nameAr,
    accountType,
    isSystem: true,
    notes: null,
    createdAt: now,
    updatedAt: now,
  });

  return [
    ...roots,
    child("1000", "1100", "Cash on Hand", "النقدية بالخزينة", "asset"),
    child("1000", "1200", "Bank Accounts", "حسابات البنوك", "asset"),
    child("1000", "1300", "Accounts Receivable", "العملاء وأوراق القبض", "asset"),
    child("1000", "1400", "Inventory", "المخزون", "asset"),
    child("1000", "1500", "COD Receivable", "تحصيلات الدفع عند الاستلام", "asset"),
    child("2000", "2100", "Accounts Payable", "الموردون وأوراق الدفع", "liability"),
    child("2000", "2200", "Carrier Payables", "مستحقات شركات الشحن", "liability"),
    child("3000", "3100", "Owner Capital", "رأس المال", "equity"),
    child("4000", "4100", "Product Sales", "مبيعات المنتجات", "revenue"),
    child("4000", "4200", "Shipping Revenue", "إيرادات الشحن", "revenue"),
    child("5000", "5100", "Cost of Goods Sold", "تكلفة البضاعة المباعة", "expense"),
    child("5000", "5200", "Shipping Costs", "تكلفة الشحن", "expense"),
  ];
}

function ensureMockSeeded(tenantId: string) {
  if (mockAccounts.some((account) => account.tenantId === tenantId)) return;
  mockAccounts.push(...defaultMockAccounts(tenantId));
}

export async function listAccounts(tenantId: string): Promise<ChartAccount[]> {
  if (isDevMockDataEnabled()) {
    ensureMockSeeded(tenantId);
    return sortAccounts(mockAccounts.filter((account) => account.tenantId === tenantId));
  }

  const { data, error } = await getSupabaseServiceRoleClient()
    .from("chart_of_accounts")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("code", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => rowToAccount(row as AccountRow));
}

export async function getAccount(
  tenantId: string,
  accountId: string,
): Promise<ChartAccount | null> {
  if (isDevMockDataEnabled()) {
    ensureMockSeeded(tenantId);
    return mockAccounts.find((account) => account.tenantId === tenantId && account.id === accountId) ?? null;
  }

  const { data, error } = await getSupabaseServiceRoleClient()
    .from("chart_of_accounts")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", accountId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToAccount(data as AccountRow) : null;
}

async function assertParentIsValid(
  tenantId: string,
  parentId: string | null,
  accountType: AccountType,
  accountId?: string,
) {
  if (!parentId) return;
  if (parentId === accountId) throw Object.assign(new Error("Account cannot be its own parent"), { status: 400 });
  const parent = await getAccount(tenantId, parentId);
  if (!parent) throw Object.assign(new Error("Parent account not found"), { status: 404 });
  if (parent.accountType !== accountType) {
    throw Object.assign(new Error("Parent account type must match child account type"), { status: 400 });
  }
}

function assertNoCircularParent(accounts: ChartAccount[], accountId: string, parentId: string | null) {
  let cursor = parentId;
  while (cursor) {
    if (cursor === accountId) {
      throw Object.assign(new Error("Parent account cannot be a descendant"), { status: 400 });
    }
    cursor = accounts.find((account) => account.id === cursor)?.parentId ?? null;
  }
}

export async function createAccount(
  tenantId: string,
  input: AccountWriteInput,
): Promise<ChartAccount> {
  const normalized = normalizeInput(input);
  await assertParentIsValid(tenantId, normalized.parentId ?? null, normalized.accountType);

  const now = new Date().toISOString();
  const account: ChartAccount = {
    id: crypto.randomUUID(),
    tenantId,
    parentId: normalized.parentId ?? null,
    code: normalized.code,
    name: normalized.name,
    nameAr: normalized.nameAr,
    accountType: normalized.accountType,
    isSystem: false,
    notes: normalized.notes ?? null,
    createdAt: now,
    updatedAt: now,
  };

  if (isDevMockDataEnabled()) {
    ensureMockSeeded(tenantId);
    if (mockAccounts.some((existing) => existing.tenantId === tenantId && existing.code === account.code)) {
      throw Object.assign(new Error("Account code already exists"), { status: 409 });
    }
    mockAccounts.push(account);
    return account;
  }

  const { data, error } = await getSupabaseServiceRoleClient()
    .from("chart_of_accounts")
    .insert(accountToRow(account))
    .select("*")
    .single();
  if (error) throw error;
  return rowToAccount(data as AccountRow);
}

export async function updateAccount(
  tenantId: string,
  accountId: string,
  input: AccountWriteInput,
): Promise<ChartAccount | null> {
  const prev = await getAccount(tenantId, accountId);
  if (!prev) return null;

  const normalized = normalizeInput(input);
  await assertParentIsValid(tenantId, normalized.parentId ?? null, normalized.accountType, accountId);
  const accounts = await listAccounts(tenantId);
  assertNoCircularParent(accounts, accountId, normalized.parentId ?? null);
  if (
    normalized.accountType !== prev.accountType &&
    accounts.some((account) => account.parentId === accountId)
  ) {
    throw Object.assign(new Error("Cannot change account type while sub-accounts exist"), { status: 400 });
  }

  const updated: ChartAccount = {
    ...prev,
    parentId: normalized.parentId ?? null,
    code: normalized.code,
    name: normalized.name,
    nameAr: normalized.nameAr,
    accountType: normalized.accountType,
    notes: normalized.notes ?? null,
    updatedAt: new Date().toISOString(),
  };

  if (isDevMockDataEnabled()) {
    const duplicate = mockAccounts.some(
      (existing) =>
        existing.tenantId === tenantId &&
        existing.id !== accountId &&
        existing.code === updated.code,
    );
    if (duplicate) throw Object.assign(new Error("Account code already exists"), { status: 409 });
    const index = mockAccounts.findIndex((account) => account.tenantId === tenantId && account.id === accountId);
    if (index >= 0) mockAccounts[index] = updated;
    return updated;
  }

  const { data, error } = await getSupabaseServiceRoleClient()
    .from("chart_of_accounts")
    .update(accountToRow(updated))
    .eq("tenant_id", tenantId)
    .eq("id", accountId)
    .select("*")
    .single();
  if (error) throw error;
  return rowToAccount(data as AccountRow);
}

export async function deleteAccount(tenantId: string, accountId: string): Promise<boolean> {
  const account = await getAccount(tenantId, accountId);
  if (!account) return false;
  if (account.isSystem) {
    throw Object.assign(new Error("System accounts cannot be deleted"), { status: 400 });
  }

  const children = (await listAccounts(tenantId)).filter((child) => child.parentId === accountId);
  if (children.length > 0) {
    throw Object.assign(new Error("Cannot delete an account that has sub-accounts"), { status: 400 });
  }

  if (isDevMockDataEnabled()) {
    const index = mockAccounts.findIndex((existing) => existing.tenantId === tenantId && existing.id === accountId);
    if (index >= 0) mockAccounts.splice(index, 1);
    return true;
  }

  const { error } = await getSupabaseServiceRoleClient()
    .from("chart_of_accounts")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", accountId);
  if (error) throw error;
  return true;
}
