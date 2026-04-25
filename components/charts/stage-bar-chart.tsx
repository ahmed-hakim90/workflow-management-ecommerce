"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartPalette } from "@/lib/theme/chart-colors";

export function StageBarChart({
  data,
}: {
  data: { name: string; count: number }[];
}) {
  const p = useChartPalette();

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={p.grid} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: p.axis }}
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
          <Bar dataKey="count" fill={p.bar} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
