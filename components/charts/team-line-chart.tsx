"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartPalette } from "@/lib/theme/chart-colors";

export function TeamLineChart({
  data,
}: {
  data: { name: string; performance: number }[];
}) {
  const p = useChartPalette();

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={p.grid} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: p.axis }} stroke={p.axis} />
          <YAxis
            domain={[0, 100]}
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
          <Line
            type="monotone"
            dataKey="performance"
            stroke={p.line}
            strokeWidth={2}
            dot={{ r: 3, fill: p.line }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
