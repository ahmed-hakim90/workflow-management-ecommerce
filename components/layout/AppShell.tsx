"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Container } from "@/components/layout/container";
import { AppDrawer } from "@/components/layout/drawer";
import { useUiStore } from "@/store/zustand/ui-store";

export function AppShell({ children }: { children: React.ReactNode }) {
  const mobileNavOpen = useUiStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen);

  return (
    <div className="flex min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-text-primary)]">
      {mobileNavOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-[color:var(--color-overlay)] backdrop-blur-[1px] md:hidden"
          aria-label="إغلاق القائمة"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}
      <Sidebar />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Topbar />
        <Container>{children}</Container>
      </div>
      <AppDrawer />
    </div>
  );
}
