"use client";

import { useDataTheme } from "@/lib/theme/use-data-theme";

export type ChartPalette = {
  grid: string;
  axis: string;
  bar: string;
  line: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
};

/** Reads chart-related CSS variables after theme is applied. */
export function useChartPalette(): ChartPalette {
  useDataTheme();
  if (typeof document === "undefined") {
    return {
      grid: "#334155",
      axis: "#94a3b8",
      bar: "#818cf8",
      line: "#818cf8",
      tooltipBg: "#1e293b",
      tooltipBorder: "#334155",
      tooltipText: "#e2e8f0",
    };
  }
  const root = document.documentElement;
  const s = getComputedStyle(root);
  const pick = (name: string, fallback: string) =>
    s.getPropertyValue(name).trim() || fallback;
  return {
    grid: pick("--color-chart-grid", "#334155"),
    axis: pick("--color-chart-axis", "#94a3b8"),
    bar: pick("--color-chart-bar", "#6366f1"),
    line: pick("--color-chart-line", "#6366f1"),
    tooltipBg: pick("--color-tooltip-bg", "#1e293b"),
    tooltipBorder: pick("--color-tooltip-border", "#334155"),
    tooltipText: pick("--color-tooltip-text", "#e2e8f0"),
  };
}
