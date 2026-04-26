"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartPalette } from "@/lib/theme/chart-colors";

export function StageBarChart({
  data,
  countLabel = "Orders",
  valueLabel = "Pipeline value",
  formatValue = (n: number) =>
    n.toLocaleString(undefined, { maximumFractionDigits: 0 }),
}: {
  data: { name: string; count: number; value?: number }[];
  countLabel?: string;
  valueLabel?: string;
  formatValue?: (n: number) => string;
}) {
  const p = useChartPalette();
  const withValue = data.map((row) => ({
    ...row,
    value: row.value ?? 0,
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={withValue}
          margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={p.grid} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: p.axis }}
            stroke={p.axis}
          />
          <YAxis
            yAxisId="left"
            allowDecimals={false}
            width={36}
            tick={{ fontSize: 11, fill: p.axis }}
            stroke={p.axis}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            width={48}
            tick={{ fontSize: 10, fill: p.axis }}
            stroke={p.axis}
            tickFormatter={(v) => formatValue(Number(v))}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: `1px solid ${p.tooltipBorder}`,
              fontSize: 12,
              backgroundColor: p.tooltipBg,
              color: p.tooltipText,
            }}
            formatter={(value, name) =>
              name === valueLabel
                ? [formatValue(Number(value)), name]
                : [value, name]
            }
          />
          <Legend wrapperStyle={{ fontSize: 12, color: p.axis }} />
          <Bar
            yAxisId="left"
            dataKey="count"
            name={countLabel}
            fill={p.bar}
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
          />
          <Bar
            yAxisId="right"
            dataKey="value"
            name={valueLabel}
            fill={p.line}
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
