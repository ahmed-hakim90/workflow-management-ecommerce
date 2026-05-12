"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/input";

type Package = { id: string; name: string };

type Company = {
  tenant: {
    id: string;
    name: string;
    slug: string;
    status?: "active" | "suspended";
    suspendedReason?: string;
    staffApiKeyConfigured: boolean;
    createdAt: string;
    updatedAt: string;
  };
  package: Package | null;
  integrations: {
    woocommerce: {
      connected: boolean;
      healthy: boolean | null;
      restConfigured: boolean;
      storeUrl: string | null;
      lastLog?: {
        outcome: string;
        httpStatus: number;
        errorMessage?: string;
        createdAt: string;
      };
    };
    bosta: { connected: boolean; baseUrl: string | null };
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

function headers() {
  return { authorization: `Bearer ${window.localStorage.getItem(TOKEN_KEY) ?? ""}` };
}

function IntegrationCard({
  title,
  connected,
  detail,
}: {
  title: string;
  connected: boolean;
  detail?: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">{title}</h3>
          <Badge tone={connected ? "success" : "default"}>
            {connected ? "Connected" : "Not connected"}
          </Badge>
        </div>
        {detail ? (
          <p className="text-sm text-[color:var(--color-text-secondary)]">{detail}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function CompanyDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = use(params);
  const [company, setCompany] = useState<Company | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [packageId, setPackageId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [companyRes, packagesRes] = await Promise.all([
        fetch(`/api/platform/companies/${tenantId}`, { headers: headers() }),
        fetch("/api/platform/packages", { headers: headers() }),
      ]);
      const companyJson = await companyRes.json();
      const packagesJson = await packagesRes.json();
      if (!companyRes.ok) throw new Error(companyJson.error ?? companyRes.statusText);
      if (!packagesRes.ok) throw new Error(packagesJson.error ?? packagesRes.statusText);
      const nextCompany = companyJson.data.company as Company;
      setCompany(nextCompany);
      setPackageId(nextCompany.package?.id ?? "");
      setPackages(packagesJson.data.packages as Package[]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load company");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/platform/companies/${tenantId}`, {
        method: "PATCH",
        headers: { ...headers(), "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      const nextCompany = json.data.company as Company;
      setCompany(nextCompany);
      setPackageId(nextCompany.package?.id ?? "");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not update company");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !company) {
    return <p className="text-sm text-[color:var(--color-text-secondary)]">Loading company...</p>;
  }

  return (
    <div className="space-y-6">
      <Link href="/super-admin" className="text-sm text-[color:var(--color-primary)] hover:underline">
        Back to companies
      </Link>

      {err ? (
        <p className="rounded-[var(--ds-radius-md)] border border-[color:var(--color-error)]/25 bg-[color:var(--color-error)]/10 p-3 text-sm text-[color:var(--color-error)] shadow-none">
          {err}
        </p>
      ) : null}

      {company ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                {company.tenant.name}
                <Badge tone={company.tenant.status === "suspended" ? "danger" : "success"}>
                  {company.tenant.status === "suspended" ? "Suspended" : "Active"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-4">
              <div>
                <p className="text-xs text-[color:var(--color-text-secondary)]">Slug</p>
                <p className="font-mono text-sm">{company.tenant.slug}</p>
              </div>
              <div>
                <p className="text-xs text-[color:var(--color-text-secondary)]">Package</p>
                <p className="text-sm">{company.package?.name ?? "No package"}</p>
              </div>
              <div>
                <p className="text-xs text-[color:var(--color-text-secondary)]">API key</p>
                <p className="text-sm">{company.tenant.staffApiKeyConfigured ? "Configured" : "Missing"}</p>
              </div>
              <div>
                <p className="text-xs text-[color:var(--color-text-secondary)]">Counts</p>
                <p className="text-sm">
                  {company.counts.orders} orders / {company.counts.users} users / {company.counts.shipments} shipments
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-4">
            <IntegrationCard
              title="WooCommerce"
              connected={company.integrations.woocommerce.connected}
              detail={
                company.integrations.woocommerce.lastLog
                  ? `${company.integrations.woocommerce.lastLog.outcome} (${company.integrations.woocommerce.lastLog.httpStatus})`
                  : company.integrations.woocommerce.storeUrl ?? undefined
              }
            />
            <IntegrationCard
              title="Bosta"
              connected={company.integrations.bosta.connected}
              detail={company.integrations.bosta.baseUrl ?? undefined}
            />
            <IntegrationCard
              title="Storefront orders"
              connected={company.integrations.storefrontOrders.connected}
            />
            <IntegrationCard
              title="Outbound webhooks"
              connected={company.integrations.outboundWebhooks.connected}
              detail={`${company.integrations.outboundWebhooks.enabledCount}/${company.integrations.outboundWebhooks.totalCount} enabled`}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Manage activity and package</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <Select
                label="Assigned package"
                value={packageId}
                onChange={(e) => setPackageId(e.target.value)}
              >
                <option value="">No package</option>
                {packages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.name}
                  </option>
                ))}
              </Select>
              <div className="flex items-end gap-2">
                <Button
                  variant="secondary"
                  loading={saving}
                  onClick={() => patch({ packageId: packageId || null })}
                >
                  Save package
                </Button>
                <Button
                  variant={company.tenant.status === "suspended" ? "primary" : "danger"}
                  loading={saving}
                  onClick={() =>
                    patch({
                      status:
                        company.tenant.status === "suspended" ? "active" : "suspended",
                      suspendedReason: "Managed by platform super admin",
                    })
                  }
                >
                  {company.tenant.status === "suspended" ? "Reactivate" : "Suspend"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
