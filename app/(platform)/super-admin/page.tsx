"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { TableWrap, Td, Th, Tr } from "@/components/ui/table";

type CompanyOverview = {
  tenant: {
    id: string;
    name: string;
    slug: string;
    status?: "active" | "suspended";
    staffApiKeyConfigured: boolean;
    createdAt: string;
  };
  package: { id: string; name: string } | null;
  integrations: {
    woocommerce: { connected: boolean; healthy: boolean | null; storeUrl: string | null };
    bosta: { connected: boolean };
    storefrontOrders: { connected: boolean };
    outboundWebhooks: { connected: boolean; enabledCount: number; totalCount: number };
  };
  counts: {
    orders: number;
    users: number;
    tickets: number;
    shipments: number;
  };
};

const TOKEN_KEY = "platform_admin_token";

function authHeaders(token: string) {
  return { authorization: `Bearer ${token}` };
}

function StatusBadge({ status }: { status?: "active" | "suspended" }) {
  const suspended = status === "suspended";
  return <Badge tone={suspended ? "danger" : "success"}>{suspended ? "Suspended" : "Active"}</Badge>;
}

function HealthBadge({ healthy }: { healthy: boolean | null }) {
  if (healthy === null) return <Badge tone="default">No webhook logs</Badge>;
  return <Badge tone={healthy ? "success" : "danger"}>{healthy ? "Webhook OK" : "Webhook failing"}</Badge>;
}

export default function SuperAdminPage() {
  const [token, setToken] = useState("");
  const [companies, setCompanies] = useState<CompanyOverview[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [packageFilter, setPackageFilter] = useState("all");
  const [integrationFilter, setIntegrationFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    setToken(window.localStorage.getItem(TOKEN_KEY) ?? "");
  }, []);

  const load = useCallback(async () => {
    if (!token.trim()) return;
    setLoading(true);
    setErr(null);
    try {
      window.localStorage.setItem(TOKEN_KEY, token.trim());
      const res = await fetch("/api/platform/companies", {
        headers: authHeaders(token.trim()),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setCompanies(json.data.companies as CompanyOverview[]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load companies");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  const packageOptions = useMemo(
    () => Array.from(new Set(companies.map((c) => c.package?.name ?? "No package"))),
    [companies],
  );

  const filtered = companies.filter((company) => {
    const packageName = company.package?.name ?? "No package";
    if (packageFilter !== "all" && packageName !== packageFilter) return false;
    if (statusFilter !== "all" && (company.tenant.status ?? "active") !== statusFilter) return false;
    if (integrationFilter === "woocommerce" && !company.integrations.woocommerce.connected) return false;
    if (integrationFilter === "webhook-failing" && company.integrations.woocommerce.healthy !== false) return false;
    if (integrationFilter === "bosta" && !company.integrations.bosta.connected) return false;
    return true;
  });

  const totals = companies.reduce(
    (acc, company) => {
      acc.orders += company.counts.orders;
      acc.users += company.counts.users;
      if (company.integrations.woocommerce.connected) acc.woo += 1;
      if (company.tenant.status === "suspended") acc.suspended += 1;
      return acc;
    },
    { orders: 0, users: 0, woo: 0, suspended: 0 },
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Platform access</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Input
            label="PLATFORM_ADMIN_SECRET"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Use dev-super-admin in mock mode"
            type="password"
          />
          <Button onClick={load} loading={loading}>
            Load companies
          </Button>
        </CardContent>
      </Card>

      {err ? (
        <p className="rounded-[var(--ds-radius-md)] border border-[color:var(--color-error)]/25 bg-[color:var(--color-error)]/10 p-3 text-sm text-[color:var(--color-error)] shadow-none">
          {err}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-[color:var(--color-text-secondary)]">Companies</p>
            <p className="text-2xl font-semibold">{companies.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-[color:var(--color-text-secondary)]">Orders</p>
            <p className="text-2xl font-semibold">{totals.orders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-[color:var(--color-text-secondary)]">Users</p>
            <p className="text-2xl font-semibold">{totals.users}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-[color:var(--color-text-secondary)]">Suspended</p>
            <p className="text-2xl font-semibold">{totals.suspended}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Companies</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Select label="Package" value={packageFilter} onChange={(e) => setPackageFilter(e.target.value)}>
              <option value="all">All packages</option>
              {packageOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
            <Select label="Integration" value={integrationFilter} onChange={(e) => setIntegrationFilter(e.target.value)}>
              <option value="all">All integrations</option>
              <option value="woocommerce">WooCommerce connected</option>
              <option value="webhook-failing">Woo webhook failing</option>
              <option value="bosta">Bosta connected</option>
            </Select>
            <Select label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </Select>
          </div>

          <TableWrap>
            <thead>
              <tr>
                <Th>Company</Th>
                <Th>Status</Th>
                <Th>Package</Th>
                <Th>Integrations</Th>
                <Th>Counts</Th>
                <Th>Details</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Tr key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <Td key={j}>
                        <Skeleton className="h-4 w-full" />
                      </Td>
                    ))}
                  </Tr>
                ))
              ) : filtered.length === 0 ? (
                <Tr>
                  <Td colSpan={6} className="text-center text-[color:var(--color-text-secondary)]">
                    No companies match the current filters.
                  </Td>
                </Tr>
              ) : (
                filtered.map((company) => (
                  <Tr key={company.tenant.id}>
                    <Td>
                      <div className="font-medium">{company.tenant.name}</div>
                      <div className="font-mono text-xs text-[color:var(--color-text-secondary)]">
                        {company.tenant.slug}
                      </div>
                    </Td>
                    <Td>
                      <StatusBadge status={company.tenant.status} />
                    </Td>
                    <Td>{company.package?.name ?? "No package"}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        <Badge tone={company.integrations.woocommerce.connected ? "info" : "default"}>Woo</Badge>
                        <HealthBadge healthy={company.integrations.woocommerce.healthy} />
                        <Badge tone={company.integrations.bosta.connected ? "info" : "default"}>Bosta</Badge>
                      </div>
                    </Td>
                    <Td className="text-xs">
                      {company.counts.orders} orders / {company.counts.users} users / {company.counts.tickets} tickets
                    </Td>
                    <Td>
                      <Link
                        href={`/super-admin/${company.tenant.id}`}
                        className="text-sm font-medium text-[color:var(--color-primary)] hover:underline"
                      >
                        Details
                      </Link>
                    </Td>
                  </Tr>
                ))
              )}
            </tbody>
          </TableWrap>
        </CardContent>
      </Card>
    </div>
  );
}
