"use client";

import type { ReactNode } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type OpenDrawerOptions = {
  /** Merged onto the slide-over panel (width, etc.). Default: `md:max-w-md` */
  panelClassName?: string;
  /** Merged onto the scrollable body (e.g. `p-0`). */
  contentClassName?: string;
};

type UiState = {
  drawerOpen: boolean;
  drawerTitle: string;
  drawerRender: (() => ReactNode) | null;
  drawerPanelClassName: string;
  drawerContentClassName: string;
  openDrawer: (
    title: string,
    render: () => ReactNode,
    options?: OpenDrawerOptions,
  ) => void;
  closeDrawer: () => void;
  /** Below md: slide-over navigation */
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  /** md–lg: false = 72px icon rail, true = expanded 240px */
  sidebarTabletExpanded: boolean;
  setSidebarTabletExpanded: (expanded: boolean) => void;
  toggleSidebarTabletExpanded: () => void;
  /** Cmd/Ctrl+K quick navigation */
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
};

export const UI_STORAGE_KEY = "Store-oms-ui";

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      drawerOpen: false,
      drawerTitle: "",
      drawerRender: null,
      drawerPanelClassName: "md:max-w-md",
      drawerContentClassName: "",
      openDrawer: (title, render, options) =>
        set({
          drawerOpen: true,
          drawerTitle: title,
          drawerRender: render,
          drawerPanelClassName: options?.panelClassName ?? "md:max-w-md",
          drawerContentClassName: options?.contentClassName ?? "",
        }),
      closeDrawer: () =>
        set({
          drawerOpen: false,
          drawerTitle: "",
          drawerRender: null,
          drawerPanelClassName: "md:max-w-md",
          drawerContentClassName: "",
        }),
      mobileNavOpen: false,
      setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
      sidebarTabletExpanded: false,
      setSidebarTabletExpanded: (expanded) =>
        set({ sidebarTabletExpanded: expanded }),
      toggleSidebarTabletExpanded: () =>
        set((s) => ({ sidebarTabletExpanded: !s.sidebarTabletExpanded })),
      commandPaletteOpen: false,
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
    }),
    {
      name: UI_STORAGE_KEY,
      partialize: (s) => ({ sidebarTabletExpanded: s.sidebarTabletExpanded }),
    },
  ),
);
