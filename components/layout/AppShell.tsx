"use client";

import { useEffect, useState } from "react";
import { FirebaseSessionSync } from "@/components/auth/firebase-session-sync";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Container } from "@/components/layout/container";
import { AppDrawer } from "@/components/layout/drawer";
import { useSessionStore } from "@/store/zustand/session-store";
import { useUiStore } from "@/store/zustand/ui-store";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sessionReady, setSessionReady] = useState(false);
  const mobileNavOpen = useUiStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen);

  useEffect(() => {
    void Promise.resolve(useSessionStore.persist.rehydrate())
      .then(() => setSessionReady(true))
      .catch(() => setSessionReady(true));
  }, []);

  return (
    <div className="flex min-h-[100dvh] min-h-screen bg-[color:var(--color-shell)] text-[color:var(--color-text-primary)]">
      <FirebaseSessionSync />
      {mobileNavOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-[color:var(--color-overlay)] backdrop-blur-[1px] md:hidden"
          aria-label="Close menu"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}
      <Sidebar />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col bg-[color:var(--color-app-main)]">
        <Topbar />
        <Container>
          {sessionReady ? (
            children
          ) : (
            <div
              className="rounded-xl border border-[color:var(--color-divider)] bg-[color:var(--color-elevated)] px-4 py-12 text-center text-sm text-[color:var(--color-text-muted)]"
              aria-busy
              aria-live="polite"
            >
              Loading session…
            </div>
          )}
        </Container>
      </div>
      <AppDrawer />
    </div>
  );
}
