"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { AccountFormModal } from "@/components/accounts/account-form-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buildAuthHeaders, useSessionStore } from "@/store/zustand/session-store";
import { can } from "@/lib/auth/rbac";
import { cn } from "@/lib/ui/cn";
import type {
  AccountType,
  AccountWriteInput,
  ChartAccount,
} from "@/lib/repositories/accounts.repository";

const ACCOUNT_GROUPS: { id: AccountType; title: string; titleAr: string }[] = [
  { id: "asset", title: "Assets", titleAr: "الأصول" },
  { id: "liability", title: "Liabilities", titleAr: "الالتزامات" },
  { id: "equity", title: "Equity", titleAr: "حقوق الملكية" },
  { id: "revenue", title: "Revenue", titleAr: "الإيرادات" },
  { id: "expense", title: "Expenses", titleAr: "المصروفات" },
];

const TYPE_TONE: Record<AccountType, React.ComponentProps<typeof Badge>["tone"]> = {
  asset: "info",
  liability: "warning",
  equity: "agentTask",
  revenue: "success",
  expense: "danger",
};

type ModalState = {
  account: ChartAccount | null;
  parentAccount: ChartAccount | null;
};

type AccountsResponse = {
  data?: {
    accounts?: ChartAccount[];
    account?: ChartAccount;
  };
  error?: string;
};

function childrenByParent(accounts: ChartAccount[]) {
  const map = new Map<string, ChartAccount[]>();
  for (const account of accounts) {
    const parentKey = account.parentId ?? "root";
    const children = map.get(parentKey) ?? [];
    children.push(account);
    map.set(parentKey, children);
  }
  for (const children of map.values()) {
    children.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }
  return map;
}

