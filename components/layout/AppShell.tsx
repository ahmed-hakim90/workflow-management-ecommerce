"use client";

import { useEffect, useState } from "react";
import { FirebaseSessionSync } from "@/components/auth/firebase-session-sync";
import { UnauthenticatedBanner } from "@/components/auth/unauthenticated-banner";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Container } from "@/components/layout/container";
import { AppDrawer } from "@/components/layout/drawer";
import { NewOrderSubscriber } from "@/components/notifications/new-order-subscriber";
import { NewOrderToasts } from "@/components/notifications/new-order-toasts";
import { PageSkeleton } from "@/components/ui/skeleton";
import { syncSessionFromMe } from "@/lib/auth/client-session";
import { primeOrderNotificationAudio } from "@/lib/ui/order-notification-sound";
import { useSessionStore } from "@/store/zustand/session-store";
import { useUiStore } from "@/store/zustand/ui-store";
import { LocaleProvider, useLocale } from "@/components/i18n/LocaleProvider";
import { DomTranslator } from "@/components/i18n/DomTranslator";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <LocalizedAppShell>{children}</LocalizedAppShell>
    </LocaleProvider>
  );
}

function LocalizedAppShell({ children }: { children: React.ReactNode }) {
  const [sessionReady, setSessionReady] = useState(false);
  const authReady = useSessionStore((s) => s.authReady);
  const idToken = useSessionStore((s) => s.idToken);
  const apiSecret = useSessionStore((s) => s.apiSecret);
  const mobileNavOpen = useUiStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen);

  const ready = sessionReady && authReady;
  const hasCredentials =
    Boolean(idToken?.trim()) || Boolean(apiSecret?.trim());
  const tenantName = useSessionStore((s) => s.tenantName);
  const { locale, dir, t } = useLocale();

  useEffect(() => {
    void Promise.resolve(useUiStore.persist.rehydrate()).catch(() => {});
    void Promise.resolve(useSessionStore.persist.rehydrate())
      .then(() => setSessionReady(true))
      .catch(() => setSessionReady(true));
  }, []);

  useEffect(() => {
    primeOrderNotificationAudio();
  }, []);

  useEffect(() => {
    if (!ready || !hasCredentials || tenantName?.trim()) return;
    void syncSessionFromMe();
  }, [ready, hasCredentials, tenantName]);

  return (
    <div
      lang={locale}
      dir={dir}
      className="flex min-h-[100dvh] min-h-screen bg-[color:var(--color-shell)] text-[color:var(--color-text-primary)]"
    >
      <DomTranslator locale={locale} />
      <FirebaseSessionSync />
      {mobileNavOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-[color:var(--color-overlay)] backdrop-blur-[1px] md:hidden"
          aria-label={t("Close menu")}
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}
      <Sidebar />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col bg-[color:var(--color-app-main)]">
        <Topbar />
        <Container>
          {!ready ? (
            <PageSkeleton />
          ) : !hasCredentials ? (
            <div className="space-y-6">
              <UnauthenticatedBanner />
              <PageSkeleton />
            </div>
          ) : (
            <>
              <NewOrderSubscriber />
              {children}
            </>
          )}
        </Container>
      </div>
      <AppDrawer />
      <NewOrderToasts />
    </div>
  );
}
