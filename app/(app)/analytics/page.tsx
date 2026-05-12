"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCardSkeleton, Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Select } from "@/components/ui/input";
import { MiniSparkline } from "@/components/charts/mini-sparkline";
import { useSessionStore, buildAuthHeaders } from "@/store/zustand/session-store";
import { can } from "@/lib/auth/rbac";
import type { WhatsAppOpsSnapshot } from "@/lib/services/ops-analytics.service";

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
    cogs_value: number;
    confirmed_orders_count: number;
    shipments_count: number;
    shipping_cost: number;
    delivery_shipments_count: number;
    delivery_shipping_cost: number;
    return_shipments_count: number;
    return_shipping_cost: number;
    exchange_shipments_count: number;
    exchange_shipping_cost: number;
    returns_count: number;
    returns_value: number;
    refunds_value: number;
    exchanges_count: number;
    exchanges_value: number;
    gross_profit: number;
    profit: number;
  };
  series: {
    date: string;
    orders_count: number;
    orders_value: number;
    cogs_value: number;
    shipping_cost: number;
    returns_count: number;
    refunds_value: number;
    gross_profit: number;
    profit: number;
  }[];
  carrierFinancials: {
    provider: string;
    shipments_count: number;
    delivery_count: number;
    return_count: number;
    exchange_count: number;
    cancelled_count: number;
    failed_count: number;
    delivered_count: number;
    shipping_cost: number;
    delivery_cost: number;
    return_cost: number;
    exchange_cost: number;
    total_debit: number;
    cod_delivered: number;
    cod_active: number;
    total_credit: number;
    net_balance: number;
    average_cost: number;
  }[];
  kpi: {
    costPerOrder: number;
    returnRate: number;
    conversionRate: number;
    grossProfit: number;
    profit: number;
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

function carrierLabel(provider: string) {
  if (provider === "bosta") return "Bosta";
  if (provider === "jnt_egypt") return "J&T Egypt";
  if (provider === "fedex") return "FedEx";
  return "Demo carrier";
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
          ? "rounded-full bg-[color:var(--color-success)]/15 px-2 py-0.5 text-[11px] font-semibold text-[color:var(--color-success)] shadow-none"
          : "rounded-full bg-[color:var(--color-error)]/15 px-2 py-0.5 text-[11px] font-semibold text-[color:var(--color-error)] shadow-none"
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
  const permissions = useSessionStore((s) => s.permissions);
  const authReady = useSessionStore((s) => s.authReady);

  const [tab, setTab] = useState<"dashboard" | "ops" | "whatsapp">("dashboard");
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [summaryErr, setSummaryErr] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [entity, setEntity] = useState("tenant");

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
  const [financialLoading, setFinancialLoading] = useState(true);
  const [rebuildBusy, setRebuildBusy] = useState(false);
  const [granularity, setGranularity] = useState<"daily" | "weekly">("daily");
  const canViewFinance = can({ role, permissions }, "finance:view");
  const canAnalytics = can({ role, permissions }, "page:analytics");

  const tabItems = useMemo(() => {
    const items: { id: "dashboard" | "ops" | "whatsapp"; label: string }[] = [];
    if (canViewFinance) items.push({ id: "dashboard", label: "Dashboard" });
    items.push({ id: "ops", label: "Operations" });
    if (canAnalytics) items.push({ id: "whatsapp", label: "WhatsApp" });
    return items;
  }, [canViewFinance, canAnalytics]);

  useEffect(() => {
    if (!canViewFinance && tab === "dashboard") {
      setTab("ops");
    }
  }, [canViewFinance, tab]);

  useEffect(() => {
    if (!canAnalytics && tab === "whatsapp") {
      setTab(canViewFinance ? "dashboard" : "ops");
    }
  }, [canAnalytics, tab, canViewFinance]);

  const [waSnap, setWaSnap] = useState<WhatsAppOpsSnapshot | null>(null);
  const [waLoading, setWaLoading] = useState(false);
  const [waErr, setWaErr] = useState<string | null>(null);
  const [waDays, setWaDays] = useState(7);

  useEffect(() => {
    if (!authReady || tab !== "whatsapp" || !canAnalytics) return;
    let cancelled = false;
    (async () => {
      setWaLoading(true);
      setWaErr(null);
      try {
        const res = await fetch(`/api/analytics/whatsapp?days=${waDays}`, {
          headers: buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? res.statusText);
        if (!cancelled) setWaSnap(json.data as WhatsAppOpsSnapshot);
      } catch (e) {
        if (!cancelled)
          setWaErr(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setWaLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    authReady,
    tab,
    canAnalytics,
    waDays,
    apiSecret,
    idToken,
    tenantId,
    userId,
    role,
  ]);

  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    (async () => {
      setSummaryErr(null);
      setSummaryLoading(true);
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
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authReady, apiSecret, idToken, tenantId, userId, role]);

  const loadFinancial = useCallback(async () => {
    if (!authReady || !canViewFinance) {
      setFinancial(null);
      setFinancialLoading(false);
      return;
    }
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
  }, [authReady, canViewFinance, apiSecret, idToken, tenantId, userId, role, fromDate, toDate]);

  useEffect(() => {
    if (!authReady) return;
    void loadFinancial();
  }, [authReady, loadFinancial]);

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
  const cogsSpark = useMemo(
    () => financial?.series.map((r) => r.cogs_value) ?? [],
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
  const cogsTrend = trendFromSeries(cogsSpark);
  const profitTrend = trendFromSeries(profitSpark);
  const shipDayAvg =
    t && financial && financial.series.length > 0
      ? t.shipping_cost / financial.series.length
      : 0;

  const fmtMoney = (n: number) =>
    n.toLocaleString("ar-EG-u-nu-latn", {
      style: "currency",
      currency: "EGP",
    });

  async function onRebuildDay() {
    setRebuildBusy(true);
    setFinancialErr(null);
    try {
      if (!canViewFinance) throw new Error("Forbidden");
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
              items={tabItems}
              value={tab}
              onChange={(id) =>
                setTab(id as "dashboard" | "ops" | "whatsapp")
              }
            />
          </div>
        }
      />

      {tab === "dashboard" && canViewFinance ? (
        <div className="flex flex-col gap-4 rounded-[var(--ds-radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-4 shadow-none md:flex-row md:flex-wrap md:items-end">
          <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <label className="text-[12px] font-medium text-[color:var(--color-text-muted)]">
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
              <label className="text-[12px] font-medium text-[color:var(--color-text-muted)]">
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
              <label className="text-[12px] font-medium text-[color:var(--color-text-muted)]">
                Scope
              </label>
              <Select
                value={entity}
                onChange={(e) => setEntity(e.target.value)}
                className="h-10"
              >
                <option value="tenant">Current tenant</option>
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

      {tab === "ops" && !summaryLoading && summaryErr ? (
        <p className="rounded-[var(--ds-radius-md)] border border-[color:var(--color-callout-warning-border)] bg-[color:var(--color-callout-warning-bg)] p-3 text-sm text-[color:var(--color-callout-warning-text)] shadow-none">
          {summaryErr}
        </p>
      ) : null}

      {tab === "dashboard" && canViewFinance && !financialLoading && financialErr ? (
        <p className="rounded-[var(--ds-radius-md)] border border-[color:var(--color-callout-warning-border)] bg-[color:var(--color-callout-warning-bg)] p-3 text-sm text-[color:var(--color-callout-warning-text)] shadow-none">
          {financialErr}
        </p>
      ) : null}

      {tab === "dashboard" && canViewFinance ? (
        <>
          {financialLoading && !financial ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <KpiCardSkeleton key={i} />
              ))}
            </div>
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
                  sub:
                    t.orders_count > 0
                      ? `${fmtMoney(t.orders_value / t.orders_count)} avg. order value`
                      : "No order revenue in this range",
                },
                {
                  title: "COGS",
                  value: fmtMoney(t.cogs_value),
                  valueClass: "text-[color:var(--color-warning)]",
                  trend: cogsTrend,
                  trendInvert: true,
                  spark: cogsSpark,
                  sub:
                    t.orders_value > 0
                      ? `${((t.cogs_value / t.orders_value) * 100).toFixed(1)}% of revenue`
                      : "Add cost metadata to line items",
                },
                {
                  title: "Carrier cost",
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
                  title: "Net profit",
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
                <div className="flex rounded-[var(--ds-radius-md)] bg-[color:var(--color-bg-subtle)] p-1 ring-1 ring-inset ring-[color:var(--color-border)]">
                  <button
                    type="button"
                    className={
                      granularity === "daily"
                        ? "rounded-[var(--ds-radius-md)] bg-[color:var(--color-primary)] px-3 py-1 text-xs font-medium text-[color:var(--color-primary-contrast)] shadow-none"
                        : "rounded-[var(--ds-radius-md)] px-3 py-1 text-xs font-medium text-[color:var(--color-text-secondary)]"
                    }
                    onClick={() => setGranularity("daily")}
                  >
                    Daily
                  </button>
                  <button
                    type="button"
                    className={
                      granularity === "weekly"
                        ? "rounded-[var(--ds-radius-md)] bg-[color:var(--color-primary)] px-3 py-1 text-xs font-medium text-[color:var(--color-primary-contrast)] shadow-none"
                        : "rounded-[var(--ds-radius-md)] px-3 py-1 text-xs font-medium text-[color:var(--color-text-secondary)]"
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
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-2xl font-semibold tabular-nums text-[color:var(--color-primary)]">
                      {fmtMoney(shipDayAvg)}
                      <span className="text-base font-medium text-[color:var(--color-text-muted)]">
                        {" "}
                        /avg. day
                      </span>
                    </p>
                    <DeltaBadge
                      pct={shipTrend.pct}
                      up={shipTrend.up}
                      invert
                    />
                  </div>
                  <p className="text-xs text-[color:var(--color-text-muted)]">
                    Compared across the selected date range
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {t ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <Card className="lg:col-span-5">
                <CardHeader>
                  <CardTitle className="text-base">Accounting breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {[
                    ["Revenue", t.orders_value],
                    ["COGS", -t.cogs_value],
                    ["Carrier shipping", -t.shipping_cost],
                    ["Refunds / returns", -t.refunds_value],
                    ["Exchange delta", -t.exchanges_value],
                    ["Net profit", t.profit],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between gap-3 border-b border-[color:var(--color-divider)] pb-2 last:border-0 last:pb-0"
                    >
                      <span className="text-[color:var(--color-text-muted)]">
                        {label}
                      </span>
                      <span className="font-semibold tabular-nums text-[color:var(--color-text-primary)]">
                        {fmtMoney(Number(value))}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card className="lg:col-span-7">
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">Carrier P&L</CardTitle>
                  <Link
                    href="/analytics/carriers"
                    className="text-xs font-medium text-[color:var(--color-primary)] hover:underline"
                  >
                    Open ledger
                  </Link>
                </CardHeader>
                <CardContent className="space-y-3">
                  {financial?.carrierFinancials.length ? (
                    financial.carrierFinancials.map((row) => (
                      <div
                        key={row.provider}
                        className="rounded-[var(--ds-radius-md)] border border-[color:var(--color-border)] p-3 text-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold text-[color:var(--color-text-primary)]">
                              {carrierLabel(row.provider)}
                            </p>
                            <p className="text-xs text-[color:var(--color-text-muted)]">
                              {row.shipments_count} shipments · balance{" "}
                              {fmtMoney(row.net_balance)}
                            </p>
                          </div>
                          <p className="text-lg font-semibold tabular-nums text-[color:var(--color-primary)]">
                            {fmtMoney(row.total_debit)}
                          </p>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[color:var(--color-text-muted)] sm:grid-cols-4">
                          <span>Delivery: {row.delivery_count}</span>
                          <span>Returns: {row.return_count}</span>
                          <span>Exchanges: {row.exchange_count}</span>
                          <span>Failed/cancelled: {row.failed_count + row.cancelled_count}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[color:var(--color-text-muted)]">
                      No carrier shipments in this range.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}

          {financial?.kpi ? (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-[var(--ds-radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-4 py-3 text-[11px] font-medium text-[color:var(--color-text-muted)] shadow-none">
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
                  Gross profit:{" "}
                </span>
                <span className="text-[color:var(--color-text-primary)] tabular-nums">
                  {fmtMoney(financial.kpi.grossProfit)}
                </span>
              </span>
              <span>
                <span className="text-[color:var(--color-text-muted)]">
                  Reverse shipping:{" "}
                </span>
                <span className="text-[color:var(--color-text-primary)] tabular-nums">
                  {fmtMoney(
                    (t?.return_shipping_cost ?? 0) +
                      (t?.exchange_shipping_cost ?? 0),
                  )}
                </span>
              </span>
            </div>
          ) : null}
        </>
      ) : null}

      {tab === "ops" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <Card className="lg:col-span-6">
            <CardHeader>
              <CardTitle>Stage distribution (orders & value)</CardTitle>
            </CardHeader>
            <CardContent>
              {summaryLoading && !summaryErr ? (
                <Skeleton className="h-72 w-full" />
              ) : barData && barData.length > 0 ? (
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
              {summaryLoading && !summaryErr ? (
                <Skeleton className="h-72 w-full" />
              ) : lineData.length > 0 ? (
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
      ) : null}

      {tab === "whatsapp" && canAnalytics ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-[12px] font-medium text-[color:var(--color-text-muted)]">
                Period (days)
              </label>
              <Select
                value={String(waDays)}
                onChange={(e) => setWaDays(Number(e.target.value))}
                className="h-10 w-32"
              >
                <option value={7}>7</option>
                <option value={14}>14</option>
                <option value={30}>30</option>
              </Select>
            </div>
          </div>
          {waErr ? (
            <p className="rounded-[var(--ds-radius-md)] border border-[color:var(--color-callout-warning-border)] bg-[color:var(--color-callout-warning-bg)] p-3 text-sm text-[color:var(--color-callout-warning-text)] shadow-none">
              {waErr}
            </p>
          ) : null}
          {waLoading && !waSnap ? (
            <Skeleton className="h-40 w-full" />
          ) : waSnap ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Active threads</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold tabular-nums">
                    {waSnap.activeConversations}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
                    Non-closed conversations (sample up to 300 rows)
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Human takeover</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold tabular-nums">
                    {waSnap.humanTakeoverConversations}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
                    Same sample window
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">OMS events</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold tabular-nums">
                    {Object.values(waSnap.eventCounts).reduce((a, b) => a + b, 0)}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
                    Last {waSnap.periodDays} days (max 500 rows)
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Confirmation rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold tabular-nums">
                    {waSnap.derived.confirmationRate != null
                      ? `${Math.round(waSnap.derived.confirmationRate * 100)}%`
                      : "—"}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
                    confirmed ÷ confirmation.requested (OMS events sample)
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">SLA breaches</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold tabular-nums">
                    {waSnap.derived.slaBreaches}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
                    Warnings: {waSnap.derived.slaWarnings}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">AI / classifier</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold tabular-nums">
                    {waSnap.derived.classifiedReplies}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
                    Needs human: {waSnap.derived.needsHuman}
                  </p>
                </CardContent>
              </Card>
              <Card className="sm:col-span-3">
                <CardHeader>
                  <CardTitle className="text-base">Event breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  {Object.keys(waSnap.eventCounts).length === 0 ? (
                    <p className="text-sm text-[color:var(--color-text-muted)]">
                      No events in this window.
                    </p>
                  ) : (
                    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {Object.entries(waSnap.eventCounts)
                        .sort((a, b) => b[1] - a[1])
                        .map(([k, v]) => (
                          <li
                            key={k}
                            className="flex items-center justify-between rounded-[var(--ds-radius-md)] border border-[color:var(--color-border-subtle)] px-3 py-2 text-sm"
                          >
                            <span className="font-mono text-xs">{k}</span>
                            <span className="tabular-nums font-medium">{v}</span>
                          </li>
                        ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </div>
      ) : null}

      <Link
        href="/orders"
        className="fixed bottom-6 end-6 z-20 flex size-14 items-center justify-center rounded-full bg-[color:var(--color-primary)] text-[color:var(--color-primary-contrast)] shadow-none transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-bg)]"
        aria-label="Create or view orders"
      >
        <Plus className="size-7" aria-hidden />
      </Link>
    </div>
  );
}