function AccountNode({
  account,
  depth,
  childrenMap,
  expanded,
  canManage,
  onToggle,
  onAddChild,
  onEdit,
  onDelete,
}: {
  account: ChartAccount;
  depth: number;
  childrenMap: Map<string, ChartAccount[]>;
  expanded: Set<string>;
  canManage: boolean;
  onToggle: (id: string) => void;
  onAddChild: (account: ChartAccount) => void;
  onEdit: (account: ChartAccount) => void;
  onDelete: (account: ChartAccount) => void;
}) {
  const children = childrenMap.get(account.id) ?? [];
  const hasChildren = children.length > 0;
  const isExpanded = expanded.has(account.id);

  return (
    <li>
      <div
        className={cn(
          "flex min-h-12 items-center gap-2 rounded-[var(--ds-radius-md)] border border-[color:var(--color-border-subtle)] bg-[color:var(--color-card)] px-3 py-2",
          depth > 0 && "bg-[color:var(--color-muted-bg)]/50",
        )}
        style={{ marginInlineStart: depth ? `${depth * 18}px` : undefined }}
      >
        <button
          type="button"
          className="flex size-7 shrink-0 items-center justify-center rounded-[var(--ds-radius-sm)] text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-hover-bg)]"
          onClick={() => hasChildren && onToggle(account.id)}
          disabled={!hasChildren}
          aria-label={isExpanded ? "Collapse account" : "Expand account"}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="size-4" aria-hidden />
            ) : (
              <ChevronRight className="size-4" aria-hidden />
            )
          ) : (
            <span className="size-1.5 rounded-full bg-[color:var(--color-border)]" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[13px] font-semibold text-[color:var(--color-text-primary)]">
              {account.code}
            </span>
            <span className="truncate text-sm font-medium text-[color:var(--color-text-primary)]">
              {account.name}
            </span>
            <span className="truncate text-xs text-[color:var(--color-text-muted)]" dir="rtl">
              {account.nameAr}
            </span>
          </div>
          {account.notes ? (
            <p className="mt-1 line-clamp-1 text-xs text-[color:var(--color-text-muted)]">
              {account.notes}
            </p>
          ) : null}
        </div>
        <Badge tone={TYPE_TONE[account.accountType]} className="hidden sm:inline-flex">
          {account.accountType}
        </Badge>
        {account.isSystem ? (
          <Badge tone="default" className="hidden sm:inline-flex">
            System
          </Badge>
        ) : null}
        {canManage ? (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="px-2"
              onClick={() => onAddChild(account)}
              title="Add sub-account"
            >
              <Plus className="size-4" aria-hidden />
              <span className="sr-only">Add sub-account</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="px-2"
              onClick={() => onEdit(account)}
              title="Edit account"
            >
              <Pencil className="size-4" aria-hidden />
              <span className="sr-only">Edit account</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="px-2 text-[color:var(--color-error)]"
              onClick={() => onDelete(account)}
              disabled={account.isSystem}
              title={account.isSystem ? "System accounts cannot be deleted" : "Delete account"}
            >
              <Trash2 className="size-4" aria-hidden />
              <span className="sr-only">Delete account</span>
            </Button>
          </div>
        ) : null}
      </div>
      {hasChildren && isExpanded ? (
        <ul className="mt-2 space-y-2">
          {children.map((child) => (
            <AccountNode
              key={child.id}
              account={child}
              depth={depth + 1}
              childrenMap={childrenMap}
              expanded={expanded}
              canManage={canManage}
              onToggle={onToggle}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function AccountsTree() {
  const session = useSessionStore();
  const headers = useMemo(() => buildAuthHeaders(session), [session]);
  const subject = useMemo(
    () => ({ role: session.role, permissions: session.permissions }),
    [session.role, session.permissions],
  );
  const canRead = can(subject, "account:read");
  const canManage = can(subject, "account:manage");

  const [accounts, setAccounts] = useState<ChartAccount[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);

  const loadAccounts = useCallback(async () => {
    if (!canRead) {
      setAccounts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/accounts", { headers });
      const json = (await res.json()) as AccountsResponse;
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      const nextAccounts = json.data?.accounts ?? [];
      setAccounts(nextAccounts);
      setExpanded(new Set(nextAccounts.filter((account) => !account.parentId).map((account) => account.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load accounts");
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [canRead, headers]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const childrenMap = useMemo(() => childrenByParent(accounts), [accounts]);

  function toggle(accountId: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
  }

  async function saveAccount(input: AccountWriteInput) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const editingId = modal?.account?.id;
      const res = await fetch(editingId ? `/api/accounts/${editingId}` : "/api/accounts", {
        method: editingId ? "PUT" : "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = (await res.json()) as AccountsResponse;
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setModal(null);
      setMessage(editingId ? "Account updated." : "Account created.");
      await loadAccounts();
    } finally {
      setSaving(false);
    }
  }

  async function deleteSelected(account: ChartAccount) {
    if (!globalThis.confirm(`Delete account ${account.code} - ${account.name}?`)) return;
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/accounts/${account.id}`, {
        method: "DELETE",
        headers,
      });
      const json = (await res.json()) as AccountsResponse;
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setMessage("Account deleted.");
      await loadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  if (!canRead) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-[color:var(--color-text-secondary)]">
            You need account read permission to view the chart of accounts.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[color:var(--color-text-primary)]">
            {accounts.length} accounts
          </p>
          <p className="text-xs text-[color:var(--color-text-muted)]">
            Organized by account type and tenant isolation.
          </p>
        </div>
        {canManage ? (
          <Button
            type="button"
            onClick={() => setModal({ account: null, parentAccount: null })}
          >
            <Plus className="size-4" aria-hidden />
            Add root account
          </Button>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-[var(--ds-radius-md)] border border-[color:var(--color-error)]/30 bg-[color:var(--color-error)]/10 px-3 py-2 text-sm text-[color:var(--color-error)]">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-[var(--ds-radius-md)] border border-[color:var(--color-success)]/30 bg-[color:var(--color-success)]/10 px-3 py-2 text-sm text-[color:var(--color-success)]">
          {message}
        </p>
      ) : null}

      {loading ? (
        <Card>
          <CardContent>
            <p className="text-sm text-[color:var(--color-text-secondary)]">Loading accounts...</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {ACCOUNT_GROUPS.map((group) => {
            const rootAccounts = (childrenMap.get("root") ?? []).filter(
              (account) => account.accountType === group.id,
            );
            return (
              <Card key={group.id} className="min-w-0">
                <CardHeader className="flex flex-row items-center justify-between gap-3">
                  <div>
                    <CardTitle>{group.title}</CardTitle>
                    <p className="mt-1 text-xs text-[color:var(--color-text-muted)]" dir="rtl">
                      {group.titleAr}
                    </p>
                  </div>
                  <Badge tone={TYPE_TONE[group.id]}>{group.id}</Badge>
                </CardHeader>
                <CardContent>
                  {rootAccounts.length === 0 ? (
                    <p className="text-sm text-[color:var(--color-text-secondary)]">
                      No root accounts in this type yet.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {rootAccounts.map((account) => (
                        <AccountNode
                          key={account.id}
                          account={account}
                          depth={0}
                          childrenMap={childrenMap}
                          expanded={expanded}
                          canManage={canManage}
                          onToggle={toggle}
                          onAddChild={(parentAccount) =>
                            setModal({ account: null, parentAccount })
                          }
                          onEdit={(selected) =>
                            setModal({ account: selected, parentAccount: null })
                          }
                          onDelete={(selected) => void deleteSelected(selected)}
                        />
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AccountFormModal
        open={Boolean(modal)}
        account={modal?.account ?? null}
        parentAccount={modal?.parentAccount ?? null}
        accounts={accounts}
        saving={saving}
        onClose={() => setModal(null)}
        onSubmit={saveAccount}
      />
    </div>
  );
}
