"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import {
  cycleThemePreference,
  useThemeStore,
  type ThemePreference,
} from "@/store/zustand/theme-store";

const labels: Record<ThemePreference, string> = {
  dark: "Theme: dark (click to cycle)",
  light: "Theme: light (click to cycle)",
  system: "Theme: system (click to cycle)",
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
        "flex min-h-11 min-w-11 items-center justify-center rounded-xl p-2 text-[color:var(--color-text-secondary)] shadow-[var(--shadow-neo-raised-sm)] transition-all duration-200 md:min-h-0 md:min-w-0",
        "hover:text-[color:var(--color-text-primary)] hover:shadow-[var(--shadow-neo-raised)] active:shadow-[var(--shadow-neo-pressed-sm)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-bg)]",
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
