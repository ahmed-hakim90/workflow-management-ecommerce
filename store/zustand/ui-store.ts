"use client";

import type { ReactNode } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

type UiState = {
  drawerOpen: boolean;
  drawerTitle: string;
  drawerRender: (() => ReactNode) | null;
  openDrawer: (title: string, render: () => ReactNode) => void;
  closeDrawer: () => void;
  /** Below md: slide-over navigation */
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  /** md–lg: false = 72px icon rail, true = expanded 240px */
  sidebarTabletExpanded: boolean;
  setSidebarTabletExpanded: (expanded: boolean) => void;
  toggleSidebarTabletExpanded: () => void;
};

export const UI_STORAGE_KEY = "Store-oms-ui";

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      drawerOpen: false,
      drawerTitle: "",
      drawerRender: null,
      openDrawer: (title, render) =>
        set({ drawerOpen: true, drawerTitle: title, drawerRender: render }),
      closeDrawer: () =>
        set({ drawerOpen: false, drawerTitle: "", drawerRender: null }),
      mobileNavOpen: false,
      setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
      sidebarTabletExpanded: false,
      setSidebarTabletExpanded: (expanded) =>
        set({ sidebarTabletExpanded: expanded }),
      toggleSidebarTabletExpanded: () =>
        set((s) => ({ sidebarTabletExpanded: !s.sidebarTabletExpanded })),
    }),
    {
      name: UI_STORAGE_KEY,
      partialize: (s) => ({ sidebarTabletExpanded: s.sidebarTabletExpanded }),
    },
  ),
);
