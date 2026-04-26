"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StageBarChart } from "@/components/charts/stage-bar-chart";
import { TeamLineChart } from "@/components/charts/team-line-chart";
import { ResponsiveTable } from "@/components/responsive/ResponsiveTable";
import { ResponsiveCard } from "@/components/responsive/ResponsiveCard";
import { TableWrap, Th, Tr, Td } from "@/components/ui/table";
import { useSessionStore, buildAuthHeaders } from "@/store/zustand/session-store";
import { humanizeOrderStageKey } from "@/lib/ui/order-stage-label";
import { CardSkeleton, Skeleton } from "@/components/ui/skeleton";

type AdminSummary = {
  stages: Record<string, number>;
  stageValues: Record<string, number>;
  team: {
    name: string;
    role: string;
    target: number;
    done: number;
    performancePct: number;
  }[];
  bottleneck?: string;
};

export default function AdminPage() {
  const apiSecret = useSessionStore((s) => s.apiSecret);
  const idToken = useSessionStore((s) => s.idToken);
  const tenantId = useSessionStore((s) => s.tenantId);
  const userId = useSessionStore((s) => s.userId);
  const role = useSessionStore((s) => s.role);
  const authReady = useSessionStore((s) => s.authReady);

  const [data, setData] = useState<AdminSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    (async () => {
      setErr(null);
      setLoading(true);
      try {
        const res = await fetch("/api/admin/summary", {
          headers: buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? res.statusText);
        if (!cancelled) setData(json.data as AdminSummary);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authReady, apiSecret, idToken, tenantId, userId, role]);

  const fmtStageMoney = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  const barData =
    data?.stages &&
    data?.stageValues &&
    Object.entries(data.stages)
      .filter(([k]) => k !== "warehouse")
      .map(([name, count]) => ({
        name: humanizeOrderStageKey(name),
        count: Number(count) || 0,
        value: Number(data.stageValues[name] ?? 0) || 0,
      }));

  const lineData =
    data?.team.map((t) => ({
      name: t.name.slice(0, 14),
      performance: t.performancePct,
    })) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin"
        description="Stage pipeline, team throughput, and bottlenecks. Requires an admin or moderator role."
      />

      {!loading && err ? (
        <p className="rounded-xl border-0 bg-[color:var(--color-error)]/12 p-3 text-sm text-[color:var(--color-error)] shadow-[var(--shadow-neo-raised-sm)]">
          {err}
        </p>
      ) : null}

      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 lg:col-span-6">
          <CardHeader>
            <CardTitle>Orders and value by stage</CardTitle>
          </CardHeader>
          <CardContent>
            {loading && !err ? (
              <Skeleton className="h-72 w-full" />
            ) : barData && barData.length > 0 ? (
              <StageBarChart
                data={barData}
                formatValue={fmtStageMoney}
                valueLabel="Pipeline value"
                countLabel="Order count"
              />
            ) : (
              <p className="text-sm text-[color:var(--color-text-muted)]">No data</p>
            )}
          </CardContent>
        </Card>
        <Card className="col-span-12 lg:col-span-6">
          <CardHeader>
            <CardTitle>Team performance</CardTitle>
          </CardHeader>
          <CardContent>
            {loading && !err ? (
              <Skeleton className="h-72 w-full" />
            ) : lineData.length > 0 ? (
              <TeamLineChart data={lineData} />
            ) : (
              <p className="text-sm text-[color:var(--color-text-muted)]">No data</p>
            )}
          </CardContent>
        </Card>
        {data?.bottleneck ? (
          <div className="col-span-12 rounded-2xl border border-[color:var(--color-callout-warning-border)] bg-[color:var(--color-callout-warning-bg)] p-4 text-sm text-[color:var(--color-callout-warning-text)] shadow-[var(--shadow-neo-raised)]">
            <span className="text-[color:var(--color-text-primary)]/80">
              Potential bottleneck:
            </span>{" "}
            <span className="font-medium text-[color:var(--color-callout-warning-text)]">
              {humanizeOrderStageKey(data.bottleneck)}
            </span>
          </div>
        ) : null}
        <Card className="col-span-12">
          <CardHeader>
            <CardTitle>Team</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ResponsiveTable
              desktop={
                <TableWrap className="rounded-none border-0 shadow-none">
                  <thead>
                    <tr>
                      <Th>Name</Th>
                      <Th>Role</Th>
                      <Th>Target</Th>
                      <Th>Done</Th>
                      <Th>Performance</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && !err ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <Tr key={i}>
                          {Array.from({ length: 5 }).map((__, j) => (
                            <Td key={j}>
                              <Skeleton className="h-4 w-full max-w-[8rem]" />
                            </Td>
                          ))}
                        </Tr>
                      ))
                    ) : (data?.team ?? []).length === 0 ? (
                      <Tr>
                        <Td
                          colSpan={5}
                          className="text-center text-[color:var(--color-text-muted)]"
                        >
                          No team members
                        </Td>
                      </Tr>
                    ) : (
                      (data?.team ?? []).map((t) => (
                        <Tr key={t.name + t.role}>
                          <Td>{t.name}</Td>
                          <Td>{t.role}</Td>
                          <Td>{t.target}</Td>
                          <Td>{t.done}</Td>
                          <Td>{t.performancePct}%</Td>
                        </Tr>
                      ))
                    )}
                  </tbody>
                </TableWrap>
              }
              mobile={
                <div className="space-y-3 p-4">
                  {loading && !err ? (
                    <>
                      <CardSkeleton />
                      <CardSkeleton />
                      <CardSkeleton />
                    </>
                  ) : (data?.team ?? []).length === 0 ? (
                    <p className="text-center text-sm text-[color:var(--color-text-muted)]">
                      No team members
                    </p>
                  ) : (
                    (data?.team ?? []).map((t) => (
                      <ResponsiveCard key={t.name + t.role}>
                        <div className="space-y-2 text-sm">
                          <div className="font-semibold text-[color:var(--color-text-primary)]">
                            {t.name}
                          </div>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                            <div>
                              <div className="text-xs text-[color:var(--color-text-muted)]">
                                Role
                              </div>
                              <div>{t.role}</div>
                            </div>
                            <div>
                              <div className="text-xs text-[color:var(--color-text-muted)]">
                                Target
                              </div>
                              <div className="tabular-nums">{t.target}</div>
                            </div>
                            <div>
                              <div className="text-xs text-[color:var(--color-text-muted)]">
                                Done
                              </div>
                              <div className="tabular-nums">{t.done}</div>
                            </div>
                            <div>
                              <div className="text-xs text-[color:var(--color-text-muted)]">
                                Performance
                              </div>
                              <div className="tabular-nums font-medium">
                                {t.performancePct}%
                              </div>
                            </div>
                          </div>
                        </div>
                      </ResponsiveCard>
                    ))
                  )}
                </div>
              }
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
