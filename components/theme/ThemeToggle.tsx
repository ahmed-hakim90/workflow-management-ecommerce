"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import {
  cycleThemePreference,
  useThemeStore,
  type ThemePreference,
} from "@/store/zustand/theme-store";

const labels: Record<ThemePreference, string> = {
  dark: "المظهر: داكن (اضغط للتبديل)",
  light: "المظهر: فاتح (اضغط للتبديل)",
  system: "المظهر: حسب النظام (اضغط للتبديل)",
};

function Icon({ pref }: { pref: ThemePreference }) {
  if (pref === "light") return <Sun className="size-5" aria-hidden />;
  if (pref === "system") return <Monitor className="size-5" aria-hidden />;
  return <Moon className="size-5" aria-hidden />;
}

export function ThemeToggle({ className }: { className?: string }) {
  const themePreference = useThemeStore((s) => s.themePreference);
  const setThemePreference = useThemeStore((s) => s.setThemePreference);

  return (
    <button
      type="button"
      className={cn(
        "flex min-h-11 min-w-11 items-center justify-center rounded-lg p-2 text-[color:var(--color-text-secondary)] transition-colors md:min-h-0 md:min-w-0",
        "hover:bg-[color:var(--color-hover-bg)] hover:text-[color:var(--color-text-primary)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)]/30",
        className,
      )}
      aria-label={labels[themePreference]}
      title={labels[themePreference]}
      onClick={() => setThemePreference(cycleThemePreference(themePreference))}
    >
      <Icon pref={themePreference} />
    </button>
  );
}
