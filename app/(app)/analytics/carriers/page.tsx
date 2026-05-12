"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { can } from "@/lib/auth/rbac";
import { buildAuthHeaders, useSessionStore } from "@/store/zustand/session-store";

type CarrierLedgerRow = {
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
};

type CarrierLedgerPayload = {
  from: string;
  to: string;
  carriers: CarrierLedgerRow[];
};

function carrierLabel(provider: string) {
  if (provider === "bosta") return "Bosta";
  if (provider === "jnt_egypt") return "J&T Egypt";
  if (provider === "fedex") return "FedEx";
  return "Demo carrier";
}

function balanceLabel(balance: number) {
  if (balance > 0) return "مدينون للشركة";
  if (balance < 0) return "الشركة مدينة لنا";
  return "متوازن";
}

function csvEscape(value: string | number) {
  const raw = String(value);
  return /[",\n]/.test(raw) ? `"${raw.replaceAll('"', '""')}"` : raw;
}

export default function CarrierLedgerPage() {
  const apiSecret = useSessionStore((s) => s.apiSecret);
  const idToken = useSessionStore((s) => s.idToken);
  const tenantId = useSessionStore((s) => s.tenantId);
  const userId = useSessionStore((s) => s.userId);
  const role = useSessionStore((s) => s.role);
  const permissions = useSessionStore((s) => s.permissions);
  const authReady = useSessionStore((s) => s.authReady);
  const canViewFinance = can({ role, permissions }, "finance:view");

  const [fromDate, setFromDate] = useState(() => {
    const t = new Date();
    t.setUTCDate(t.getUTCDate() - 29);
    return t.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [ledger, setLedger] = useState<CarrierLedgerPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const fmtMoney = (n: number) =>
    n.toLocaleString("ar-EG-u-nu-latn", {
      style: "currency",
      currency: "EGP",
    });

  const totals = useMemo(() => {
    const rows = ledger?.carriers ?? [];
    return rows.reduce(
      (acc, row) => ({
        totalDebit: acc.totalDebit + row.total_debit,
        totalCredit: acc.totalCredit + row.total_credit,
        codActive: acc.codActive + row.cod_active,
        netBalance: acc.netBalance + row.net_balance,
        shipments: acc.shipments + row.shipments_count,
      }),
      {
        totalDebit: 0,
        totalCredit: 0,
        codActive: 0,
        netBalance: 0,
        shipments: 0,
      },
    );
  }, [ledger]);

  const loadLedger = useCallback(async () => {
    if (!authReady || !canViewFinance) {
      setLedger(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const q = new URLSearchParams({ from: fromDate, to: toDate });
      const res = await fetch(`/api/analytics/carriers?${q}`, {
        headers: buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setLedger(json.data as CarrierLedgerPayload);
    } catch (e) {
      setLedger(null);
      setErr(e instanceof Error ? e.message : "Failed to load carrier ledger");
    } finally {
      setLoading(false);
    }
  }, [
    apiSecret,
    authReady,
    canViewFinance,
    fromDate,
    idToken,
    role,
    tenantId,
    toDate,
    userId,
  ]);

  useEffect(() => {
    if (!authReady) return;
    void loadLedger();
  }, [authReady, loadLedger]);

  function exportCsv() {
    const rows = ledger?.carriers ?? [];
    const header = [
      "Carrier",
      "Shipments",
      "Delivery debit",
      "Return debit",
      "Exchange debit",
      "Total debit",
      "COD delivered credit",
      "COD active",
      "Total credit",
      "Net balance",
    ];
    const body = rows.map((row) => [
      carrierLabel(row.provider),
      row.shipments_count,
      row.delivery_cost,
      row.return_cost,
      row.exchange_cost,
      row.total_debit,
      row.cod_delivered,
      row.cod_active,
      row.total_credit,
      row.net_balance,
    ]);
    const csv = [header, ...body]
      .map((row) => row.map((cell) => csvEscape(cell)).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `carrier-ledger-${fromDate}-${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 pb-20">
      <PageHeader
        title="Carrier debit / credit ledger"
        description="كشف حساب مدين ودائن لكل شركة شحن حسب رسوم الشحن ومبالغ COD المحصلة."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/analytics"
              className="inline-flex min-h-9 items-center justify-center rounded-[var(--ds-radius-md)] px-4 py-2 text-sm font-medium text-[color:var(--color-text-secondary)] transition-colors hover:bg-[color:var(--color-hover-bg)] hover:text-[color:var(--color-text-primary)]"
            >
              Back to analytics
            </Link>
            <Button
              type="button"
              variant="secondary"
              disabled={!ledger?.carriers.length}
              onClick={exportCsv}
            >
              Export CSV
            </Button>
          </div>
        }
      />

      {!canViewFinance ? (
        <Card>
          <CardContent className="p-6 text-sm text-[color:var(--color-text-muted)]">
            You do not have permission to view finance reports.
          </CardContent>
        </Card>
      ) : null}

      {canViewFinance ? (
        <>
          <div className="flex flex-col gap-4 rounded-[var(--ds-radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-4 shadow-none md:flex-row md:items-end">
            <div className="grid flex-1 gap-3 sm:grid-cols-2">
              <Input
                label="From"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
              <Input
                label="To"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => void loadLedger()}
            >
              Apply range
            </Button>
          </div>

          {err ? (
            <p className="rounded-[var(--ds-radius-md)] border border-[color:var(--color-callout-warning-border)] bg-[color:var(--color-callout-warning-bg)] p-3 text-sm text-[color:var(--color-callout-warning-text)] shadow-none">
              {err}
            </p>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {loading && !ledger ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-[var(--ds-radius-md)]" />
              ))
            ) : (
              [
                ["Total debit", totals.totalDebit],
                ["Total credit", totals.totalCredit],
                ["Net balance", totals.netBalance],
                ["Active COD", totals.codActive],
              ].map(([label, value]) => (
                <Card key={label}>
                  <CardContent className="space-y-1 p-4">
                    <p className="text-xs font-medium text-[color:var(--color-text-muted)]">
                      {label}
                    </p>
                    <p className="text-2xl font-semibold tabular-nums text-[color:var(--color-text-primary)]">
                      {fmtMoney(Number(value))}
                    </p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {loading && !ledger ? null : ledger?.carriers.length ? (
            <div className="space-y-4">
              {ledger.carriers.map((carrier) => (
                <Card key={carrier.provider}>
                  <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">
                        {carrierLabel(carrier.provider)}
                      </CardTitle>
                      <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
                        {ledger.from} to {ledger.to} · {carrier.shipments_count} shipments
                      </p>
                    </div>
                    <div className="text-end">
                      <p className="text-xs text-[color:var(--color-text-muted)]">
                        {balanceLabel(carrier.net_balance)}
                      </p>
                      <p className="text-xl font-semibold tabular-nums text-[color:var(--color-primary)]">
                        {fmtMoney(Math.abs(carrier.net_balance))}
                      </p>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <TableWrap>
                      <thead>
                        <tr>
                          <Th>البند</Th>
                          <Th>مدين</Th>
                          <Th>دائن</Th>
                        </tr>
                      </thead>
                      <tbody>
                        <Tr>
                          <Td>رسوم التوصيل ({carrier.delivery_count} شحنة)</Td>
                          <Td className="tabular-nums">
                            {fmtMoney(carrier.delivery_cost)}
                          </Td>
                          <Td className="text-[color:var(--color-text-muted)]">—</Td>
                        </Tr>
                        <Tr>
                          <Td>رسوم الإرجاع ({carrier.return_count} شحنة)</Td>
                          <Td className="tabular-nums">
                            {fmtMoney(carrier.return_cost)}
                          </Td>
                          <Td className="text-[color:var(--color-text-muted)]">—</Td>
                        </Tr>
                        <Tr>
                          <Td>رسوم الاستبدال ({carrier.exchange_count} شحنة)</Td>
                          <Td className="tabular-nums">
                            {fmtMoney(carrier.exchange_cost)}
                          </Td>
                          <Td className="text-[color:var(--color-text-muted)]">—</Td>
                        </Tr>
                        <Tr>
                          <Td>مبالغ COD محصلة ({carrier.delivered_count} شحنة)</Td>
                          <Td className="text-[color:var(--color-text-muted)]">—</Td>
                          <Td className="tabular-nums">
                            {fmtMoney(carrier.cod_delivered)}
                          </Td>
                        </Tr>
                        <Tr>
                          <Td>COD نشط لم يتم تسويته بعد</Td>
                          <Td className="text-[color:var(--color-text-muted)]">—</Td>
                          <Td className="tabular-nums text-[color:var(--color-text-muted)]">
                            {fmtMoney(carrier.cod_active)}
                          </Td>
                        </Tr>
                        <Tr className="bg-[color:var(--color-bg-subtle)] font-semibold">
                          <Td>الإجمالي</Td>
                          <Td className="tabular-nums">
                            {fmtMoney(carrier.total_debit)}
                          </Td>
                          <Td className="tabular-nums">
                            {fmtMoney(carrier.total_credit)}
                          </Td>
                        </Tr>
                      </tbody>
                    </TableWrap>
                    <p className="mt-3 text-sm font-medium text-[color:var(--color-text-secondary)]">
                      الرصيد الصافي: {balanceLabel(carrier.net_balance)} بقيمة{" "}
                      <span className="tabular-nums text-[color:var(--color-text-primary)]">
                        {fmtMoney(Math.abs(carrier.net_balance))}
                      </span>
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-6 text-sm text-[color:var(--color-text-muted)]">
                No carrier ledger entries in this date range.
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}
