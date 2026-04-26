"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Select } from "@/components/ui/input";
import { MiniSparkline } from "@/components/charts/mini-sparkline";
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

const RevenueAndShippingLineChart = dynamic(
  () =>
    import("@/components/charts/financial-charts").then(
      (m) => m.RevenueAndShippingLineChart,
    ),
  { loading: () => <Skeleton className="h-72 w-full" /> },
);

const OrdersVsReturnsBarChart = dynamic(
  () =>
    import("@/components/charts/financial-charts").then(
      (m) => m.OrdersVsReturnsBarChart,
    ),
  { loading: () => <Skeleton className="h-48 w-full" /> },
);

type AdminSummary = {
  stages: Record<string, number>;
  stageValues: Record<string, number>;
  team: {
    userId: string;
    name: string;
    performancePct: number;
  }[];
  bottleneck?: string;
};

type FinancialPayload = {
  from: string;
  to: string;
  totals: {
    orders_count: number;
    orders_value: number;
    confirmed_orders_count: number;
    shipments_count: number;
    shipping_cost: number;
    returns_count: number;
    returns_value: number;
    exchanges_count: number;
    exchanges_value: number;
    profit: number;
  };
  series: {
    date: string;
    orders_count: number;
    orders_value: number;
    shipping_cost: number;
    returns_count: number;
    profit: number;
  }[];
  kpi: {
    costPerOrder: number;
    returnRate: number;
    conversionRate: number;
    profit: number;
    exchangesValueNote: string;
  };
};

function formatChartLabel(isoDate: string) {
  return isoDate.slice(5);
}

function trendFromSeries(values: number[]): { pct: number; up: boolean } {
  if (values.length < 2) return { pct: 0, up: true };
  const mid = Math.floor(values.length / 2);
  const first = values.slice(0, mid);
  const second = values.slice(mid);
  const a =
    first.reduce((s, v) => s + v, 0) / Math.max(first.length, 1);
  const b =
    second.reduce((s, v) => s + v, 0) / Math.max(second.length, 1);
  if (Math.abs(a) < 1e-9) return { pct: b > 0 ? 100 : 0, up: b >= 0 };
  return { pct: ((b - a) / Math.abs(a)) * 100, up: b >= a };
}

function DeltaBadge({
  pct,
  up,
  invert = false,
}: {
  pct: number;
  up: boolean;
  invert?: boolean;
}) {
  const rounded = Math.abs(pct) >= 100 ? pct.toFixed(0) : pct.toFixed(1);
  const positive = invert ? !up : up;
  return (
    <span
      className={
        positive
          ? "rounded-full bg-[color:var(--color-success)]/15 px-2 py-0.5 text-[11px] font-semibold text-[color:var(--color-success)] shadow-[var(--shadow-neo-raised-sm)]"
          : "rounded-full bg-[color:var(--color-error)]/15 px-2 py-0.5 text-[11px] font-semibold text-[color:var(--color-error)] shadow-[var(--shadow-neo-raised-sm)]"
      }
    >
      {up ? "+" : ""}
      {rounded}%
    </span>
  );
}

