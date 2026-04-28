"use client";

import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { TableWrap, Th, Tr, Td } from "@/components/ui/table";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { ResponsiveCard } from "@/components/responsive/ResponsiveCard";
import { CardSkeleton, Skeleton } from "@/components/ui/skeleton";
import { useSessionStore, buildAuthHeaders } from "@/store/zustand/session-store";
import { useUiStore } from "@/store/zustand/ui-store";
import type { User, UserRole } from "@/lib/types/models";
import { Badge } from "@/components/ui/badge";
import {
  ALL_PERMISSIONS,
  effectivePermissions,
  roleDefaultPermissions,
  type Permission,
} from "@/lib/auth/rbac";

export type UsersManagementProps = {
  /** When set, the create dialog is controlled by the parent (e.g. header action). */
  createControl?: { open: boolean; setOpen: (open: boolean) => void };
};

const ROLES: UserRole[] = [
  "admin",
  "moderator",
  "confirmation",
  "invoicing",
  "warehouse",
  "support",
];

const PERMISSION_GROUPS: { title: string; permissions: Permission[] }[] = [
  {
    title: "Pages",
    permissions: [
      "page:analytics",
      "page:orders",
      "page:shipments",
      "page:tickets",
      "page:warehouse",
      "page:admin",
      "page:users",
      "page:settings",
    ],
  },
  {
    title: "Orders",
    permissions: [
      "order:read",
      "order:confirm",
      "order:invoice",
      "order:cancel",
      "order:assign",
      "order:revert",
      "order:delete",
    ],
  },
  {
    title: "Shipments",
    permissions: ["shipment:create", "shipment:scan", "shipment:read"],
  },
  {
    title: "Tickets",
    permissions: [
      "ticket:create",
      "ticket:read",
      "ticket:assign",
      "ticket:resolve",
    ],
  },
  {
    title: "Users / Finance",
    permissions: ["user:read", "user:manage", "finance:view"],
  },
];

function permissionLabel(permission: Permission) {
  return permission
    .replace("page:", "Page: ")
    .replace("order:", "Order: ")
    .replace("shipment:", "Shipment: ")
    .replace("ticket:", "Ticket: ")
    .replace("user:", "User: ")
    .replace("finance:", "Finance: ")
    .replaceAll("_", " ");
}

function buildPermissionOverrides(
  role: UserRole,
  selectedPermissions: Permission[],
) {
  const defaults = new Set(roleDefaultPermissions(role));
  const selected = new Set(selectedPermissions);
  return ALL_PERMISSIONS.flatMap((permission) => {
    const defaultOn = defaults.has(permission);
    const selectedOn = selected.has(permission);
    if (selectedOn && !defaultOn) return [permission];
    if (!selectedOn && defaultOn) return [`-${permission}`];
    return [];
  });
}

