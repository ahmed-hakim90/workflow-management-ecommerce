"use client";

import { useLayoutEffect, useState } from "react";
import { resolveThemePreference, useThemeStore } from "@/store/zustand/theme-store";

function applyResolvedTheme(resolved: "dark" | "light") {
  document.documentElement.setAttribute("data-theme", resolved);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const themePreference = useThemeStore((s) => s.themePreference);
  const [storeReady, setStoreReady] = useState(false);

  useLayoutEffect(() => {
    void Promise.resolve(useThemeStore.persist.rehydrate()).then(() =>
      setStoreReady(true),
    );
  }, []);

  useLayoutEffect(() => {
    if (!storeReady) return;
    const systemMq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      applyResolvedTheme(
        resolveThemePreference(themePreference, systemMq.matches),
      );
    };
    apply();
    if (themePreference !== "system") return;
    systemMq.addEventListener("change", apply);
    return () => systemMq.removeEventListener("change", apply);
  }, [storeReady, themePreference]);

  return children;
}
