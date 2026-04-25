"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StageBarChart } from "@/components/charts/stage-bar-chart";
import { TeamLineChart } from "@/components/charts/team-line-chart";
import { TableWrap, Th, Tr, Td } from "@/components/ui/table";
import { useSessionStore, buildAuthHeaders } from "@/store/zustand/session-store";

type AdminSummary = {
  stages: Record<string, number>;
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
  const tenantId = useSessionStore((s) => s.tenantId);
  const userId = useSessionStore((s) => s.userId);
  const role = useSessionStore((s) => s.role);

  const [data, setData] = useState<AdminSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);

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
        if (!cancelled) setData(json.data as AdminSummary);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiSecret, tenantId, userId, role]);

  const barData =
    data?.stages &&
    Object.entries(data.stages)
      .filter(([k]) => k !== "warehouse")
      .map(([name, count]) => ({
        name: name.replaceAll("_", " "),
        count: Number(count) || 0,
      }));

  const lineData =
    data?.team.map((t) => ({
      name: t.name.slice(0, 14),
      performance: t.performancePct,
    })) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="إدارة متقدمة"
        description="ملخص المراحل، الفريق، ونقاط الاختناق. يتطلب دور مدير أو مشرف."
      />

      {err ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {err}
        </p>
      ) : null}

      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 lg:col-span-6">
          <CardHeader>
            <CardTitle>طلبات حسب المرحلة</CardTitle>
          </CardHeader>
          <CardContent>
            {barData && barData.length > 0 ? (
              <StageBarChart data={barData} />
            ) : (
              <p className="text-sm text-[color:var(--color-text-muted)]">لا بيانات</p>
            )}
          </CardContent>
        </Card>
        <Card className="col-span-12 lg:col-span-6">
          <CardHeader>
            <CardTitle>أداء الفريق</CardTitle>
          </CardHeader>
          <CardContent>
            {lineData.length > 0 ? (
              <TeamLineChart data={lineData} />
            ) : (
              <p className="text-sm text-[color:var(--color-text-muted)]">لا بيانات</p>
            )}
          </CardContent>
        </Card>
        {data?.bottleneck ? (
          <Card className="col-span-12">
            <CardContent className="py-4 text-sm">
              <span className="text-[color:var(--color-text-muted)]">اختناق محتمل:</span>{" "}
              <span className="font-mono font-medium">{data.bottleneck}</span>
            </CardContent>
          </Card>
        ) : null}
        <Card className="col-span-12">
          <CardHeader>
            <CardTitle>الفريق</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <TableWrap className="rounded-none border-0 shadow-none">
              <thead>
                <tr>
                  <Th>الاسم</Th>
                  <Th>الدور</Th>
                  <Th>الهدف</Th>
                  <Th>المنجز</Th>
                  <Th>الأداء</Th>
                </tr>
              </thead>
              <tbody>
                {(data?.team ?? []).map((t) => (
                  <Tr key={t.name + t.role}>
                    <Td>{t.name}</Td>
                    <Td>{t.role}</Td>
                    <Td>{t.target}</Td>
                    <Td>{t.done}</Td>
                    <Td>{t.performancePct}%</Td>
                  </Tr>
                ))}
              </tbody>
            </TableWrap>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