function PermissionEditor({
  role,
  selected,
  onChange,
}: {
  role: UserRole;
  selected: Permission[];
  onChange: (next: Permission[]) => void;
}) {
  const selectedSet = new Set(selected);
  return (
    <div className="space-y-3 rounded-xl bg-[color:var(--color-bg-subtle)] p-3 shadow-[var(--shadow-neo-inset)]">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]">
          Permissions
        </p>
        <p className="text-xs text-[color:var(--color-text-secondary)]">
          Uncheck role defaults to hide pages/actions. Financial data is off
          unless Finance: view is checked.
        </p>
      </div>
      {PERMISSION_GROUPS.map((group) => (
        <div key={group.title} className="space-y-2">
          <p className="text-xs font-semibold text-[color:var(--color-text-primary)]">
            {group.title}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {group.permissions.map((permission) => {
              const checked = selectedSet.has(permission);
              const defaultOn = roleDefaultPermissions(role).includes(permission);
              return (
                <label
                  key={permission}
                  className="flex items-center gap-2 rounded-lg bg-[color:var(--color-card)] px-2 py-1.5 text-xs shadow-[var(--shadow-neo-raised-sm)]"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const next = new Set(selectedSet);
                      if (e.target.checked) next.add(permission);
                      else next.delete(permission);
                      onChange([...next]);
                    }}
                  />
                  <span className="flex-1">{permissionLabel(permission)}</span>
                  {defaultOn ? (
                    <span className="text-[10px] text-[color:var(--color-text-muted)]">
                      role
                    </span>
                  ) : null}
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function UsersManagement({ createControl }: UsersManagementProps = {}) {
  const apiSecret = useSessionStore((s) => s.apiSecret);
  const idToken = useSessionStore((s) => s.idToken);
  const tenantId = useSessionStore((s) => s.tenantId);
  const userId = useSessionStore((s) => s.userId);
  const role = useSessionStore((s) => s.role);
  const authReady = useSessionStore((s) => s.authReady);
  const openDrawer = useUiStore((s) => s.openDrawer);

  const [users, setUsers] = useState<User[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [usersLoading, setUsersLoading] = useState(true);
  const [createOpenInternal, setCreateOpenInternal] = useState(false);
  const createOpen = createControl ? createControl.open : createOpenInternal;
  const setCreateOpen = createControl
    ? createControl.setOpen
    : setCreateOpenInternal;
  const showCreateToolbar = !createControl;
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("support");
  const [newPermissions, setNewPermissions] = useState<Permission[]>(
    roleDefaultPermissions("support"),
  );
  const [newTarget, setNewTarget] = useState(0);

  async function load() {
    const res = await fetch("/api/users", {
      headers: buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? res.statusText);
    setUsers(json.data as User[]);
  }

  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    (async () => {
      setUsersLoading(true);
      setErr(null);
      try {
        await load();
      } catch (e) {
        if (!cancelled)
          setErr(e instanceof Error ? e.message : "Error");
      } finally {
        if (!cancelled) setUsersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, apiSecret, idToken, tenantId, userId, role]);

  async function createUser() {
    setErr(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
        body: JSON.stringify({
          name: newName,
          email: newEmail || undefined,
          role: newRole,
          permissions: buildPermissionOverrides(newRole, newPermissions),
          daily_target: newTarget,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setCreateOpen(false);
      setNewName("");
      setNewEmail("");
      setNewPermissions(roleDefaultPermissions(newRole));
      setNewTarget(0);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    }
  }

  function openEditDrawer(u: User) {
    openDrawer(`Edit: ${u.name}`, () => (
      <EditUserForm
        user={u}
        onSave={async (patch) => {
          const res = await fetch("/api/users", {
            method: "PATCH",
            headers: buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
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
    <div className="space-y-4">
      {showCreateToolbar ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <UserPlus className="size-4" aria-hidden />
            New user
          </Button>
        </div>
      ) : null}

      {!usersLoading && err ? (
        <p className="rounded-xl border-0 bg-[color:var(--color-error)]/12 p-3 text-sm text-[color:var(--color-error)] shadow-[var(--shadow-neo-raised-sm)]">
          {err}
        </p>
      ) : null}

      <Modal
        open={createOpen}
        title="New user"
        onClose={() => setCreateOpen(false)}
      >
        <div className="grid gap-3">
          <div className="space-y-1">
            <label className="text-xs text-[color:var(--color-text-secondary)]">Name</label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-[color:var(--color-text-secondary)]">Email (optional)</label>
            <Input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-[color:var(--color-text-secondary)]">Role</label>
            <Select
              value={newRole}
              onChange={(e) => {
                const nextRole = e.target.value as UserRole;
                setNewRole(nextRole);
                setNewPermissions(roleDefaultPermissions(nextRole));
              }}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-[color:var(--color-text-secondary)]">Daily goal</label>
            <Input
              type="number"
              min={0}
              value={newTarget}
              onChange={(e) => setNewTarget(Number(e.target.value))}
            />
          </div>
          <PermissionEditor
            role={newRole}
            selected={newPermissions}
            onChange={setNewPermissions}
          />
          <Button
            type="button"
            onClick={createUser}
            disabled={!newName.trim()}
          >
            Create
          </Button>
        </div>
      </Modal>

      <ResponsiveTable
        desktop={
          <TableWrap className="border-0 shadow-[var(--shadow-neo-raised)] md:rounded-2xl">
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Role</Th>
                <Th>Goal</Th>
                <Th>Email</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {usersLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <Tr key={i}>
                    {Array.from({ length: 5 }).map((__, j) => (
                      <Td key={j}>
                        <Skeleton className="h-4 w-full max-w-[8rem]" />
                      </Td>
                    ))}
                  </Tr>
                ))
              ) : users.length === 0 ? (
                <Tr>
                  <Td colSpan={5} className="text-center text-[color:var(--color-text-muted)]">
                    No users
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
                        Edit
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
            {usersLoading ? (
              <>
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
              </>
            ) : users.length === 0 ? (
              <p className="text-center text-sm text-[color:var(--color-text-muted)]">
                No users
              </p>
            ) : (
              users.map((u) => (
                <ResponsiveCard
                  key={u.id}
                  className="rounded-2xl border-0 shadow-[var(--shadow-neo-raised)]"
                >
                  <div className="space-y-3 text-sm">
                    <div className="text-base font-semibold text-[color:var(--color-text-primary)]">
                      {u.name}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{u.role}</Badge>
                      <span className="text-[color:var(--color-text-muted)]">
                        Goal: {u.daily_target}
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
                      Edit
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
    permissions?: string[];
  }) => Promise<void>;
}) {
  const [name, setName] = useState(user.name);
  const [r, setR] = useState(user.role);
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>(
    effectivePermissions({ role: user.role, permissions: user.permissions }),
  );
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
            permissions: buildPermissionOverrides(r, selectedPermissions),
            daily_target:
              target !== user.daily_target ? target : undefined,
          });
        } catch (er) {
          setLocalErr(er instanceof Error ? er.message : "Save failed");
        } finally {
          setLoading(false);
        }
      }}
    >
      {localErr ? (
        <p className="text-sm text-[color:var(--color-error)]">{localErr}</p>
      ) : null}
      <div className="space-y-1">
        <label className="text-xs text-[color:var(--color-text-secondary)]">Name</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-[color:var(--color-text-secondary)]">Role</label>
        <Select
          value={r}
          onChange={(e) => {
            const nextRole = e.target.value as UserRole;
            setR(nextRole);
            setSelectedPermissions(roleDefaultPermissions(nextRole));
          }}
        >
          {ROLES.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-[color:var(--color-text-secondary)]">Daily goal</label>
        <Input
          type="number"
          min={0}
          value={target}
          onChange={(e) => setTarget(Number(e.target.value))}
        />
      </div>
      <PermissionEditor
        role={r}
        selected={selectedPermissions}
        onChange={setSelectedPermissions}
      />
      <Button type="submit" disabled={loading}>
        {loading ? "…" : "Save"}
      </Button>
    </form>
  );
}
