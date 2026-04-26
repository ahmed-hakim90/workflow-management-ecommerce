"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartPalette } from "@/lib/theme/chart-colors";

export function RevenueAndShippingLineChart({
  data,
}: {
  data: { label: string; revenue: number; shipping: number }[];
}) {
  const p = useChartPalette();
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={p.grid} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: p.axis }}
            stroke={p.axis}
          />
          <YAxis tick={{ fontSize: 11, fill: p.axis }} stroke={p.axis} />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: `1px solid ${p.tooltipBorder}`,
              fontSize: 12,
              backgroundColor: p.tooltipBg,
              color: p.tooltipText,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="revenue"
            name="الإيراد"
            stroke={p.line}
            strokeWidth={2}
            dot={{ r: 2, fill: p.line }}
          />
          <Line
            type="monotone"
            dataKey="shipping"
            name="تكلفة الشحن"
            stroke={p.bar}
            strokeWidth={2}
            dot={{ r: 2, fill: p.bar }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function OrdersVsReturnsBarChart({
  data,
}: {
  data: { label: string; orders: number; returns: number }[];
}) {
  const p = useChartPalette();
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={p.grid} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: p.axis }}
            stroke={p.axis}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: p.axis }}
            stroke={p.axis}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: `1px solid ${p.tooltipBorder}`,
              fontSize: 12,
              backgroundColor: p.tooltipBg,
              color: p.tooltipText,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="orders" name="طلبات" fill={p.line} radius={[4, 4, 0, 0]} />
          <Bar dataKey="returns" name="مرتجعات" fill={p.bar} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ProfitLineChart({
  data,
}: {
  data: { label: string; profit: number }[];
}) {
  const p = useChartPalette();
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={p.grid} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: p.axis }}
            stroke={p.axis}
          />
          <YAxis tick={{ fontSize: 11, fill: p.axis }} stroke={p.axis} />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: `1px solid ${p.tooltipBorder}`,
              fontSize: 12,
              backgroundColor: p.tooltipBg,
              color: p.tooltipText,
            }}
          />
          <Line
            type="monotone"
            dataKey="profit"
            name="الربح"
            stroke={p.line}
            strokeWidth={2}
            dot={{ r: 2, fill: p.line }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function FinancialChartsSection({
  revenueShipping,
  ordersReturns,
  profit,
}: {
  revenueShipping: { label: string; revenue: number; shipping: number }[];
  ordersReturns: { label: string; orders: number; returns: number }[];
  profit: { label: string; profit: number }[];
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <Card className="lg:col-span-6">
        <CardHeader>
          <CardTitle>الإيراد وتكلفة الشحن</CardTitle>
        </CardHeader>
        <CardContent>
          {revenueShipping.length > 0 ? (
            <RevenueAndShippingLineChart data={revenueShipping} />
          ) : (
            <p className="text-sm text-[color:var(--color-text-muted)]">لا بيانات</p>
          )}
        </CardContent>
      </Card>
      <Card className="lg:col-span-6">
        <CardHeader>
          <CardTitle>الطلبات مقابل المرتجعات</CardTitle>
        </CardHeader>
        <CardContent>
          {ordersReturns.length > 0 ? (
            <OrdersVsReturnsBarChart data={ordersReturns} />
          ) : (
            <p className="text-sm text-[color:var(--color-text-muted)]">لا بيانات</p>
          )}
        </CardContent>
      </Card>
      <Card className="lg:col-span-12">
        <CardHeader>
          <CardTitle>صافي ا لايرادات اليومي</CardTitle>
        </CardHeader>
        <CardContent>
          {profit.length > 0 ? (
            <ProfitLineChart data={profit} />
          ) : (
            <p className="text-sm text-[color:var(--color-text-muted)]">لا بيانات</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
