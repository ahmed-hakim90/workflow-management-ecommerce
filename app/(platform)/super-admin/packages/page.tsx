"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { TableWrap, Td, Th, Tr } from "@/components/ui/table";

type Package = {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  limits: {
    maxUsers?: number;
    maxOrdersPerMonth?: number;
    maxWebhookEventsPerMonth?: number;
  };
  features: {
    woocommerce: boolean;
    bosta: boolean;
    storefrontOrders: boolean;
    outboundWebhooks: boolean;
  };
  supportTier: "standard" | "priority" | "dedicated";
};

const TOKEN_KEY = "platform_admin_token";

function headers() {
  return {
    authorization: `Bearer ${window.localStorage.getItem(TOKEN_KEY) ?? ""}`,
    "content-type": "application/json",
  };
}

export default function PackagesPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [name, setName] = useState("");
  const [maxUsers, setMaxUsers] = useState("10");
  const [maxOrders, setMaxOrders] = useState("500");
  const [supportTier, setSupportTier] = useState<Package["supportTier"]>("standard");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/platform/packages", { headers: headers() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setPackages(json.data.packages as Package[]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load packages");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createPackage() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/platform/packages", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          name,
          limits: {
            maxUsers: Number(maxUsers),
            maxOrdersPerMonth: Number(maxOrders),
          },
          features: {
            woocommerce: true,
            bosta: true,
            storefrontOrders: true,
            outboundWebhooks: false,
          },
          supportTier,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setName("");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not create package");
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(pkg: Package) {
    setErr(null);
    try {
      const res = await fetch(`/api/platform/packages/${pkg.id}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ active: !pkg.active }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not update package");
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create package</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5 md:items-end">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            label="Max users"
            type="number"
            min={0}
            value={maxUsers}
            onChange={(e) => setMaxUsers(e.target.value)}
          />
          <Input
            label="Orders/month"
            type="number"
            min={0}
            value={maxOrders}
            onChange={(e) => setMaxOrders(e.target.value)}
          />
          <Select
            label="Support"
            value={supportTier}
            onChange={(e) => setSupportTier(e.target.value as Package["supportTier"])}
          >
            <option value="standard">Standard</option>
            <option value="priority">Priority</option>
            <option value="dedicated">Dedicated</option>
          </Select>
          <Button onClick={createPackage} loading={loading}>
            Create
          </Button>
        </CardContent>
      </Card>

      {err ? (
        <p className="rounded-xl bg-[color:var(--color-error)]/10 p-3 text-sm text-[color:var(--color-error)]">
          {err}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Packages</CardTitle>
        </CardHeader>
        <CardContent>
          <TableWrap>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Status</Th>
                <Th>Limits</Th>
                <Th>Features</Th>
                <Th>Support</Th>
                <Th>Action</Th>
              </tr>
            </thead>
            <tbody>
              {packages.length === 0 ? (
                <Tr>
                  <Td colSpan={6} className="text-center text-[color:var(--color-text-secondary)]">
                    No packages yet.
                  </Td>
                </Tr>
              ) : (
                packages.map((pkg) => (
                  <Tr key={pkg.id}>
                    <Td>
                      <div className="font-medium">{pkg.name}</div>
                      <div className="font-mono text-xs text-[color:var(--color-text-secondary)]">
                        {pkg.id}
                      </div>
                    </Td>
                    <Td>
                      <Badge tone={pkg.active ? "success" : "default"}>
                        {pkg.active ? "Active" : "Archived"}
                      </Badge>
                    </Td>
                    <Td className="text-xs">
                      {pkg.limits.maxUsers ?? "Unlimited"} users /{" "}
                      {pkg.limits.maxOrdersPerMonth ?? "Unlimited"} orders
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(pkg.features).map(([key, enabled]) => (
                          <Badge key={key} tone={enabled ? "info" : "default"}>
                            {key}
                          </Badge>
                        ))}
                      </div>
                    </Td>
                    <Td>{pkg.supportTier}</Td>
                    <Td>
                      <Button variant="secondary" size="sm" onClick={() => toggleActive(pkg)}>
                        {pkg.active ? "Archive" : "Activate"}
                      </Button>
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
