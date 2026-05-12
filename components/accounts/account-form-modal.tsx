"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type {
  AccountType,
  AccountWriteInput,
  ChartAccount,
} from "@/lib/repositories/accounts.repository";

const ACCOUNT_TYPES: { id: AccountType; label: string }[] = [
  { id: "asset", label: "Assets" },
  { id: "liability", label: "Liabilities" },
  { id: "equity", label: "Equity" },
  { id: "revenue", label: "Revenue" },
  { id: "expense", label: "Expenses" },
];

type AccountFormState = {
  parentId: string;
  code: string;
  name: string;
  nameAr: string;
  accountType: AccountType;
  notes: string;
};

function formFromAccount(
  account: ChartAccount | null,
  parentAccount: ChartAccount | null,
): AccountFormState {
  if (account) {
    return {
      parentId: account.parentId ?? "",
      code: account.code,
      name: account.name,
      nameAr: account.nameAr,
      accountType: account.accountType,
      notes: account.notes ?? "",
    };
  }
  return {
    parentId: parentAccount?.id ?? "",
    code: "",
    name: "",
    nameAr: "",
    accountType: parentAccount?.accountType ?? "asset",
    notes: "",
  };
}

function accountDepth(account: ChartAccount, byId: Map<string, ChartAccount>) {
  let depth = 0;
  let cursor = account.parentId ? byId.get(account.parentId) : null;
  while (cursor) {
    depth += 1;
    cursor = cursor.parentId ? byId.get(cursor.parentId) : null;
  }
  return depth;
}

function descendantIds(accountId: string, accounts: ChartAccount[]) {
  const out = new Set<string>();
  const visit = (parentId: string) => {
    for (const account of accounts) {
      if (account.parentId !== parentId) continue;
      out.add(account.id);
      visit(account.id);
    }
  };
  visit(accountId);
  return out;
}

export function AccountFormModal({
  open,
  account,
  parentAccount,
  accounts,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean;
  account: ChartAccount | null;
  parentAccount: ChartAccount | null;
  accounts: ChartAccount[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (input: AccountWriteInput) => Promise<void>;
}) {
  const [form, setForm] = useState<AccountFormState>(() =>
    formFromAccount(account, parentAccount),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(formFromAccount(account, parentAccount));
    setError(null);
  }, [account, parentAccount, open]);

  const byId = useMemo(() => new Map(accounts.map((item) => [item.id, item])), [accounts]);
  const excludedParentIds = useMemo(
    () => (account ? descendantIds(account.id, accounts).add(account.id) : new Set<string>()),
    [account, accounts],
  );
  const parentOptions = useMemo(
    () =>
      accounts
        .filter((item) => !excludedParentIds.has(item.id))
        .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })),
    [accounts, excludedParentIds],
  );

  const selectedParent = form.parentId ? byId.get(form.parentId) : null;

  useEffect(() => {
    if (!selectedParent) return;
    if (form.accountType === selectedParent.accountType) return;
    setForm((current) => ({ ...current, accountType: selectedParent.accountType }));
  }, [form.accountType, selectedParent]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const payload: AccountWriteInput = {
      parentId: form.parentId || null,
      code: form.code.trim(),
      name: form.name.trim(),
      nameAr: form.nameAr.trim(),
      accountType: form.accountType,
      notes: form.notes.trim() || null,
    };
    if (!payload.code || !payload.name || !payload.nameAr) {
      setError("Code, English name, and Arabic name are required.");
      return;
    }
    try {
      await onSubmit(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <Modal
      open={open}
      title={account ? "Edit account" : "Add account"}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="account-form" loading={saving}>
            {account ? "Save changes" : "Create account"}
          </Button>
        </div>
      }
    >
      <form id="account-form" className="space-y-4" onSubmit={(e) => void submit(e)}>
        {error ? <p className="text-sm text-[color:var(--color-error)]">{error}</p> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Code"
            value={form.code}
            onChange={(e) => setForm((current) => ({ ...current, code: e.target.value }))}
            placeholder="1100"
            maxLength={20}
          />
          <Select
            label="Type"
            value={form.accountType}
            disabled={Boolean(selectedParent)}
            onChange={(e) =>
              setForm((current) => ({
                ...current,
                accountType: e.target.value as AccountType,
                parentId: "",
              }))
            }
          >
            {ACCOUNT_TYPES.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </Select>
        </div>
        <Input
          label="English name"
          value={form.name}
          onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
          placeholder="Accounts Receivable"
          maxLength={120}
        />
        <Input
          label="Arabic name"
          value={form.nameAr}
          onChange={(e) => setForm((current) => ({ ...current, nameAr: e.target.value }))}
          placeholder="العملاء وأوراق القبض"
          maxLength={120}
          dir="rtl"
        />
        <Select
          label="Parent account"
          value={form.parentId}
          onChange={(e) => {
            const nextParent = e.target.value ? byId.get(e.target.value) : null;
            setForm((current) => ({
              ...current,
              parentId: e.target.value,
              accountType: nextParent?.accountType ?? current.accountType,
            }));
          }}
        >
          <option value="">No parent (root account)</option>
          {parentOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {"— ".repeat(accountDepth(item, byId))}
              {item.code} · {item.name}
            </option>
          ))}
        </Select>
        <Textarea
          label="Notes"
          value={form.notes}
          onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))}
          placeholder="Optional operational notes"
          maxLength={500}
        />
      </form>
    </Modal>
  );
}
