"use client";

import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { TableWrap, Th, Tr, Td } from "@/components/ui/table";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { ResponsiveCard } from "@/components/responsive/ResponsiveCard";
import { useSessionStore, buildAuthHeaders } from "@/store/zustand/session-store";
import { useUiStore } from "@/store/zustand/ui-store";
import type { User, UserRole } from "@/lib/types/models";
import { Badge } from "@/components/ui/badge";

const ROLES: UserRole[] = [
  "admin",
  "moderator",
  "confirmation",
  "invoicing",
  "warehouse",
  "support",
];

export default function UsersPage() {
  const apiSecret = useSessionStore((s) => s.apiSecret);
  const tenantId = useSessionStore((s) => s.tenantId);
  const userId = useSessionStore((s) => s.userId);
  const role = useSessionStore((s) => s.role);
  const openDrawer = useUiStore((s) => s.openDrawer);

  const [users, setUsers] = useState<User[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("support");
  const [newTarget, setNewTarget] = useState(0);

  async function load() {
    setErr(null);
    const res = await fetch("/api/users", {
      headers: buildAuthHeaders({ apiSecret, tenantId, userId, role }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? res.statusText);
    setUsers(json.data as User[]);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (e) {
        if (!cancelled)
          setErr(e instanceof Error ? e.message : "Error");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiSecret, tenantId, userId, role]);

  async function createUser() {
    setErr(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: buildAuthHeaders({ apiSecret, tenantId, userId, role }),
        body: JSON.stringify({
          name: newName,
          email: newEmail || undefined,
          role: newRole,
          daily_target: newTarget,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setCreateOpen(false);
      setNewName("");
      setNewEmail("");
      setNewTarget(0);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    }
  }

  function openEditDrawer(u: User) {
    openDrawer(`تعديل: ${u.name}`, () => (
      <EditUserForm
        user={u}
        onSave={async (patch) => {
          const res = await fetch("/api/users", {
            method: "PATCH",
            headers: buildAuthHeaders({ apiSecret, tenantId, userId, role }),
            body: JSON.stringify({
              targetUserId: u.id,
              ...patch,
            }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? res.statusText);
          await load();
          useUiStore.getState().closeDrawer();
        }}
      />
    ));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="المستخدمون"
        description="إدارة الفريق، الأدوار، والأهداف اليومية."
        actions={
          <Button
            type="button"
            size="sm"
            onClick={() => setCreateOpen(true)}
          >
            <UserPlus className="size-4" aria-hidden />
            مستخدم جديد
          </Button>
        }
      />

      {err ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {err}
        </p>
      ) : null}

      <Modal
        open={createOpen}
        title="مستخدم جديد"
        onClose={() => setCreateOpen(false)}
      >
        <div className="grid gap-3">
          <div className="space-y-1">
            <label className="text-xs text-[color:var(--color-text-secondary)]">الاسم</label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-[color:var(--color-text-secondary)]">البريد (اختياري)</label>
            <Input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-[color:var(--color-text-secondary)]">الدور</label>
            <Select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as UserRole)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-[color:var(--color-text-secondary)]">الهدف اليومي</label>
            <Input
              type="number"
              min={0}
              value={newTarget}
              onChange={(e) => setNewTarget(Number(e.target.value))}
            />
          </div>
          <Button
            type="button"
            onClick={createUser}
            disabled={!newName.trim()}
          >
            إنشاء
          </Button>
        </div>
      </Modal>

      <ResponsiveTable
        desktop={
          <TableWrap>
            <thead>
              <tr>
                <Th>الاسم</Th>
                <Th>الدور</Th>
                <Th>الهدف</Th>
                <Th>البريد</Th>
                <Th>إجراءات</Th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <Tr>
                  <Td colSpan={5} className="text-center text-[color:var(--color-text-muted)]">
                    لا مستخدمين
                  </Td>
                </Tr>
              ) : (
                users.map((u) => (
                  <Tr key={u.id}>
                    <Td className="font-medium">{u.name}</Td>
                    <Td>
                      <Badge>{u.role}</Badge>
                    </Td>
                    <Td>{u.daily_target}</Td>
                    <Td className="text-[color:var(--color-text-secondary)]">{u.email ?? "—"}</Td>
                    <Td>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => openEditDrawer(u)}
                      >
                        تعديل
                      </Button>
                    </Td>
                  </Tr>
                ))
              )}
            </tbody>
          </TableWrap>
        }
        mobile={
          <div className="space-y-3">
            {users.length === 0 ? (
              <p className="text-center text-sm text-[color:var(--color-text-muted)]">
                لا مستخدمين
              </p>
            ) : (
              users.map((u) => (
                <ResponsiveCard key={u.id}>
                  <div className="space-y-3 text-sm">
                    <div className="text-base font-semibold text-[color:var(--color-text-primary)]">
                      {u.name}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{u.role}</Badge>
                      <span className="text-[color:var(--color-text-muted)]">
                        هدف: {u.daily_target}
                      </span>
                    </div>
                    <div className="text-[color:var(--color-text-secondary)]">
                      {u.email ?? "—"}
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      onClick={() => openEditDrawer(u)}
                    >
                      تعديل
                    </Button>
                  </div>
                </ResponsiveCard>
              ))
            )}
          </div>
        }
      />
    </div>
  );
}

function EditUserForm({
  user,
  onSave,
}: {
  user: User;
  onSave: (p: {
    name?: string;
    role?: UserRole;
    daily_target?: number;
  }) => Promise<void>;
}) {
  const [name, setName] = useState(user.name);
  const [r, setR] = useState(user.role);
  const [target, setTarget] = useState(user.daily_target);
  const [loading, setLoading] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setLocalErr(null);
        setLoading(true);
        try {
          await onSave({
            name: name !== user.name ? name : undefined,
            role: r !== user.role ? r : undefined,
            daily_target:
              target !== user.daily_target ? target : undefined,
          });
        } catch (er) {
          setLocalErr(er instanceof Error ? er.message : "فشل الحفظ");
        } finally {
          setLoading(false);
        }
      }}
    >
      {localErr ? (
        <p className="text-sm text-[color:var(--color-error)]">{localErr}</p>
      ) : null}
      <div className="space-y-1">
        <label className="text-xs text-[color:var(--color-text-secondary)]">الاسم</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-[color:var(--color-text-secondary)]">الدور</label>
        <Select value={r} onChange={(e) => setR(e.target.value as UserRole)}>
          {ROLES.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-[color:var(--color-text-secondary)]">الهدف اليومي</label>
        <Input
          type="number"
          min={0}
          value={target}
          onChange={(e) => setTarget(Number(e.target.value))}
        />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? "…" : "حفظ"}
      </Button>
    </form>
  );
}
