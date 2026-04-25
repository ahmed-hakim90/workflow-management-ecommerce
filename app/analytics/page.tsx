"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useSessionStore, buildAuthHeaders } from "@/store/zustand/session-store";

const StageBarChart = dynamic(
  () =>
    import("@/components/charts/stage-bar-chart").then((m) => m.StageBarChart),
  { loading: () => <Skeleton className="h-64 w-full" /> },
);

const TeamLineChart = dynamic(
  () =>
    import("@/components/charts/team-line-chart").then((m) => m.TeamLineChart),
  { loading: () => <Skeleton className="h-64 w-full" /> },
);

type AdminSummary = {
  stages: Record<string, number>;
  team: {
    userId: string;
    name: string;
    performancePct: number;
  }[];
  bottleneck?: string;
};

export default function AnalyticsPage() {
  const apiSecret = useSessionStore((s) => s.apiSecret);
  const tenantId = useSessionStore((s) => s.tenantId);
  const userId = useSessionStore((s) => s.userId);
  const role = useSessionStore((s) => s.role);

  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dateLabel, setDateLabel] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setErr(null);
      try {
        const res = await fetch("/api/admin/summary", {
          headers: buildAuthHeaders({ apiSecret, tenantId, userId, role }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? res.statusText);
        if (!cancelled) setSummary(json.data as AdminSummary);
      } catch (e) {
        if (!cancelled)
          setErr(e instanceof Error ? e.message : "تعذر التحميل");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiSecret, tenantId, userId, role]);

  const barData =
    summary?.stages &&
    Object.entries(summary.stages)
      .filter(([k]) => k !== "warehouse")
      .map(([name, count]) => ({
        name: name.replaceAll("_", " "),
        count: Number(count) || 0,
      }));

  const lineData =
    summary?.team.map((t) => ({
      name: t.name.slice(0, 12),
      performance: t.performancePct,
    })) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="التحليلات"
        description="ملخص المراحل وأداء الفريق. يتطلب صلاحية مدير أو مشرف."
        actions={
          <div className="w-full space-y-1 sm:w-auto">
            <label className="text-xs text-[color:var(--color-text-muted)]">تاريخ (واجهة)</label>
            <Input
              type="date"
              value={dateLabel}
              onChange={(e) => setDateLabel(e.target.value)}
              className="h-11 w-full md:h-9 md:w-40"
            />
          </div>
        }
      />

      {err ? (
        <p className="rounded-lg border border-[color:var(--color-callout-warning-border)] bg-[color:var(--color-callout-warning-bg)] p-3 text-sm text-[color:var(--color-callout-warning-text)]">
          {err}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-6">
          <CardHeader>
            <CardTitle>توزيع المراحل</CardTitle>
          </CardHeader>
          <CardContent>
            {barData && barData.length > 0 ? (
              <StageBarChart data={barData} />
            ) : (
              <p className="text-sm text-[color:var(--color-text-muted)]">لا بيانات</p>
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-6">
          <CardHeader>
            <CardTitle>أداء الفريق (%)</CardTitle>
          </CardHeader>
          <CardContent>
            {lineData.length > 0 ? (
              <TeamLineChart data={lineData} />
            ) : (
              <p className="text-sm text-[color:var(--color-text-muted)]">لا بيانات</p>
            )}
          </CardContent>
        </Card>
        {summary?.bottleneck ? (
          <Card className="lg:col-span-12">
            <CardHeader>
              <CardTitle>اختناق محتمل</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[color:var(--color-text-primary)]">
              أكبر تراكم عند المرحلة:{" "}
              <span className="font-mono">{summary.bottleneck}</span>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
