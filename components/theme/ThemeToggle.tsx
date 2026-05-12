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
  if (pref === "light") return <Sun className="size-6" aria-hidden />;
  if (pref === "system") return <Monitor className="size-6" aria-hidden />;
  return <Moon className="size-6" aria-hidden />;
}

export function ThemeToggle({ className }: { className?: string }) {
  const themePreference = useThemeStore((s) => s.themePreference);
  const setThemePreference = useThemeStore((s) => s.setThemePreference);

  return (
    <button
      type="button"
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-[var(--ds-radius-md)] text-[color:var(--color-text-secondary)] transition-colors",
        "hover:bg-[color:var(--color-hover-bg)] hover:text-[color:var(--color-text-primary)]",
        "focus-visible:shadow-[var(--shadow-focus-ring)] focus-visible:outline-none",
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