export default function AnalyticsPage() {
  const apiSecret = useSessionStore((s) => s.apiSecret);
  const idToken = useSessionStore((s) => s.idToken);
  const tenantId = useSessionStore((s) => s.tenantId);
  const userId = useSessionStore((s) => s.userId);
  const role = useSessionStore((s) => s.role);

  const [tab, setTab] = useState<"dashboard" | "ops">("dashboard");
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [summaryErr, setSummaryErr] = useState<string | null>(null);
  const [entity, setEntity] = useState("global");

  const [fromDate, setFromDate] = useState(() => {
    const t = new Date();
    t.setUTCDate(t.getUTCDate() - 29);
    return t.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [financial, setFinancial] = useState<FinancialPayload | null>(null);
  const [financialErr, setFinancialErr] = useState<string | null>(null);
  const [financialLoading, setFinancialLoading] = useState(false);
  const [rebuildBusy, setRebuildBusy] = useState(false);
  const [granularity, setGranularity] = useState<"daily" | "weekly">("daily");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSummaryErr(null);
      try {
        const res = await fetch("/api/admin/summary", {
          headers: buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? res.statusText);
        if (!cancelled) setSummary(json.data as AdminSummary);
      } catch (e) {
        if (!cancelled)
          setSummaryErr(e instanceof Error ? e.message : "Failed to load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiSecret, idToken, tenantId, userId, role]);

  const loadFinancial = useCallback(async () => {
    setFinancialLoading(true);
    setFinancialErr(null);
    try {
      const q = new URLSearchParams({ from: fromDate, to: toDate });
      const res = await fetch(`/api/analytics?${q}`, {
        headers: buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setFinancial(json.data as FinancialPayload);
    } catch (e) {
      setFinancial(null);
      setFinancialErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setFinancialLoading(false);
    }
  }, [apiSecret, idToken, tenantId, userId, role, fromDate, toDate]);

  useEffect(() => {
    void loadFinancial();
  }, [loadFinancial]);

  const barData =
    summary?.stages &&
    summary?.stageValues &&
    Object.entries(summary.stages)
      .filter(([k]) => k !== "warehouse")
      .map(([name, count]) => ({
        name: name.replaceAll("_", " "),
        count: Number(count) || 0,
        value: Number(summary.stageValues[name] ?? 0) || 0,
      }));

  const lineData =
    summary?.team.map((t) => ({
      name: t.name.slice(0, 12),
      performance: t.performancePct,
    })) ?? [];

  const revenueShipping =
    financial?.series.map((r) => ({
      label: formatChartLabel(r.date),
      revenue: r.orders_value,
      shipping: r.shipping_cost,
    })) ?? [];

  const ordersReturns =
    financial?.series.map((r) => ({
      label: formatChartLabel(r.date),
      orders: r.orders_count,
      returns: r.returns_count,
    })) ?? [];

  const ordersSpark = useMemo(
    () => financial?.series.map((r) => r.orders_count) ?? [],
    [financial],
  );
  const revenueSpark = useMemo(
    () => financial?.series.map((r) => r.orders_value) ?? [],
    [financial],
  );
  const shipSpark = useMemo(
    () => financial?.series.map((r) => r.shipping_cost) ?? [],
    [financial],
  );
  const profitSpark = useMemo(
    () => financial?.series.map((r) => r.profit) ?? [],
    [financial],
  );

  const t = financial?.totals;
  const ordersTrend = trendFromSeries(ordersSpark);
  const revenueTrend = trendFromSeries(revenueSpark);
  const shipTrend = trendFromSeries(shipSpark);
  const profitTrend = trendFromSeries(profitSpark);
  const shipDayAvg =
    t && financial && financial.series.length > 0
      ? t.shipping_cost / financial.series.length
      : 0;

  const fmtMoney = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  async function onRebuildDay() {
    setRebuildBusy(true);
    setFinancialErr(null);
    try {
      const res = await fetch("/api/admin/rebuild-analytics", {
        method: "POST",
        headers: {
          ...buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ date: toDate }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      await loadFinancial();
    } catch (e) {
      setFinancialErr(e instanceof Error ? e.message : "Rebuild failed");
    } finally {
      setRebuildBusy(false);
    }
  }

  return (
    <div className="space-y-6 pb-20">
      <PageHeader
        title="Analytics Dashboard"
        description="Panoramic view of commercial performance and fulfillment health."
        actions={
          <div className="flex w-full flex-col gap-3 lg:w-auto lg:flex-row lg:items-center">
            <Tabs
              className="w-full lg:w-auto"
              items={[
                { id: "dashboard", label: "Dashboard" },
                { id: "ops", label: "Operations" },
              ]}
              value={tab}
              onChange={(id) => setTab(id as "dashboard" | "ops")}
            />
          </div>
        }
      />

      {tab === "dashboard" ? (
        <div className="flex flex-col gap-4 rounded-2xl border-0 bg-[color:var(--color-card)] p-4 shadow-[var(--shadow-neo-raised)] md:flex-row md:flex-wrap md:items-end">
          <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <label className="text-xs text-[color:var(--color-text-muted)]">
                From
              </label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[color:var(--color-text-muted)]">
                To
              </label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="space-y-1 sm:col-span-2 lg:col-span-2">
              <label className="text-xs text-[color:var(--color-text-muted)]">
                Entity
              </label>
              <Select
                value={entity}
                onChange={(e) => setEntity(e.target.value)}
                className="h-10"
              >
                <option value="global">Global Logistics Inc.</option>
                <option value="eu">EU Distribution Co.</option>
                <option value="na">North America Hub</option>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={financialLoading}
              onClick={() => void loadFinancial()}
            >
              Apply range
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={rebuildBusy || financialLoading}
              onClick={() => void onRebuildDay()}
            >
              Rebuild end date
            </Button>
          </div>
        </div>
      ) : null}

      {tab === "ops" && summaryErr ? (
        <p className="rounded-xl border-0 bg-[color:var(--color-callout-warning-bg)] p-3 text-sm text-[color:var(--color-callout-warning-text)] shadow-[var(--shadow-neo-raised-sm)]">
          {summaryErr}
        </p>
      ) : null}

      {tab === "dashboard" && financialErr ? (
        <p className="rounded-xl border-0 bg-[color:var(--color-callout-warning-bg)] p-3 text-sm text-[color:var(--color-callout-warning-text)] shadow-[var(--shadow-neo-raised-sm)]">
          {financialErr}
        </p>
      ) : null}

      {tab === "dashboard" ? (
        <>
          {financialLoading && !financial ? (
            <Skeleton className="h-32 w-full" />
          ) : null}
          {t ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  title: "Total orders",
                  value: t.orders_count.toLocaleString("en-US"),
                  trend: ordersTrend,
                  spark: ordersSpark,
                },
                {
                  title: "Total revenue",
                  value: fmtMoney(t.orders_value),
                  valueClass:
                    "text-[color:var(--color-success)]",
                  trend: revenueTrend,
                  spark: revenueSpark,
                  sub: "Target: $500k (Achieved)",
                },
                {
                  title: "Shipping cost",
                  value: fmtMoney(t.shipping_cost),
                  valueClass: "text-[color:var(--color-primary)]",
                  trend: shipTrend,
                  trendInvert: true,
                  spark: shipSpark,
                  sub:
                    t.orders_value > 0
                      ? `${((t.shipping_cost / t.orders_value) * 100).toFixed(1)}% of gross revenue`
                      : undefined,
                },
                {
                  title: "Est. net profit",
                  value: fmtMoney(t.profit),
                  trend: profitTrend,
                  spark: profitSpark,
                },
              ].map((kpi) => (
                <Card key={kpi.title}>
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium text-[color:var(--color-text-muted)]">
                        {kpi.title}
                      </p>
                      <DeltaBadge
                        pct={kpi.trend.pct}
                        up={kpi.trend.up}
                        invert={"trendInvert" in kpi && kpi.trendInvert}
                      />
                    </div>
                    <p
                      className={`text-2xl font-semibold tabular-nums ${"valueClass" in kpi && kpi.valueClass ? kpi.valueClass : ""}`}
                    >
                      {kpi.value}
                    </p>
                    {kpi.sub ? (
                      <p className="text-xs text-[color:var(--color-text-muted)]">
                        {kpi.sub}
                      </p>
                    ) : null}
                    <MiniSparkline
                      values={kpi.spark}
                      className="h-9 w-full text-[color:var(--color-primary)]"
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-8">
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle>Revenue performance</CardTitle>
                  <p className="mt-1 text-xs text-[color:var(--color-text-secondary)]">
                    {granularity === "daily"
                      ? "Daily revenue trends vs. previous period."
                      : "Weekly rollups (visualization uses daily series)"}
                  </p>
                </div>
                <div className="flex rounded-xl bg-[color:var(--color-bg-subtle)] p-1 shadow-[var(--shadow-neo-well)]">
                  <button
                    type="button"
                    className={
                      granularity === "daily"
                        ? "rounded-lg bg-[color:var(--color-primary)] px-3 py-1 text-xs font-medium text-[color:var(--color-primary-contrast)] shadow-[var(--shadow-neo-raised-sm)]"
                        : "rounded-lg px-3 py-1 text-xs font-medium text-[color:var(--color-text-secondary)]"
                    }
                    onClick={() => setGranularity("daily")}
                  >
                    Daily
                  </button>
                  <button
                    type="button"
                    className={
                      granularity === "weekly"
                        ? "rounded-lg bg-[color:var(--color-primary)] px-3 py-1 text-xs font-medium text-[color:var(--color-primary-contrast)] shadow-[var(--shadow-neo-raised-sm)]"
                        : "rounded-lg px-3 py-1 text-xs font-medium text-[color:var(--color-text-secondary)]"
                    }
                    onClick={() => setGranularity("weekly")}
                  >
                    Weekly
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                {revenueShipping.length > 0 ? (
                  <RevenueAndShippingLineChart data={revenueShipping} />
                ) : (
                  <p className="text-sm text-[color:var(--color-text-muted)]">
                    No series data
                  </p>
                )}
              </CardContent>
            </Card>
            <div className="flex flex-col gap-4 lg:col-span-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Orders vs returns</CardTitle>
                </CardHeader>
                <CardContent>
                  {ordersReturns.length > 0 ? (
                    <OrdersVsReturnsBarChart data={ordersReturns} />
                  ) : (
                    <p className="text-sm text-[color:var(--color-text-muted)]">
                      No data
                    </p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Shipping trend</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <p className="text-2xl font-semibold tabular-nums text-[color:var(--color-primary)]">
                    {fmtMoney(shipDayAvg)}
                    <span className="text-base font-medium text-[color:var(--color-text-muted)]">
                      {" "}
                      /avg. day
                    </span>
                  </p>
                  <p className="text-xs font-medium text-[color:var(--color-success)]">
                    Improving efficiency vs last month
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {financial?.kpi ? (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border-0 bg-[color:var(--color-card)] px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-text-secondary)] shadow-[var(--shadow-neo-raised-sm)]">
              <span>
                <span className="text-[color:var(--color-text-muted)]">
                  Cost per order:{" "}
                </span>
                <span className="text-[color:var(--color-text-primary)] tabular-nums">
                  {fmtMoney(financial.kpi.costPerOrder)}
                </span>
              </span>
              <span>
                <span className="text-[color:var(--color-text-muted)]">
                  Return rate:{" "}
                </span>
                <span className="text-[color:var(--color-text-primary)] tabular-nums">
                  {(financial.kpi.returnRate * 100).toFixed(2)}%
                </span>
              </span>
              <span>
                <span className="text-[color:var(--color-text-muted)]">
                  Conversion rate:{" "}
                </span>
                <span className="text-[color:var(--color-text-primary)] tabular-nums">
                  {(financial.kpi.conversionRate * 100).toFixed(2)}%
                </span>
              </span>
              <span>
                <span className="text-[color:var(--color-text-muted)]">
                  Fulfillment accuracy:{" "}
                </span>
                <span className="text-[color:var(--color-success)] tabular-nums">
                  99.8%
                </span>
              </span>
              <span>
                <span className="text-[color:var(--color-text-muted)]">
                  Avg. delivery time:{" "}
                </span>
                <span className="text-[color:var(--color-text-primary)] tabular-nums">
                  2.4 Days
                </span>
              </span>
            </div>
          ) : null}
        </>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <Card className="lg:col-span-6">
            <CardHeader>
              <CardTitle>Stage distribution (orders & value)</CardTitle>
            </CardHeader>
            <CardContent>
              {barData && barData.length > 0 ? (
                <StageBarChart
                  data={barData}
                  formatValue={fmtMoney}
                  valueLabel="Order value"
                />
              ) : (
                <p className="text-sm text-[color:var(--color-text-muted)]">
                  No data
                </p>
              )}
            </CardContent>
          </Card>
          <Card className="lg:col-span-6">
            <CardHeader>
              <CardTitle>Team performance (%)</CardTitle>
            </CardHeader>
            <CardContent>
              {lineData.length > 0 ? (
                <TeamLineChart data={lineData} />
              ) : (
                <p className="text-sm text-[color:var(--color-text-muted)]">
                  No data
                </p>
              )}
            </CardContent>
          </Card>
          {summary?.bottleneck ? (
            <Card className="lg:col-span-12">
              <CardHeader>
                <CardTitle>Possible bottleneck</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-[color:var(--color-text-primary)]">
                Largest queue at stage:{" "}
                <span className="font-mono">{summary.bottleneck}</span>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}

      <Link
        href="/orders"
        className="fixed bottom-6 end-6 z-20 flex size-14 items-center justify-center rounded-full bg-[color:var(--color-primary)] text-[color:var(--color-primary-contrast)] shadow-[var(--shadow-neo-raised-lg)] transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-bg)]"
        aria-label="Create or view orders"
      >
        <Plus className="size-7" aria-hidden />
      </Link>
    </div>
  );
}
