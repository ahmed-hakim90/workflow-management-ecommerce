"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemePreference = "dark" | "light" | "system";

export type ThemeState = {
  themePreference: ThemePreference;
  setThemePreference: (t: ThemePreference) => void;
};

export const THEME_STORAGE_KEY = "hakimo-theme";

export function resolveThemePreference(
  pref: ThemePreference,
  systemDark: boolean,
): "dark" | "light" {
  if (pref === "system") return systemDark ? "dark" : "light";
  return pref;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      themePreference: "light",
      setThemePreference: (themePreference) => set({ themePreference }),
    }),
    {
      name: THEME_STORAGE_KEY,
      skipHydration: true,
    },
  ),
);

/** For controls: cycle dark → light → system. */
export function cycleThemePreference(current: ThemePreference): ThemePreference {
  if (current === "dark") return "light";
  if (current === "light") return "system";
  return "dark";
}
