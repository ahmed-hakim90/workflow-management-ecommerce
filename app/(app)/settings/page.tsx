"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useSessionStore, buildAuthHeaders } from "@/store/zustand/session-store";
import { useProfileStore } from "@/store/zustand/profile-store";
import {
  useThemeStore,
  type ThemePreference,
} from "@/store/zustand/theme-store";
import { defaultKanbanSettings } from "@/lib/kanban/column";
import { cn } from "@/lib/ui/cn";
import { can } from "@/lib/auth/rbac";
import {
  ORDER_STATUSES,
  defaultTenantAutomation,
  type OrderStatus,
  type OutboundWebhookDeliveryLog,
  type WebhookIngestLog,
} from "@/lib/types/models";
import { UsersManagement } from "@/components/users/users-management";
import { InboxTemplatesSettings } from "@/components/inbox/inbox-templates-settings";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { Locale } from "@/lib/i18n/config";

type AdvTabId =
  | "general"
  | "kanban"
  | "shipment"
  | "inbox_templates"
  | "webhooks"
  | "payment"
  | "users"
  | "developer";

const ADV_TAB_DEFS: { id: AdvTabId; label: string }[] = [
  { id: "general", label: "General" },
  { id: "shipment", label: "Shipment rules" },
  { id: "inbox_templates", label: "Inbox templates" },
  { id: "webhooks", label: "Status webhooks" },
  { id: "kanban", label: "Kanban JSON" },
  { id: "payment", label: "Payment" },
  { id: "users", label: "Users" },
  { id: "developer", label: "Developer session" },
];

type OutboundWebhookDraft = {
  id: string;
  name: string;
  enabled: boolean;
  url: string;
  secret: string;
  secretConfigured?: boolean;
  statuses: OrderStatus[];
  includeOrderSnapshot: boolean;
};

type WooWebhookSyncResult = {
  topic: string;
  webhookId?: number;
  deliveryUrl?: string;
  action?: "already_active" | "reactivated";
};

type WooWebhookRecipeState = {
  topic: string;
  name: string;
  label: string;
  status: "active" | "inactive" | "missing";
  webhookId?: number;
  webhookStatus?: "active" | "paused" | "disabled";
  deliveryUrl?: string;
};

type WooWebhookSyncFailure = {
  topic: string;
  message: string;
};

type WooWebhookStatusResponse = {
  deliveryUrl: string;
  hasWebhookSecret: boolean;
  allCount: number;
  matchedCount: number;
  recipes: WooWebhookRecipeState[];
  created?: WooWebhookSyncResult[];
  skipped?: WooWebhookSyncResult[];
  failed?: WooWebhookSyncFailure[];
};

type BostaLocationOption = {
  id: string;
  name: string;
};

const PLATFORM_SETUP_LINKS: {
  label: string;
  href: string;
  hint?: string;
}[] = [
  {
    label: "WooCommerce — Webhooks",
    href: "https://woocommerce.com/document/webhooks/",
    hint: "في المتجر: الإعدادات → متقدم → Webhooks",
  },
  {
    label: "WooCommerce — REST API keys",
    href: "https://woocommerce.com/document/woocommerce-rest-api/",
    hint: "الإعدادات → متقدم → REST API",
  },
  {
    label: "Meta — WhatsApp Cloud API",
    href: "https://developers.facebook.com/docs/whatsapp/cloud-api/get-started",
  },
  {
    label: "Meta — تطبيقات المطوّر",
    href: "https://developers.facebook.com/apps/",
    hint: "Webhook + Access token",
  },
  {
    label: "Meta — مدير واتساب للأعمال",
    href: "https://business.facebook.com/latest/whatsapp_manager/",
  },
  {
    label: "Bosta — لوحة الأعمال / مفتاح API",
    href: "https://business.bosta.co/",
  },
  {
    label: "Bosta — توثيق الـ API",
    href: "https://docs.bosta.co/",
  },
  {
    label: "n8n — Webhooks",
    href: "https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/",
  },
  {
    label: "n8n Cloud",
    href: "https://app.n8n.cloud/",
    hint: "لو تستخدم استضافة n8n",
  },
];

function PlatformSetupLinkRow({
  label,
  href,
  hint,
}: {
  label: string;
  href: string;
  hint?: string;
}) {
  return (
    <li className="text-sm">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 font-medium text-[color:var(--color-primary)] hover:underline"
      >
        {label}
        <ExternalLink className="size-3.5 shrink-0 opacity-80" aria-hidden />
        <span className="sr-only">(يفتح في نافذة جديدة)</span>
      </a>
      {hint ? (
        <p className="mt-0.5 text-xs text-[color:var(--color-text-muted)]">{hint}</p>
      ) : null}
    </li>
  );
}

type SectionId =
  | "profile"
  | "team"
  | "api"
  | "notifications"
  | "billing"
  | "advanced";

const navItems: { id: SectionId; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "team", label: "Team" },
  { id: "api", label: "API keys" },
  { id: "notifications", label: "Notifications" },
  { id: "billing", label: "Billing" },
  { id: "advanced", label: "Workspace" },
];

export default function SettingsPage() {
  const apiSecret = useSessionStore((s) => s.apiSecret);
  const idToken = useSessionStore((s) => s.idToken);
  const tenantId = useSessionStore((s) => s.tenantId);
  const userId = useSessionStore((s) => s.userId);
  const role = useSessionStore((s) => s.role);
  const permissions = useSessionStore((s) => s.permissions);
  const authReady = useSessionStore((s) => s.authReady);
  const setSession = useSessionStore((s) => s.setSession);
  const themePreference = useThemeStore((s) => s.themePreference);
  const setThemePreference = useThemeStore((s) => s.setThemePreference);
  const { setLocale, t } = useLocale();

  const permissionSubject = useMemo(
    () => ({ role, permissions }),
    [role, permissions],
  );

  const advTabs = useMemo(
    () =>
      ADV_TAB_DEFS.filter((tab) => {
        if (tab.id === "users" && !can(permissionSubject, "user:read"))
          return false;
        if (
          tab.id === "inbox_templates" &&
          !can(permissionSubject, "inbox:manage")
        )
          return false;
        return true;
      }),
    [permissionSubject],
  );

  const [section, setSection] = useState<SectionId>("profile");
  const [advTab, setAdvTab] = useState<AdvTabId>("general");
  const firstName = useProfileStore((s) => s.firstName);
  const lastName = useProfileStore((s) => s.lastName);
  const bio = useProfileStore((s) => s.bio);
  const timezone = useProfileStore((s) => s.timezone);
  const language = useProfileStore((s) => s.language);
  const setProfile = useProfileStore((s) => s.setProfile);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileErr, setProfileErr] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [orderAlerts, setOrderAlerts] = useState(true);
  const [inventoryAlerts, setInventoryAlerts] = useState(true);
  const [ticketEscalation, setTicketEscalation] = useState(false);

  const [autoShip, setAutoShip] = useState(false);
  const [shipStage, setShipStage] = useState<"confirmed" | "invoiced">(
    "confirmed",
  );
  const [whSingleScan, setWhSingleScan] = useState(false);
  const [whCooldownSec, setWhCooldownSec] = useState(3.5);
  const [whTemplate, setWhTemplate] = useState("");
  const [orderLinkTemplateDraft, setOrderLinkTemplateDraft] = useState("");
  const [whatsappAutomationEnabled, setWhatsappAutomationEnabled] =
    useState(false);
  const [inlineReplyClassifier, setInlineReplyClassifier] = useState(false);
  const [n8nWebhookUrlDraft, setN8nWebhookUrlDraft] = useState("");
  const [n8nWebhookSecretDraft, setN8nWebhookSecretDraft] = useState("");
  const [n8nSecretConfigured, setN8nSecretConfigured] = useState(false);
  const [orderConfirmationTemplateNameDraft, setOrderConfirmationTemplateNameDraft] =
    useState("");
  const [orderConfirmationTemplateLangDraft, setOrderConfirmationTemplateLangDraft] =
    useState("");
  const [outboundWebhookDrafts, setOutboundWebhookDrafts] = useState<
    OutboundWebhookDraft[]
  >([]);
  const [outboundWebhookLogs, setOutboundWebhookLogs] = useState<
    OutboundWebhookDeliveryLog[]
  >([]);
  const [outboundWebhookErr, setOutboundWebhookErr] = useState<string | null>(
    null,
  );
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);
  const [settingsErr, setSettingsErr] = useState<string | null>(null);
  const [mockDataOn, setMockDataOn] = useState(false);
  const [kanbanJson, setKanbanJson] = useState("");
  const [kanbanErr, setKanbanErr] = useState<string | null>(null);

  const [appOrigin, setAppOrigin] = useState("");
  const [wooSecretConfigured, setWooSecretConfigured] = useState(false);
  const [wooSecretDraft, setWooSecretDraft] = useState("");
  const [wooServerBase, setWooServerBase] = useState<string | null>(null);
  const [wooMsg, setWooMsg] = useState<string | null>(null);
  const [wooErr, setWooErr] = useState<string | null>(null);
  const [wooDiagnostic, setWooDiagnostic] = useState<{
    hasPerTenantWooSecret: boolean;
    hasServerEnvWooSecret: boolean;
    effectiveSecretReady: boolean;
    hasSupabaseConfigured: boolean;
    hasCustomAppUrl: boolean;
    hasVercelUrl: boolean;
    warnings: string[];
  } | null>(null);
  const [wooIngestLogs, setWooIngestLogs] = useState<WebhookIngestLog[]>([]);
  const [wooIngestLoadErr, setWooIngestLoadErr] = useState<string | null>(null);
  const [wooCopied, setWooCopied] = useState(false);
  const [wooWebhookCanonical, setWooWebhookCanonical] = useState<string | null>(
    null,
  );
  const [storefrontOrderWebhookCanonical, setStorefrontOrderWebhookCanonical] =
    useState<string | null>(null);
  const [storefrontOrderSecretConfigured, setStorefrontOrderSecretConfigured] =
    useState(false);
  const [storefrontOrderSecretDraft, setStorefrontOrderSecretDraft] =
    useState("");
  const [storefrontOrderHeaderDraft, setStorefrontOrderHeaderDraft] =
    useState("x-api-secret");
  const [storefrontOrderCopied, setStorefrontOrderCopied] = useState(false);
  const [storefrontOrderMsg, setStorefrontOrderMsg] = useState<string | null>(
    null,
  );
  const [storefrontOrderErr, setStorefrontOrderErr] = useState<string | null>(
    null,
  );
  const [staffApiKeyConfigured, setStaffApiKeyConfigured] = useState(false);
  const [staffApiKeyLast4, setStaffApiKeyLast4] = useState<string | null>(null);

  const [bostaKeyConfigured, setBostaKeyConfigured] = useState(false);
  const [bostaKeyDraft, setBostaKeyDraft] = useState("");
  const [bostaBaseDraft, setBostaBaseDraft] = useState("");
  const [bostaMsg, setBostaMsg] = useState<string | null>(null);
  const [bostaErr, setBostaErr] = useState<string | null>(null);
  const [bostaCities, setBostaCities] = useState<BostaLocationOption[]>([]);
  const [bostaZones, setBostaZones] = useState<BostaLocationOption[]>([]);
  const [bostaCitiesLoading, setBostaCitiesLoading] = useState(false);
  const [bostaZonesLoading, setBostaZonesLoading] = useState(false);

  const [wooRestConfigured, setWooRestConfigured] = useState(false);
  const [wooStoreDraft, setWooStoreDraft] = useState("");
  const [wooCkDraft, setWooCkDraft] = useState("");
  const [wooCsDraft, setWooCsDraft] = useState("");
  const [wooCkLast4, setWooCkLast4] = useState<string | null>(null);
  const [wooCsLast4, setWooCsLast4] = useState<string | null>(null);
  const [wooWebhookSyncing, setWooWebhookSyncing] = useState(false);
  const [wooWebhookRefreshing, setWooWebhookRefreshing] = useState(false);
  const [wooWebhookStatus, setWooWebhookStatus] =
    useState<WooWebhookStatusResponse | null>(null);
  const [wooWebhookTesting, setWooWebhookTesting] = useState(false);
  const [wooWebhookFiring, setWooWebhookFiring] = useState(false);
  const [wooWebhookTestMsg, setWooWebhookTestMsg] = useState<string | null>(null);
  const [wooWebhookFireMsg, setWooWebhookFireMsg] = useState<string | null>(null);

  const [bostaCityDraft, setBostaCityDraft] = useState("");
  const [bostaZoneDraft, setBostaZoneDraft] = useState("");
  const [bostaBuildingDraft, setBostaBuildingDraft] = useState("");
  const [bostaAddressLineDraft, setBostaAddressLineDraft] = useState("");
  const [bostaPackageDescDraft, setBostaPackageDescDraft] = useState("");
  const [jntConfigured, setJntConfigured] = useState(false);
  const [jntMsg, setJntMsg] = useState<string | null>(null);
  const [jntErr, setJntErr] = useState<string | null>(null);
  const [jntApiAccountDraft, setJntApiAccountDraft] = useState("");
  const [jntCustomerCodeDraft, setJntCustomerCodeDraft] = useState("");
  const [jntPasswordDraft, setJntPasswordDraft] = useState("");
  const [jntDigestDraft, setJntDigestDraft] = useState("");
  const [jntBaseDraft, setJntBaseDraft] = useState("");
  const [jntEnvironmentDraft, setJntEnvironmentDraft] = useState<"test" | "prod">("prod");
  const [jntSenderNameDraft, setJntSenderNameDraft] = useState("");
  const [jntSenderPhoneDraft, setJntSenderPhoneDraft] = useState("");
  const [jntSenderCityDraft, setJntSenderCityDraft] = useState("");
  const [jntSenderAreaDraft, setJntSenderAreaDraft] = useState("");
  const [jntSenderAddressDraft, setJntSenderAddressDraft] = useState("");
  const [jntServiceDraft, setJntServiceDraft] = useState("");
  const [jntWeightDraft, setJntWeightDraft] = useState("");
  const [fedexConfigured, setFedexConfigured] = useState(false);
  const [fedexMsg, setFedexMsg] = useState<string | null>(null);
  const [fedexErr, setFedexErr] = useState<string | null>(null);
  const [fedexClientIdDraft, setFedexClientIdDraft] = useState("");
  const [fedexClientSecretDraft, setFedexClientSecretDraft] = useState("");
  const [fedexAccountDraft, setFedexAccountDraft] = useState("");
  const [fedexBaseDraft, setFedexBaseDraft] = useState("");
  const [fedexEnvironmentDraft, setFedexEnvironmentDraft] = useState<"test" | "prod">("prod");
  const [fedexShipperNameDraft, setFedexShipperNameDraft] = useState("");
  const [fedexShipperPhoneDraft, setFedexShipperPhoneDraft] = useState("");
  const [fedexStreetDraft, setFedexStreetDraft] = useState("");
  const [fedexCityDraft, setFedexCityDraft] = useState("");
  const [fedexPostalDraft, setFedexPostalDraft] = useState("");
  const [fedexCountryDraft, setFedexCountryDraft] = useState("EG");
  const [fedexServiceDraft, setFedexServiceDraft] = useState("");
  const [fedexPackagingDraft, setFedexPackagingDraft] = useState("");
  const [fedexWeightDraft, setFedexWeightDraft] = useState("");

  const [waWebhookCanonical, setWaWebhookCanonical] = useState<string | null>(
    null,
  );
  const [waCopied, setWaCopied] = useState(false);
  const [waVerifyDraft, setWaVerifyDraft] = useState("");
  const [waAccessDraft, setWaAccessDraft] = useState("");
  const [waAppSecretDraft, setWaAppSecretDraft] = useState("");
  const [waPhoneIdDraft, setWaPhoneIdDraft] = useState("");
  const [waBizDraft, setWaBizDraft] = useState("");
  const [waVerifyConfigured, setWaVerifyConfigured] = useState(false);
  const [waAccessLast4, setWaAccessLast4] = useState<string | null>(null);
  const [waAppSecretLast4, setWaAppSecretLast4] = useState<string | null>(null);
  const [waSigDiag, setWaSigDiag] = useState<{
    hasGlobalAppSecret: boolean;
    hasTenantAppSecret: boolean;
    signatureReady: boolean;
  } | null>(null);
  const [waMsg, setWaMsg] = useState<string | null>(null);
  const [waErr, setWaErr] = useState<string | null>(null);
  const [waSaving, setWaSaving] = useState(false);

  const wooWebhookUrl = useMemo(() => {
    const base = (appOrigin || "").replace(/\/$/, "");
    if (!base) return "";
    return `${base}/api/webhooks/woocommerce?tenant=${encodeURIComponent(tenantId)}`;
  }, [appOrigin, tenantId]);

  const wooDisplayUrl = useMemo(
    () => wooWebhookCanonical?.trim() || wooWebhookUrl,
    [wooWebhookCanonical, wooWebhookUrl],
  );

  const storefrontOrderWebhookUrl = useMemo(() => {
    const base = (appOrigin || "").replace(/\/$/, "");
    if (!base) return "";
    return `${base}/api/webhooks/storefront-orders?tenant=${encodeURIComponent(tenantId)}`;
  }, [appOrigin, tenantId]);

  const storefrontOrderDisplayUrl = useMemo(
    () =>
      storefrontOrderWebhookCanonical?.trim() || storefrontOrderWebhookUrl,
    [storefrontOrderWebhookCanonical, storefrontOrderWebhookUrl],
  );

  const waDisplayUrl = useMemo(
    () =>
      waWebhookCanonical?.trim() ||
      `${(appOrigin || "").replace(/\/$/, "")}/api/webhooks/whatsapp?tenant=${encodeURIComponent(tenantId)}`,
    [waWebhookCanonical, appOrigin, tenantId],
  );

  const refreshWooWebhookStatus = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) {
        setWooMsg(null);
        setWooErr(null);
        setWooWebhookRefreshing(true);
      }
      try {
        const res = await fetch("/api/settings/woocommerce/webhooks/sync", {
          headers: buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
        });
        const json = (await res.json()) as {
          data?: WooWebhookStatusResponse;
          error?: string;
        };
        if (!res.ok) throw new Error(json.error ?? res.statusText);
        const data = json.data ?? null;
        setWooWebhookStatus(data);
        if (data?.deliveryUrl?.trim()) {
          setWooWebhookCanonical(data.deliveryUrl.trim());
        }
        if (data) {
          setWooSecretConfigured(data.hasWebhookSecret);
        }
        if (!options?.silent) {
          setWooMsg("WooCommerce webhook status refreshed.");
        }
      } catch (e) {
        if (!options?.silent) {
          setWooErr(e instanceof Error ? e.message : "Webhook status refresh failed");
        }
      } finally {
        if (!options?.silent) {
          setWooWebhookRefreshing(false);
        }
      }
    },
    [apiSecret, idToken, tenantId, userId, role],
  );

  const saveProfile = useCallback(async () => {
    setProfileMsg(null);
    setProfileErr(null);
    setProfileSaving(true);
    const p = useProfileStore.getState();
    const nameLine = [p.firstName.trim(), p.lastName.trim()]
      .filter(Boolean)
      .join(" ");
    if (nameLine) {
      setSession({ displayName: nameLine });
    }
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
        body: JSON.stringify({
          firstName: p.firstName,
          lastName: p.lastName,
          language: p.language,
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        data?: { name?: string; language?: Locale };
      };
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      if (json.data?.name) {
        setSession({ displayName: json.data.name });
      }
      const savedLanguage = json.data?.language ?? p.language;
      setProfile({ language: savedLanguage });
      setLocale(savedLanguage);
      setProfileMsg(t("Profile saved."));
    } catch (e) {
      setProfileErr(
        e instanceof Error ? e.message : t("Could not save profile. Try again."),
      );
    } finally {
      setProfileSaving(false);
    }
  }, [apiSecret, idToken, tenantId, userId, role, setSession, setProfile, setLocale, t]);

  useEffect(() => {
    setAppOrigin(
      typeof window !== "undefined" ? window.location.origin : "",
    );
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (section !== "api") return;
    let cancelled = false;
    (async () => {
      setWooErr(null);
      setBostaErr(null);
      setJntErr(null);
      setFedexErr(null);
      setWaErr(null);
      setStorefrontOrderErr(null);
      setWooIngestLoadErr(null);
      setWooDiagnostic(null);
      setWooIngestLogs([]);
      try {
        const res = await fetch("/api/settings/integrations", {
          headers: buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? res.statusText);
        const d = json.data as {
          serverPublicBaseUrl?: string;
          woocommerceWebhookUrl?: string;
          whatsappWebhookUrl?: string;
          storefrontOrderWebhookUrl?: string;
          storefrontOrderWebhookSecretConfigured?: boolean;
          storefrontOrderSecretHeaderName?: string;
          woocommerceWebhookSecretConfigured?: boolean;
          woocommerceRestConfigured?: boolean;
          woocommerceStoreUrl?: string | null;
          woocommerceConsumerKeyLast4?: string | null;
          woocommerceConsumerSecretLast4?: string | null;
          staffApiKeyConfigured?: boolean;
          staffApiKeyLast4?: string | null;
          bostaApiKeyConfigured?: boolean;
          bostaBaseUrl?: string | null;
          bostaDefaultCityId?: string | null;
          bostaDefaultZoneId?: string | null;
          bostaDefaultBuildingNumber?: string | null;
          bostaDefaultAddressLine?: string | null;
          bostaPackageDescription?: string | null;
          jntApiAccountConfigured?: boolean;
          jntCustomerCodeConfigured?: boolean;
          jntPasswordConfigured?: boolean;
          jntDigestSecretConfigured?: boolean;
          jntBaseUrl?: string | null;
          jntEnvironment?: "test" | "prod";
          jntSenderName?: string | null;
          jntSenderPhone?: string | null;
          jntSenderCity?: string | null;
          jntSenderArea?: string | null;
          jntSenderAddress?: string | null;
          jntDefaultServiceCode?: string | null;
          jntDefaultWeightKg?: string | null;
          fedexClientIdConfigured?: boolean;
          fedexClientSecretConfigured?: boolean;
          fedexAccountNumber?: string | null;
          fedexBaseUrl?: string | null;
          fedexEnvironment?: "test" | "prod";
          fedexShipperName?: string | null;
          fedexShipperPhone?: string | null;
          fedexShipperStreet?: string | null;
          fedexShipperCity?: string | null;
          fedexShipperPostalCode?: string | null;
          fedexShipperCountryCode?: string | null;
          fedexDefaultServiceType?: string | null;
          fedexDefaultPackagingType?: string | null;
          fedexDefaultWeightKg?: string | null;
          whatsappVerifyTokenConfigured?: boolean;
          whatsappPhoneNumberId?: string | null;
          whatsappBusinessAccountId?: string | null;
          whatsappAccessTokenLast4?: string | null;
          whatsappAppSecretLast4?: string | null;
          whatsappSignatureDiagnostics?: {
            hasGlobalAppSecret: boolean;
            hasTenantAppSecret: boolean;
            signatureReady: boolean;
          };
          webhookDiagnostics?: {
            hasPerTenantWooSecret: boolean;
            hasServerEnvWooSecret: boolean;
            effectiveSecretReady: boolean;
            hasSupabaseConfigured: boolean;
            hasCustomAppUrl: boolean;
            hasVercelUrl: boolean;
            warnings: string[];
          };
        };
        if (!cancelled) {
          setWooDiagnostic(d.webhookDiagnostics ?? null);
          try {
            const ir = await fetch("/api/settings/webhook-ingest-logs?limit=50", {
              headers: buildAuthHeaders({
                apiSecret,
                idToken,
                tenantId,
                userId,
                role,
              }),
            });
            const ij = (await ir.json()) as { data?: WebhookIngestLog[]; error?: string };
            if (!ir.ok) {
              if (!cancelled) setWooIngestLoadErr(ij.error ?? "Could not load webhook log");
            } else if (!cancelled) {
              setWooIngestLogs(ij.data ?? []);
            }
          } catch (ie) {
            if (!cancelled)
              setWooIngestLoadErr(
                ie instanceof Error ? ie.message : "Could not load webhook log",
              );
          }
          setWooWebhookCanonical(d.woocommerceWebhookUrl?.trim() || null);
          setWaWebhookCanonical(d.whatsappWebhookUrl?.trim() || null);
          setWaVerifyConfigured(!!d.whatsappVerifyTokenConfigured);
          setWaPhoneIdDraft(d.whatsappPhoneNumberId?.trim() ?? "");
          setWaBizDraft(d.whatsappBusinessAccountId?.trim() ?? "");
          setWaAccessLast4(d.whatsappAccessTokenLast4 ?? null);
          setWaAppSecretLast4(d.whatsappAppSecretLast4 ?? null);
          setWaSigDiag(d.whatsappSignatureDiagnostics ?? null);
          setWaVerifyDraft("");
          setWaAccessDraft("");
          setWaAppSecretDraft("");
          setStorefrontOrderWebhookCanonical(
            d.storefrontOrderWebhookUrl?.trim() || null,
          );
          setStorefrontOrderSecretConfigured(
            !!d.storefrontOrderWebhookSecretConfigured,
          );
          setStorefrontOrderHeaderDraft(
            d.storefrontOrderSecretHeaderName?.trim() || "x-api-secret",
          );
          setWooSecretConfigured(!!d.woocommerceWebhookSecretConfigured);
          setWooServerBase(d.serverPublicBaseUrl?.trim() || null);
          setStaffApiKeyConfigured(!!d.staffApiKeyConfigured);
          setStaffApiKeyLast4(d.staffApiKeyLast4 ?? null);
          setBostaKeyConfigured(!!d.bostaApiKeyConfigured);
          setBostaBaseDraft(d.bostaBaseUrl?.trim() ?? "");
          setWooRestConfigured(!!d.woocommerceRestConfigured);
          setWooStoreDraft(d.woocommerceStoreUrl?.trim() ?? "");
          setWooCkDraft("");
          setWooCsDraft("");
          setWooCkLast4(d.woocommerceConsumerKeyLast4 ?? null);
          setWooCsLast4(d.woocommerceConsumerSecretLast4 ?? null);
          setBostaCityDraft(d.bostaDefaultCityId?.trim() ?? "");
          setBostaZoneDraft(d.bostaDefaultZoneId?.trim() ?? "");
          setBostaBuildingDraft(d.bostaDefaultBuildingNumber?.trim() ?? "");
          setBostaAddressLineDraft(d.bostaDefaultAddressLine?.trim() ?? "");
          setBostaPackageDescDraft(d.bostaPackageDescription?.trim() ?? "");
          setJntConfigured(
            !!(
              d.jntApiAccountConfigured &&
              d.jntCustomerCodeConfigured &&
              d.jntPasswordConfigured &&
              d.jntDigestSecretConfigured
            ),
          );
          setJntApiAccountDraft("");
          setJntCustomerCodeDraft("");
          setJntPasswordDraft("");
          setJntDigestDraft("");
          setJntBaseDraft(d.jntBaseUrl?.trim() ?? "");
          setJntEnvironmentDraft(d.jntEnvironment ?? "prod");
          setJntSenderNameDraft(d.jntSenderName?.trim() ?? "");
          setJntSenderPhoneDraft(d.jntSenderPhone?.trim() ?? "");
          setJntSenderCityDraft(d.jntSenderCity?.trim() ?? "");
          setJntSenderAreaDraft(d.jntSenderArea?.trim() ?? "");
          setJntSenderAddressDraft(d.jntSenderAddress?.trim() ?? "");
          setJntServiceDraft(d.jntDefaultServiceCode?.trim() ?? "");
          setJntWeightDraft(d.jntDefaultWeightKg?.trim() ?? "");
          setFedexConfigured(
            !!(
              d.fedexClientIdConfigured &&
              d.fedexClientSecretConfigured &&
              d.fedexAccountNumber?.trim()
            ),
          );
          setFedexClientIdDraft("");
          setFedexClientSecretDraft("");
          setFedexAccountDraft(d.fedexAccountNumber?.trim() ?? "");
          setFedexBaseDraft(d.fedexBaseUrl?.trim() ?? "");
          setFedexEnvironmentDraft(d.fedexEnvironment ?? "prod");
          setFedexShipperNameDraft(d.fedexShipperName?.trim() ?? "");
          setFedexShipperPhoneDraft(d.fedexShipperPhone?.trim() ?? "");
          setFedexStreetDraft(d.fedexShipperStreet?.trim() ?? "");
          setFedexCityDraft(d.fedexShipperCity?.trim() ?? "");
          setFedexPostalDraft(d.fedexShipperPostalCode?.trim() ?? "");
          setFedexCountryDraft(d.fedexShipperCountryCode?.trim() ?? "EG");
          setFedexServiceDraft(d.fedexDefaultServiceType?.trim() ?? "");
          setFedexPackagingDraft(d.fedexDefaultPackagingType?.trim() ?? "");
          setFedexWeightDraft(d.fedexDefaultWeightKg?.trim() ?? "");
        }
      } catch (e) {
        if (!cancelled)
          setWooErr(e instanceof Error ? e.message : "Could not load integrations");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authReady, section, apiSecret, idToken, tenantId, userId, role]);

  useEffect(() => {
    if (!authReady || section !== "api") return;
    if (!wooRestConfigured) {
      setWooWebhookStatus(null);
      return;
    }
    void refreshWooWebhookStatus({ silent: true });
  }, [authReady, section, wooRestConfigured, refreshWooWebhookStatus]);

  async function saveWooSecret() {
    setWooMsg(null);
    setWooErr(null);
    const next = wooSecretDraft.trim();
    if (!next) {
      setWooErr("Paste the Secret from WooCommerce (or use Remove secret below).");
      return;
    }
    try {
      const res = await fetch("/api/settings/integrations", {
        method: "PATCH",
        headers: {
          ...buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ woocommerce_webhook_secret: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      const d = json.data as { woocommerceWebhookSecretConfigured?: boolean };
      setWooSecretConfigured(!!d.woocommerceWebhookSecretConfigured);
      setWooSecretDraft("");
      setWooMsg("Webhook secret saved for this company.");
    } catch (e) {
      setWooErr(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function clearWooSecret() {
    setWooMsg(null);
    setWooErr(null);
    try {
      const res = await fetch("/api/settings/integrations", {
        method: "PATCH",
        headers: {
          ...buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ woocommerce_webhook_secret: null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      const d = json.data as { woocommerceWebhookSecretConfigured?: boolean };
      setWooSecretConfigured(!!d.woocommerceWebhookSecretConfigured);
      setWooSecretDraft("");
      setWooMsg("Stored webhook secret removed.");
    } catch (e) {
      setWooErr(e instanceof Error ? e.message : "Remove failed");
    }
  }

  async function saveWooRestStoreUrl() {
    setWooMsg(null);
    setWooErr(null);
    const u = wooStoreDraft.trim();
    if (!u) {
      setWooErr("Enter your WooCommerce store URL (e.g. https://shop.example.com).");
      return;
    }
    try {
      const res = await fetch("/api/settings/integrations", {
        method: "PATCH",
        headers: {
          ...buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ woocommerce_store_url: u }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      const d = json.data as { woocommerceStoreUrl?: string | null };
      setWooStoreDraft(d.woocommerceStoreUrl?.trim() ?? "");
      setWooMsg("WooCommerce store URL saved.");
    } catch (e) {
      setWooErr(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function saveWooRestKeys() {
    setWooMsg(null);
    setWooErr(null);
    const storeUrl = wooStoreDraft.trim();
    const ck = wooCkDraft.trim();
    const cs = wooCsDraft.trim();
    if (!storeUrl) {
      setWooErr("Enter your WooCommerce store URL before saving REST keys.");
      return;
    }
    if (!ck || !cs) {
      setWooErr("Paste both Consumer key and Consumer secret from WooCommerce.");
      return;
    }
    try {
      const res = await fetch("/api/settings/integrations", {
        method: "PATCH",
        headers: {
          ...buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          woocommerce_store_url: storeUrl,
          woocommerce_consumer_key: ck,
          woocommerce_consumer_secret: cs,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      const d = json.data as {
        woocommerceRestConfigured?: boolean;
        woocommerceStoreUrl?: string | null;
        woocommerceConsumerKeyLast4?: string | null;
        woocommerceConsumerSecretLast4?: string | null;
      };
      setWooRestConfigured(!!d.woocommerceRestConfigured);
      setWooStoreDraft(d.woocommerceStoreUrl?.trim() ?? storeUrl);
      setWooCkDraft("");
      setWooCsDraft("");
      setWooCkLast4(d.woocommerceConsumerKeyLast4 ?? null);
      setWooCsLast4(d.woocommerceConsumerSecretLast4 ?? null);
      setWooMsg("WooCommerce REST API settings saved. OMS will push order status to Woo.");
    } catch (e) {
      setWooErr(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function clearWooRestKeys() {
    setWooMsg(null);
    setWooErr(null);
    try {
      const res = await fetch("/api/settings/integrations", {
        method: "PATCH",
        headers: {
          ...buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          woocommerce_consumer_key: null,
          woocommerce_consumer_secret: null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      const d = json.data as {
        woocommerceRestConfigured?: boolean;
        woocommerceConsumerKeyLast4?: string | null;
        woocommerceConsumerSecretLast4?: string | null;
      };
      setWooRestConfigured(!!d.woocommerceRestConfigured);
      setWooCkLast4(d.woocommerceConsumerKeyLast4 ?? null);
      setWooCsLast4(d.woocommerceConsumerSecretLast4 ?? null);
      setWooMsg("WooCommerce REST keys removed.");
    } catch (e) {
      setWooErr(e instanceof Error ? e.message : "Remove failed");
    }
  }

  async function refreshWooIngestLogs() {
    const res = await fetch("/api/settings/webhook-ingest-logs?limit=50", {
      headers: buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
    });
    const json = (await res.json()) as {
      data?: WebhookIngestLog[];
      error?: string;
    };
    if (!res.ok) throw new Error(json.error ?? "Could not load webhook log");
    setWooIngestLogs(json.data ?? []);
    setWooIngestLoadErr(null);
  }

  async function syncWooWebhooks() {
    setWooMsg(null);
    setWooErr(null);
    setWooWebhookSyncing(true);
    try {
      const res = await fetch("/api/settings/woocommerce/webhooks/sync", {
        method: "POST",
        headers: buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
      });
      const json = (await res.json()) as {
        data?: WooWebhookStatusResponse;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      const data = json.data ?? null;
      setWooWebhookStatus(data);
      if (data?.deliveryUrl?.trim()) {
        setWooWebhookCanonical(data.deliveryUrl.trim());
      }
      if (data) {
        setWooSecretConfigured(data.hasWebhookSecret);
      }
      const createdCount = data?.created?.length ?? 0;
      const reactivatedCount =
        data?.skipped?.filter((r) => r.action === "reactivated").length ?? 0;
      const failedCount = data?.failed?.length ?? 0;
      setWooMsg(
        failedCount
          ? `WooCommerce webhook sync finished with ${failedCount} failed topic(s).`
          : reactivatedCount
            ? `WooCommerce webhook sync reactivated ${reactivatedCount} webhook(s).`
          : createdCount
            ? `WooCommerce webhook sync created ${createdCount} webhook(s).`
            : "WooCommerce webhooks are already in sync.",
      );
    } catch (e) {
      setWooErr(e instanceof Error ? e.message : "Webhook sync failed");
    } finally {
      setWooWebhookSyncing(false);
    }
  }

  async function sendWooDiagnosticWebhook() {
    setWooErr(null);
    setWooWebhookTestMsg(null);
    setWooWebhookFireMsg(null);
    setWooWebhookTesting(true);
    try {
      const res = await fetch("/api/settings/woocommerce/webhooks/test", {
        method: "POST",
        headers: buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
      });
      const json = (await res.json()) as {
        data?: { deliveryId?: string; status?: number };
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setWooWebhookTestMsg(
        `Diagnostic webhook accepted (${json.data?.status ?? 200}); delivery ${
          json.data?.deliveryId ?? "logged"
        }.`,
      );
      await refreshWooIngestLogs();
    } catch (e) {
      setWooErr(e instanceof Error ? e.message : "Diagnostic webhook failed");
    } finally {
      setWooWebhookTesting(false);
    }
  }

  async function fireTestOrderWebhook() {
    setWooErr(null);
    setWooWebhookTestMsg(null);
    setWooWebhookFireMsg(null);
    setWooWebhookFiring(true);
    try {
      const res = await fetch("/api/settings/woocommerce/webhooks/fire", {
        method: "POST",
        headers: buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
      });
      const json = (await res.json()) as {
        data?: { deliveryId?: string; orderId?: string; status?: number };
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setWooWebhookFireMsg(
        json.data?.orderId
          ? `Test order created: ${json.data.orderId}.`
          : `Test order webhook accepted (${json.data?.status ?? 200}); delivery ${
              json.data?.deliveryId ?? "logged"
            }.`,
      );
      await refreshWooIngestLogs();
    } catch (e) {
      setWooErr(e instanceof Error ? e.message : "Test order webhook failed");
    } finally {
      setWooWebhookFiring(false);
    }
  }

  async function loadBostaCities() {
    setBostaErr(null);
    setBostaCitiesLoading(true);
    try {
      const res = await fetch("/api/settings/bosta/cities", {
        headers: buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
      });
      const json = (await res.json()) as {
        data?: BostaLocationOption[];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Could not load Bosta cities");
      setBostaCities(json.data ?? []);
      setBostaMsg("Bosta cities loaded. Choose the warehouse city.");
    } catch (e) {
      setBostaErr(e instanceof Error ? e.message : "Could not load Bosta cities");
    } finally {
      setBostaCitiesLoading(false);
    }
  }

  async function loadBostaZones(cityId = bostaCityDraft) {
    const id = cityId.trim();
    setBostaErr(null);
    if (!id) {
      setBostaZones([]);
      return;
    }
    setBostaZonesLoading(true);
    try {
      const res = await fetch(
        `/api/settings/bosta/zones?cityId=${encodeURIComponent(id)}`,
        {
          headers: buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
        },
      );
      const json = (await res.json()) as {
        data?: BostaLocationOption[];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Could not load Bosta zones");
      setBostaZones(json.data ?? []);
      setBostaMsg("Bosta zones loaded. Choose the warehouse zone if available.");
    } catch (e) {
      setBostaErr(e instanceof Error ? e.message : "Could not load Bosta zones");
    } finally {
      setBostaZonesLoading(false);
    }
  }

  async function saveBostaAddressFields() {
    setBostaMsg(null);
    setBostaErr(null);
    try {
      const res = await fetch("/api/settings/integrations", {
        method: "PATCH",
        headers: {
          ...buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bosta_default_city_id: bostaCityDraft.trim() || null,
          bosta_default_zone_id: bostaZoneDraft.trim() || null,
          bosta_default_building_number: bostaBuildingDraft.trim() || null,
          bosta_default_address_line: bostaAddressLineDraft.trim() || null,
          bosta_package_description: bostaPackageDescDraft.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      const d = json.data as {
        bostaDefaultCityId?: string | null;
        bostaDefaultZoneId?: string | null;
        bostaDefaultBuildingNumber?: string | null;
        bostaDefaultAddressLine?: string | null;
        bostaPackageDescription?: string | null;
      };
      setBostaCityDraft(d.bostaDefaultCityId?.trim() ?? "");
      setBostaZoneDraft(d.bostaDefaultZoneId?.trim() ?? "");
      setBostaBuildingDraft(d.bostaDefaultBuildingNumber?.trim() ?? "");
      setBostaAddressLineDraft(d.bostaDefaultAddressLine?.trim() ?? "");
      setBostaPackageDescDraft(d.bostaPackageDescription?.trim() ?? "");
      setBostaMsg("Bosta address defaults saved.");
    } catch (e) {
      setBostaErr(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function copyWooUrl() {
    const text = wooDisplayUrl;
    if (!text || typeof navigator === "undefined" || !navigator.clipboard)
      return;
    try {
      await navigator.clipboard.writeText(text);
      setWooCopied(true);
      window.setTimeout(() => setWooCopied(false), 2000);
    } catch {
      setWooErr("Could not copy to clipboard");
    }
  }

  async function copyStorefrontOrderUrl() {
    const text = storefrontOrderDisplayUrl;
    if (!text || typeof navigator === "undefined" || !navigator.clipboard)
      return;
    try {
      await navigator.clipboard.writeText(text);
      setStorefrontOrderCopied(true);
      window.setTimeout(() => setStorefrontOrderCopied(false), 2000);
    } catch {
      setStorefrontOrderErr("Could not copy to clipboard");
    }
  }

  async function copyWaUrl() {
    const text = waDisplayUrl;
    if (!text || typeof navigator === "undefined" || !navigator.clipboard)
      return;
    try {
      await navigator.clipboard.writeText(text);
      setWaCopied(true);
      window.setTimeout(() => setWaCopied(false), 2000);
    } catch {
      setWaErr("Could not copy to clipboard");
    }
  }

  async function applyWhatsAppIntegrationsPatch(
    body: Record<string, string | null>,
    successMsg: string,
  ) {
    setWaMsg(null);
    setWaErr(null);
    setWaSaving(true);
    try {
      const res = await fetch("/api/settings/integrations", {
        method: "PATCH",
        headers: {
          ...buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      const d = json.data as {
        whatsappVerifyTokenConfigured?: boolean;
        whatsappPhoneNumberId?: string | null;
        whatsappBusinessAccountId?: string | null;
        whatsappAccessTokenLast4?: string | null;
        whatsappAppSecretLast4?: string | null;
        whatsappSignatureDiagnostics?: {
          hasGlobalAppSecret: boolean;
          hasTenantAppSecret: boolean;
          signatureReady: boolean;
        };
      };
      setWaVerifyConfigured(!!d.whatsappVerifyTokenConfigured);
      setWaPhoneIdDraft(d.whatsappPhoneNumberId?.trim() ?? "");
      setWaBizDraft(d.whatsappBusinessAccountId?.trim() ?? "");
      setWaAccessLast4(d.whatsappAccessTokenLast4 ?? null);
      setWaAppSecretLast4(d.whatsappAppSecretLast4 ?? null);
      setWaSigDiag(d.whatsappSignatureDiagnostics ?? null);
      setWaVerifyDraft("");
      setWaAccessDraft("");
      setWaAppSecretDraft("");
      setWaMsg(successMsg);
    } catch (e) {
      setWaErr(e instanceof Error ? e.message : "Request failed");
    } finally {
      setWaSaving(false);
    }
  }

  async function saveWhatsAppCloud() {
    const body: Record<string, string | null> = {
      whatsapp_phone_number_id: waPhoneIdDraft.trim() || null,
      whatsapp_business_account_id: waBizDraft.trim() || null,
    };
    if (waVerifyDraft.trim()) body.whatsapp_verify_token = waVerifyDraft.trim();
    if (waAccessDraft.trim()) body.whatsapp_access_token = waAccessDraft.trim();
    if (waAppSecretDraft.trim()) body.whatsapp_app_secret = waAppSecretDraft.trim();
    await applyWhatsAppIntegrationsPatch(body, "WhatsApp Cloud settings saved.");
  }

  async function clearWhatsAppCloud() {
    await applyWhatsAppIntegrationsPatch(
      {
        whatsapp_verify_token: null,
        whatsapp_access_token: null,
        whatsapp_phone_number_id: null,
        whatsapp_business_account_id: null,
        whatsapp_app_secret: null,
      },
      "WhatsApp Cloud configuration removed for this company.",
    );
  }

  async function saveStorefrontOrderWebhook() {
    setStorefrontOrderMsg(null);
    setStorefrontOrderErr(null);
    const secret = storefrontOrderSecretDraft.trim();
    const headerName = storefrontOrderHeaderDraft.trim() || "x-api-secret";
    if (!secret) {
      setStorefrontOrderErr(
        "Paste the secret that the store frontend will send.",
      );
      return;
    }
    try {
      const res = await fetch("/api/settings/integrations", {
        method: "PATCH",
        headers: {
          ...buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          storefront_order_webhook_secret: secret,
          storefront_order_secret_header_name: headerName,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      const d = json.data as {
        storefrontOrderWebhookSecretConfigured?: boolean;
        storefrontOrderSecretHeaderName?: string;
      };
      setStorefrontOrderSecretConfigured(
        !!d.storefrontOrderWebhookSecretConfigured,
      );
      setStorefrontOrderHeaderDraft(
        d.storefrontOrderSecretHeaderName?.trim() || "x-api-secret",
      );
      setStorefrontOrderSecretDraft("");
      setStorefrontOrderMsg("Storefront order webhook secret saved.");
    } catch (e) {
      setStorefrontOrderErr(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function clearStorefrontOrderWebhookSecret() {
    setStorefrontOrderMsg(null);
    setStorefrontOrderErr(null);
    try {
      const res = await fetch("/api/settings/integrations", {
        method: "PATCH",
        headers: {
          ...buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ storefront_order_webhook_secret: null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      const d = json.data as {
        storefrontOrderWebhookSecretConfigured?: boolean;
      };
      setStorefrontOrderSecretConfigured(
        !!d.storefrontOrderWebhookSecretConfigured,
      );
      setStorefrontOrderSecretDraft("");
      setStorefrontOrderMsg("Storefront order webhook secret removed.");
    } catch (e) {
      setStorefrontOrderErr(e instanceof Error ? e.message : "Remove failed");
    }
  }

  async function saveBostaKey() {
    setBostaMsg(null);
    setBostaErr(null);
    const next = bostaKeyDraft.trim();
    if (!next) {
      setBostaErr("Paste your Bosta API key (or use Remove key).");
      return;
    }
    try {
      const res = await fetch("/api/settings/integrations", {
        method: "PATCH",
        headers: {
          ...buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ bosta_api_key: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      const d = json.data as { bostaApiKeyConfigured?: boolean };
      setBostaKeyConfigured(!!d.bostaApiKeyConfigured);
      setBostaKeyDraft("");
      setBostaMsg("Bosta API key saved for this company.");
    } catch (e) {
      setBostaErr(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function clearBostaKey() {
    setBostaMsg(null);
    setBostaErr(null);
    try {
      const res = await fetch("/api/settings/integrations", {
        method: "PATCH",
        headers: {
          ...buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ bosta_api_key: null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      const d = json.data as { bostaApiKeyConfigured?: boolean };
      setBostaKeyConfigured(!!d.bostaApiKeyConfigured);
      setBostaKeyDraft("");
      setBostaMsg("Bosta API key removed from tenant settings.");
    } catch (e) {
      setBostaErr(e instanceof Error ? e.message : "Remove failed");
    }
  }

  async function saveBostaBaseUrl() {
    setBostaMsg(null);
    setBostaErr(null);
    const t = bostaBaseDraft.trim();
    try {
      const res = await fetch("/api/settings/integrations", {
        method: "PATCH",
        headers: {
          ...buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bosta_base_url: t === "" ? null : t,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      const d = json.data as { bostaBaseUrl?: string | null };
      setBostaBaseDraft(d.bostaBaseUrl?.trim() ?? "");
      setBostaMsg(
        t === ""
          ? "Bosta base URL reset (default or server env)."
          : "Bosta base URL saved.",
      );
    } catch (e) {
      setBostaErr(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function saveJntSettings(clearSecrets = false) {
    setJntMsg(null);
    setJntErr(null);
    try {
      const body = clearSecrets
        ? {
            jnt_api_account: null,
            jnt_customer_code: null,
            jnt_password: null,
            jnt_digest_secret: null,
          }
        : {
            jnt_api_account: jntApiAccountDraft.trim() || undefined,
            jnt_customer_code: jntCustomerCodeDraft.trim() || undefined,
            jnt_password: jntPasswordDraft.trim() || undefined,
            jnt_digest_secret: jntDigestDraft.trim() || undefined,
            jnt_base_url: jntBaseDraft.trim() || null,
            jnt_environment: jntEnvironmentDraft,
            jnt_sender_name: jntSenderNameDraft.trim() || null,
            jnt_sender_phone: jntSenderPhoneDraft.trim() || null,
            jnt_sender_city: jntSenderCityDraft.trim() || null,
            jnt_sender_area: jntSenderAreaDraft.trim() || null,
            jnt_sender_address: jntSenderAddressDraft.trim() || null,
            jnt_default_service_code: jntServiceDraft.trim() || null,
            jnt_default_weight_kg: jntWeightDraft.trim() || null,
          };
      const res = await fetch("/api/settings/integrations", {
        method: "PATCH",
        headers: {
          ...buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      const d = json.data as {
        jntApiAccountConfigured?: boolean;
        jntCustomerCodeConfigured?: boolean;
        jntPasswordConfigured?: boolean;
        jntDigestSecretConfigured?: boolean;
        jntBaseUrl?: string | null;
      };
      setJntConfigured(
        !!(
          d.jntApiAccountConfigured &&
          d.jntCustomerCodeConfigured &&
          d.jntPasswordConfigured &&
          d.jntDigestSecretConfigured
        ),
      );
      setJntBaseDraft(d.jntBaseUrl?.trim() ?? "");
      setJntApiAccountDraft("");
      setJntCustomerCodeDraft("");
      setJntPasswordDraft("");
      setJntDigestDraft("");
      setJntMsg(clearSecrets ? "J&T credentials removed." : "J&T Egypt settings saved.");
    } catch (e) {
      setJntErr(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function saveFedexSettings(clearSecrets = false) {
    setFedexMsg(null);
    setFedexErr(null);
    try {
      const body = clearSecrets
        ? {
            fedex_client_id: null,
            fedex_client_secret: null,
            fedex_account_number: null,
          }
        : {
            fedex_client_id: fedexClientIdDraft.trim() || undefined,
            fedex_client_secret: fedexClientSecretDraft.trim() || undefined,
            fedex_account_number: fedexAccountDraft.trim() || null,
            fedex_base_url: fedexBaseDraft.trim() || null,
            fedex_environment: fedexEnvironmentDraft,
            fedex_shipper_name: fedexShipperNameDraft.trim() || null,
            fedex_shipper_phone: fedexShipperPhoneDraft.trim() || null,
            fedex_shipper_street: fedexStreetDraft.trim() || null,
            fedex_shipper_city: fedexCityDraft.trim() || null,
            fedex_shipper_postal_code: fedexPostalDraft.trim() || null,
            fedex_shipper_country_code: fedexCountryDraft.trim() || null,
            fedex_default_service_type: fedexServiceDraft.trim() || null,
            fedex_default_packaging_type: fedexPackagingDraft.trim() || null,
            fedex_default_weight_kg: fedexWeightDraft.trim() || null,
          };
      const res = await fetch("/api/settings/integrations", {
        method: "PATCH",
        headers: {
          ...buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      const d = json.data as {
        fedexClientIdConfigured?: boolean;
        fedexClientSecretConfigured?: boolean;
        fedexAccountNumber?: string | null;
        fedexBaseUrl?: string | null;
      };
      setFedexConfigured(
        !!(
          d.fedexClientIdConfigured &&
          d.fedexClientSecretConfigured &&
          d.fedexAccountNumber?.trim()
        ),
      );
      setFedexAccountDraft(d.fedexAccountNumber?.trim() ?? "");
      setFedexBaseDraft(d.fedexBaseUrl?.trim() ?? "");
      setFedexClientIdDraft("");
      setFedexClientSecretDraft("");
      setFedexMsg(clearSecrets ? "FedEx credentials removed." : "FedEx settings saved.");
    } catch (e) {
      setFedexErr(e instanceof Error ? e.message : "Save failed");
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dev/mock-status")
      .then((r) => r.json())
      .then((j: { enabled?: boolean }) => {
        if (!cancelled) setMockDataOn(!!j.enabled);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (advTab === "users" && !can(permissionSubject, "user:read")) {
      setAdvTab("general");
    }
  }, [permissionSubject, advTab]);

  useEffect(() => {
    if (
      advTab === "inbox_templates" &&
      !can(permissionSubject, "inbox:manage")
    ) {
      setAdvTab("general");
    }
  }, [permissionSubject, advTab]);

  useEffect(() => {
    if (!authReady) return;
    if (section !== "advanced" || advTab !== "shipment") return;
    if (!can(permissionSubject, "user:manage")) return;
    let cancelled = false;
    (async () => {
      setSettingsErr(null);
      try {
        const h = buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role });
        const [autoRes, whRes] = await Promise.all([
          fetch("/api/settings/automation", { headers: h }),
          fetch("/api/settings/warehouse", { headers: h }),
        ]);
        if (!autoRes.ok) {
          const json = await autoRes.json();
          throw new Error(json.error ?? autoRes.statusText);
        }
        const json = await autoRes.json();
        const d = json.data as {
          auto_create_shipment: boolean;
          create_shipment_stage: "confirmed" | "invoiced";
          whatsappMessageTemplate?: string;
          orderLinkTemplate?: string;
          whatsappAutomationEnabled?: boolean;
          n8nWebhookUrl?: string;
          n8nWebhookSecret?: string;
          orderConfirmationTemplateName?: string;
          orderConfirmationTemplateLanguage?: string;
          inlineReplyClassifier?: boolean;
        };
        if (!cancelled) {
          setAutoShip(d.auto_create_shipment);
          setShipStage(d.create_shipment_stage);
          setWhTemplate(
            d.whatsappMessageTemplate?.trim() ||
              defaultTenantAutomation.whatsappMessageTemplate ||
              "",
          );
          setOrderLinkTemplateDraft(d.orderLinkTemplate?.trim() ?? "");
          setWhatsappAutomationEnabled(!!d.whatsappAutomationEnabled);
          setInlineReplyClassifier(!!d.inlineReplyClassifier);
          setN8nWebhookUrlDraft(d.n8nWebhookUrl?.trim() ?? "");
          setN8nWebhookSecretDraft("");
          setN8nSecretConfigured(!!d.n8nWebhookSecret?.trim());
          setOrderConfirmationTemplateNameDraft(
            d.orderConfirmationTemplateName?.trim() ?? "",
          );
          setOrderConfirmationTemplateLangDraft(
            d.orderConfirmationTemplateLanguage?.trim() ?? "",
          );
        }
        if (whRes.ok) {
          const wj = await whRes.json();
          const w = wj.data as { singleScanFulfills: boolean; scanCooldownMs: number };
          if (!cancelled) {
            setWhSingleScan(w.singleScanFulfills);
            setWhCooldownSec(w.scanCooldownMs / 1000);
          }
        }
      } catch (e) {
        if (!cancelled)
          setSettingsErr(
            e instanceof Error ? e.message : "Could not load automation",
          );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authReady, section, advTab, apiSecret, idToken, tenantId, userId, role, permissionSubject]);

  useEffect(() => {
    if (!authReady) return;
    if (section !== "advanced" || advTab !== "webhooks") return;
    if (!can(permissionSubject, "user:manage")) return;
    let cancelled = false;
    (async () => {
      setOutboundWebhookErr(null);
      try {
        const res = await fetch("/api/settings/outbound-webhooks", {
          headers: buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? res.statusText);
        const d = json.data as {
          outboundWebhooks: (Omit<OutboundWebhookDraft, "secret"> & {
            secretConfigured: boolean;
          })[];
          logs?: OutboundWebhookDeliveryLog[];
        };
        if (!cancelled) {
          setOutboundWebhookDrafts(
            d.outboundWebhooks.map((w) => ({
              ...w,
              secret: "",
              includeOrderSnapshot: !!w.includeOrderSnapshot,
            })),
          );
          setOutboundWebhookLogs(d.logs ?? []);
        }
      } catch (e) {
        if (!cancelled) {
          setOutboundWebhookErr(
            e instanceof Error ? e.message : "Could not load outbound webhooks",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authReady, section, advTab, apiSecret, idToken, tenantId, userId, role, permissionSubject]);

  useEffect(() => {
    if (!authReady) return;
    if (section !== "advanced" || advTab !== "kanban") return;
    let cancelled = false;
    (async () => {
      setKanbanErr(null);
      try {
        const res = await fetch("/api/settings/kanban", {
          headers: buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? res.statusText);
        const cols = (json.data as { columns: unknown }).columns;
        if (!cancelled) setKanbanJson(JSON.stringify(cols, null, 2));
      } catch (e) {
        if (!cancelled)
          setKanbanErr(e instanceof Error ? e.message : "Could not load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authReady, section, advTab, apiSecret, idToken, tenantId, userId, role]);

  async function saveKanban() {
    setSettingsMsg(null);
    setSettingsErr(null);
    setKanbanErr(null);
    try {
      const columns = JSON.parse(kanbanJson) as unknown;
      if (!Array.isArray(columns)) throw new Error("Columns must be an array");
      const res = await fetch("/api/settings/kanban", {
        method: "PATCH",
        headers: buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
        body: JSON.stringify({ columns }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setKanbanJson(JSON.stringify(json.data.columns, null, 2));
      setSettingsMsg("Kanban settings saved.");
    } catch (e) {
      const m = e instanceof Error ? e.message : "Save failed";
      if (m.includes("JSON")) setKanbanErr("Invalid JSON");
      else setSettingsErr(m);
    }
  }

  function resetKanbanDefault() {
    setKanbanJson(JSON.stringify(defaultKanbanSettings().columns, null, 2));
    setKanbanErr(null);
  }

  function addOutboundWebhookDraft() {
    setOutboundWebhookDrafts((rows) => [
      ...rows,
      {
        id: crypto.randomUUID(),
        name: "Order status webhook",
        enabled: true,
        url: "",
        secret: "",
        statuses: ["confirmed"],
        includeOrderSnapshot: false,
      },
    ]);
  }

  function updateOutboundWebhookDraft(
    id: string,
    patch: Partial<OutboundWebhookDraft>,
  ) {
    setOutboundWebhookDrafts((rows) =>
      rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function toggleOutboundWebhookStatus(id: string, status: OrderStatus) {
    setOutboundWebhookDrafts((rows) =>
      rows.map((row) => {
        if (row.id !== id) return row;
        const has = row.statuses.includes(status);
        return {
          ...row,
          statuses: has
            ? row.statuses.filter((s) => s !== status)
            : [...row.statuses, status],
        };
      }),
    );
  }

  async function saveOutboundWebhooks() {
    setSettingsMsg(null);
    setSettingsErr(null);
    setOutboundWebhookErr(null);
    try {
      const outboundWebhooks = outboundWebhookDrafts.map((w) => ({
        id: w.id,
        name: w.name.trim(),
        enabled: w.enabled,
        url: w.url.trim(),
        secret: w.secret.trim() ? w.secret.trim() : undefined,
        statuses: w.statuses,
        includeOrderSnapshot: w.includeOrderSnapshot,
      }));
      const res = await fetch("/api/settings/outbound-webhooks", {
        method: "PATCH",
        headers: buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
        body: JSON.stringify({ outboundWebhooks }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      const saved = json.data?.outboundWebhooks as
        | (Omit<OutboundWebhookDraft, "secret"> & { secretConfigured: boolean })[]
        | undefined;
      if (saved) {
        setOutboundWebhookDrafts(
          saved.map((w) => ({
            ...w,
            secret: "",
            includeOrderSnapshot: !!w.includeOrderSnapshot,
          })),
        );
      }
      setSettingsMsg("Order status webhooks saved.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Save failed";
      setSettingsErr(msg);
      setOutboundWebhookErr(msg);
    }
  }

  async function saveAutomation() {
    setSettingsMsg(null);
    setSettingsErr(null);
    try {
      const secretTrim = n8nWebhookSecretDraft.trim();
      const body: Record<string, unknown> = {
        auto_create_shipment: autoShip,
        create_shipment_stage: shipStage,
        whatsappMessageTemplate: whTemplate.trim() || null,
        orderLinkTemplate: orderLinkTemplateDraft.trim() || null,
        whatsappAutomationEnabled,
        n8nWebhookUrl: n8nWebhookUrlDraft.trim() || null,
        orderConfirmationTemplateName:
          orderConfirmationTemplateNameDraft.trim() || null,
        orderConfirmationTemplateLanguage:
          orderConfirmationTemplateLangDraft.trim() || null,
        inlineReplyClassifier,
      };
      if (secretTrim.length >= 8) {
        body.n8nWebhookSecret = secretTrim;
      }
      const res = await fetch("/api/settings/automation", {
        method: "PATCH",
        headers: buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      const saved = json.data as {
        whatsappMessageTemplate?: string;
        orderLinkTemplate?: string;
        n8nWebhookUrl?: string;
        n8nWebhookSecret?: string;
        orderConfirmationTemplateName?: string;
        orderConfirmationTemplateLanguage?: string;
        inlineReplyClassifier?: boolean;
      };
      if (saved.whatsappMessageTemplate) {
        setWhTemplate(saved.whatsappMessageTemplate);
      }
      setOrderLinkTemplateDraft(saved.orderLinkTemplate?.trim() ?? "");
      setN8nWebhookUrlDraft(saved.n8nWebhookUrl?.trim() ?? "");
      setOrderConfirmationTemplateNameDraft(
        saved.orderConfirmationTemplateName?.trim() ?? "",
      );
      setOrderConfirmationTemplateLangDraft(
        saved.orderConfirmationTemplateLanguage?.trim() ?? "",
      );
      setInlineReplyClassifier(!!saved.inlineReplyClassifier);
      if (secretTrim.length >= 8) {
        setN8nWebhookSecretDraft("");
        setN8nSecretConfigured(true);
      } else if (saved.n8nWebhookSecret?.trim()) {
        setN8nSecretConfigured(true);
      }
      setSettingsMsg("Shipment, confirmation WhatsApp, and inbox automation saved.");
    } catch (e) {
      setSettingsErr(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function clearN8nSecret() {
    setSettingsMsg(null);
    setSettingsErr(null);
    try {
      const res = await fetch("/api/settings/automation", {
        method: "PATCH",
        headers: buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
        body: JSON.stringify({ n8nWebhookSecret: null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setN8nSecretConfigured(!!json.data?.n8nWebhookSecret?.trim());
      setN8nWebhookSecretDraft("");
      setSettingsMsg("n8n HMAC secret cleared.");
    } catch (e) {
      setSettingsErr(e instanceof Error ? e.message : "Clear failed");
    }
  }

  async function saveWarehouse() {
    setSettingsMsg(null);
    setSettingsErr(null);
    try {
      const res = await fetch("/api/settings/warehouse", {
        method: "PATCH",
        headers: buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
        body: JSON.stringify({
          singleScanFulfills: whSingleScan,
          scanCooldownMs: Math.max(0, Math.round(whCooldownSec * 1000)),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setSettingsMsg("Warehouse scan settings saved.");
    } catch (e) {
      setSettingsErr(e instanceof Error ? e.message : "Save failed");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your workspace configuration and personal preferences."
      />

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav
          className="flex flex-col gap-2 rounded-[var(--ds-radius-md)] bg-[color:var(--color-card)] p-2 shadow-none lg:sticky lg:top-4 lg:self-start"
          aria-label="Settings navigation"
        >
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              className={cn(
                "min-h-11 w-full rounded-[var(--ds-radius-md)] px-4 py-2 text-start text-base font-normal leading-6 transition-colors duration-150",
                section === item.id
                  ? "bg-[color:var(--color-sidebar-nav-active-bg)] text-[color:var(--color-sidebar-nav-active-fg)]"
                  : "text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-hover-bg)] hover:text-[color:var(--color-text-primary)]",
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="min-w-0 space-y-6">
          {section === "profile" && (
            <>
              <Card>
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                  <CardTitle>Profile information</CardTitle>
                  <Button
                    type="button"
                    size="sm"
                    onClick={saveProfile}
                    disabled={profileSaving}
                  >
                    {profileSaving ? "Saving…" : "Save Changes"}
                  </Button>
                </CardHeader>
                {profileMsg ? (
                  <p className="px-5 pb-0 text-sm text-[color:var(--color-success)] sm:px-6">
                    {profileMsg}
                  </p>
                ) : null}
                {profileErr ? (
                  <p className="px-5 pb-0 text-sm text-[color:var(--color-error)] sm:px-6">
                    {profileErr}
                  </p>
                ) : null}
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2 flex items-center gap-4">
                    <div className="flex size-16 items-center justify-center rounded-[var(--ds-radius-md)] bg-[color:var(--color-muted-bg)] text-lg font-bold text-[color:var(--color-text-primary)] ring-1 ring-inset ring-[color:var(--color-border)]">
                      {firstName[0] || "?"}
                      {lastName[0] || ""}
                    </div>
                    {/* <button
                      type="button"
                      className="text-sm font-medium text-[color:var(--color-primary)] hover:underline"
                    >
                      Change profile picture
                    </button> */}
                  </div>
                  <Input
                    label="First name"
                    value={firstName}
                    onChange={(e) =>
                      setProfile({ firstName: e.target.value })
                    }
                  />
                  <Input
                    label="Last name"
                    value={lastName}
                    onChange={(e) => setProfile({ lastName: e.target.value })}
                  />
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-medium text-[color:var(--color-text-secondary)]">
                      Public bio
                    </label>
                    <textarea
                      className="min-h-[100px] w-full rounded-[var(--ds-radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-input-bg)] p-3 text-sm leading-relaxed text-[color:var(--color-text-primary)] shadow-none outline-none transition-[border-color,box-shadow] placeholder:text-[color:var(--color-text-muted)] focus:border-[color:var(--color-primary)] focus:shadow-[var(--shadow-focus-ring)] focus:ring-0"
                      value={bio}
                      onChange={(e) => setProfile({ bio: e.target.value })}
                    />
                  </div>
                  <Select
                    label="Timezone"
                    value={timezone}
                    onChange={(e) => setProfile({ timezone: e.target.value })}
                  >
                    <option value="America/Los_Angeles">PST (UTC-8)</option>
                    <option value="Africa/Cairo">Africa/Cairo</option>
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">America/New_York</option>
                  </Select>
                  <Select
                    label="Preferred language"
                    value={language}
                    onChange={(e) =>
                      setLocale(e.target.value as Locale)
                    }
                  >
                    <option value="en">English (US)</option>
                    <option value="ar">Arabic</option>
                  </Select>
                </CardContent>
              </Card>

              <Card className="border border-[color:var(--color-error)]/35 bg-[color:var(--color-error)]/5">
                <CardHeader>
                  <CardTitle className="text-[color:var(--color-error)]">
                    Danger zone
                  </CardTitle>
                  <p className="text-sm font-normal text-[color:var(--color-error)]">
                    Irreversible actions that affect your entire account access.
                  </p>
                </CardHeader>
                <CardContent className="rounded-[var(--ds-radius-md)] border border-[color:var(--color-divider)] bg-[color:var(--color-card)] p-4 shadow-none">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-[color:var(--color-text-primary)]">
                        Deactivate account
                      </p>
                      <p className="text-sm text-[color:var(--color-text-secondary)]">
                        Deactivate your operator access for this tenant. This
                        cannot be undone from the UI.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      className="shrink-0 border-[color:var(--color-error)] text-[color:var(--color-error)] hover:bg-[color:var(--color-error)]/10"
                      onClick={() =>
                        alert("Deactivate is not wired — contact support.")
                      }
                    >
                      Deactivate
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {section === "team" && (
            <Card>
              <CardHeader>
                <CardTitle>Team</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-[color:var(--color-text-secondary)]">
                Invite teammates and manage roles from this workspace (coming
                soon). For now, use{" "}
                <Link href="/users" className="text-[color:var(--color-primary)] hover:underline">
                  Users
                </Link>{" "}
                if your role allows it.
              </CardContent>
            </Card>
          )}

          {section === "api" && (
            <div className="space-y-6">
              <Card className="border-[color:var(--color-primary)]/25 bg-[color:var(--color-primary)]/5">
                <CardHeader>
                  <CardTitle>روابط إعداد المنصات</CardTitle>
                  <p className="text-sm font-normal text-[color:var(--color-text-secondary)]">
                    افتح المنصة المناسبة، أنشئ المفاتيح أو الـ webhook، ثم انسخ القيم
                    في الأقسام أدناه لربط المتجر والشحن وواتساب وn8n.
                  </p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {PLATFORM_SETUP_LINKS.map((row) => (
                      <PlatformSetupLinkRow key={row.href + row.label} {...row} />
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Session API secret</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <p className="text-[color:var(--color-text-secondary)]">
                    Rotate keys regularly. Values are stored in your browser
                    for this demo session.
                  </p>
                  <Input
                    label="Session Bearer key (e.g. tenant staff API key)"
                    type="password"
                    value={apiSecret}
                    onChange={(e) => setSession({ apiSecret: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      setSession({
                        apiSecret: `sk_${crypto.randomUUID().slice(0, 24)}`,
                      })
                    }
                  >
                    Generate new key (local)
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>WooCommerce (WordPress)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-[color:var(--color-text-primary)]">
                  <p className="text-[color:var(--color-text-secondary)]">
                    WooCommerce must call <strong>your</strong> URL with{" "}
                    <code className="rounded bg-[color:var(--color-code-bg)] px-1 text-xs">
                      tenant=
                    </code>{" "}
                    set to this company id:{" "}
                    <code className="rounded bg-[color:var(--color-code-bg)] px-1 text-xs">
                      {tenantId}
                    </code>
                    . Use the same secret here as in the WooCommerce webhook
                    definition so we can verify{" "}
                    <code className="rounded bg-[color:var(--color-code-bg)] px-1 text-[11px]">
                      X-WC-Webhook-Signature
                    </code>
                    .
                  </p>
                  <div className="space-y-2">
                    <span className="text-[12px] font-medium text-[color:var(--color-text-muted)]">
                      Webhook delivery URL (paste in WooCommerce)
                    </span>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <code className="block flex-1 break-all rounded-[var(--ds-radius-md)] bg-[color:var(--color-code-bg)] px-3 py-2 text-xs">
                        {wooDisplayUrl ||
                          "…load this page in the browser to generate the link"}
                      </code>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="shrink-0"
                        disabled={!wooDisplayUrl}
                        onClick={() => void copyWooUrl()}
                      >
                        {wooCopied ? (
                          <>
                            <Check className="size-4" aria-hidden />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="size-4" aria-hidden />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                    {wooServerBase ? (
                      <p className="text-xs text-[color:var(--color-text-muted)]">
                        Server canonical base:{" "}
                        <code className="rounded bg-[color:var(--color-code-bg)] px-1">
                          {wooServerBase}
                        </code>{" "}
                        — set{" "}
                        <code className="rounded bg-[color:var(--color-code-bg)] px-1">
                          NEXT_PUBLIC_APP_URL
                        </code>{" "}
                        if WordPress must use a fixed production domain.
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-2 border-t border-[color:var(--color-divider)] pt-4">
                    <span className="text-[12px] font-medium text-[color:var(--color-text-muted)]">
                      Webhook secret (per company)
                    </span>
                    <p className="text-[color:var(--color-text-secondary)]">
                      In WooCommerce go to{" "}
                      <strong>Settings → Advanced → Webhooks</strong>, create a
                      webhook, and copy the <strong>Secret</strong> field —
                      then paste it here. We verify the{" "}
                      <code className="rounded bg-[color:var(--color-code-bg)] px-1 text-[11px]">
                        X-WC-Webhook-Signature
                      </code>{" "}
                      header with this value.
                    </p>
                    <p className="flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={
                          wooSecretConfigured
                            ? "font-medium text-[color:var(--color-success)]"
                            : "text-[color:var(--color-text-muted)]"
                        }
                      >
                        {wooSecretConfigured
                          ? "Secret is stored for this tenant."
                          : "No secret stored yet (or using server env fallback)."}
                      </span>
                    </p>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      placeholder="Paste WooCommerce webhook secret"
                      value={wooSecretDraft}
                      onChange={(e) => setWooSecretDraft(e.target.value)}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void saveWooSecret()}
                      >
                        Save secret
                      </Button>
                      {wooSecretConfigured ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => void clearWooSecret()}
                        >
                          Remove secret
                        </Button>
                      ) : null}
                    </div>
                    {wooMsg ? (
                      <p className="text-xs font-medium text-[color:var(--color-success)]">
                        {wooMsg}
                      </p>
                    ) : null}
                    {wooErr ? (
                      <p className="text-xs text-[color:var(--color-error)]">
                        {wooErr}
                      </p>
                    ) : null}
                    <p className="text-xs text-[color:var(--color-text-muted)]">
                      Optional dev fallback: a single{" "}
                      <code className="rounded bg-[color:var(--color-code-bg)] px-1">
                        WOOCOMMERCE_WEBHOOK_SECRET
                      </code>{" "}
                      in server env (one secret for all tenants). Prefer per-tenant
                      secrets above for production.
                    </p>
                  </div>
                  <div className="space-y-2 border-t border-[color:var(--color-divider)] pt-4">
                    <span className="text-[12px] font-medium text-[color:var(--color-text-muted)]">
                      REST API — push order status to WooCommerce
                    </span>
                    <p className="text-[color:var(--color-text-secondary)]">
                      Create a REST API key in{" "}
                      <strong>WooCommerce → Settings → Advanced → REST API</strong>{" "}
                      with read/write access. When staff change an order&apos;s
                      status in Store, we update the matching WooCommerce order
                      (same ID as synced from the webhook).
                    </p>
                    <p className="text-xs">
                      <span
                        className={
                          wooRestConfigured
                            ? "font-medium text-[color:var(--color-success)]"
                            : "text-[color:var(--color-text-muted)]"
                        }
                      >
                        {wooRestConfigured
                          ? "Store URL and REST keys are configured."
                          : "Configure store URL and both keys to enable push."}
                      </span>
                      {(wooCkLast4 || wooCsLast4) && !wooRestConfigured ? (
                        <span className="text-[color:var(--color-text-muted)]">
                          {" "}
                          (Partial: ck …{wooCkLast4 ?? "—"}, cs …
                          {wooCsLast4 ?? "—"})
                        </span>
                      ) : null}
                    </p>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-[color:var(--color-text-muted)]">
                        Store URL
                      </label>
                      <Input
                        placeholder="https://your-store.com"
                        value={wooStoreDraft}
                        onChange={(e) => setWooStoreDraft(e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="mt-1"
                        onClick={() => void saveWooRestStoreUrl()}
                      >
                        Save store URL
                      </Button>
                    </div>
                    <div className="space-y-1 pt-2">
                      <label className="text-xs font-medium text-[color:var(--color-text-muted)]">
                        Consumer key / secret
                      </label>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        placeholder="Consumer key (ck_...)"
                        value={wooCkDraft}
                        onChange={(e) => setWooCkDraft(e.target.value)}
                      />
                      <Input
                        type="password"
                        autoComplete="new-password"
                        placeholder="Consumer secret (cs_...)"
                        value={wooCsDraft}
                        onChange={(e) => setWooCsDraft(e.target.value)}
                      />
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void saveWooRestKeys()}
                        >
                          Save REST keys
                        </Button>
                        {(wooCkLast4 || wooCsLast4) ? (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => void clearWooRestKeys()}
                          >
                            Remove REST keys
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={wooWebhookRefreshing || !wooRestConfigured}
                          onClick={() => void refreshWooWebhookStatus()}
                        >
                          {wooWebhookRefreshing ? "Refreshing…" : "Refresh webhooks"}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={
                            wooWebhookSyncing ||
                            !wooRestConfigured ||
                            !wooSecretConfigured
                          }
                          onClick={() => void syncWooWebhooks()}
                        >
                          {wooWebhookSyncing
                            ? "Fixing webhooks…"
                            : "Auto-fix missing webhooks"}
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-[color:var(--color-text-muted)]">
                      Auto-fix creates or reactivates WooCommerce order webhooks using
                      this company&apos;s REST keys, delivery URL, and per-company
                      secret.
                    </p>
                    {wooWebhookStatus ? (
                      <div className="space-y-2 rounded-[var(--ds-radius-md)] border border-[color:var(--color-border)] p-3 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[color:var(--color-text-secondary)]">
                          <span>
                            Matched {wooWebhookStatus.matchedCount} of{" "}
                            {wooWebhookStatus.allCount} webhook(s) on this store.
                          </span>
                          <span>
                            Secret:{" "}
                            {wooWebhookStatus.hasWebhookSecret ? "configured" : "missing"}
                          </span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full border-separate border-spacing-y-1">
                            <thead className="text-left text-[color:var(--color-text-muted)]">
                              <tr>
                                <th className="py-1 pr-3 font-medium">Recipe</th>
                                <th className="py-1 pr-3 font-medium">Topic</th>
                                <th className="py-1 font-medium">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {wooWebhookStatus.recipes.map((recipe) => (
                                <tr key={recipe.topic}>
                                  <td className="py-1 pr-3 text-[color:var(--color-text-primary)]">
                                    {recipe.label}
                                  </td>
                                  <td className="py-1 pr-3 font-mono">
                                    {recipe.topic}
                                  </td>
                                  <td className="py-1">
                                    <span
                                      className={
                                        recipe.status === "active"
                                          ? "font-medium text-[color:var(--color-success)]"
                                          : recipe.status === "inactive"
                                            ? "font-medium text-[color:var(--color-warning)]"
                                            : "font-medium text-[color:var(--color-error)]"
                                      }
                                    >
                                      {recipe.status === "active"
                                        ? "موجود ونشط"
                                        : recipe.status === "inactive"
                                          ? `موجود معطّل (${recipe.webhookStatus ?? "inactive"})`
                                          : "مفقود"}
                                    </span>
                                    {recipe.webhookId ? (
                                      <span className="ml-2 text-[color:var(--color-text-muted)]">
                                        #{recipe.webhookId}
                                      </span>
                                    ) : null}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {wooWebhookStatus.failed?.length ? (
                          <ul className="space-y-1 border-t border-[color:var(--color-divider)] pt-2 text-[color:var(--color-error)]">
                            {wooWebhookStatus.failed.map((failure) => (
                              <li key={failure.topic}>
                                <span className="font-mono">{failure.topic}</span>:{" "}
                                {failure.message}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Storefront order forwarding</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-[color:var(--color-text-primary)]">
                  <p className="text-[color:var(--color-text-secondary)]">
                    Use this endpoint as the external API URL in the store
                    frontend. After WooCommerce creates an order, the store sends
                    the WooCommerce order JSON here and this OMS saves it for the
                    selected company.
                  </p>
                  <div className="space-y-2">
                    <span className="text-[12px] font-medium text-[color:var(--color-text-muted)]">
                      Forwarded order API URL
                    </span>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <code className="block flex-1 break-all rounded-[var(--ds-radius-md)] bg-[color:var(--color-code-bg)] px-3 py-2 text-xs">
                        {storefrontOrderDisplayUrl ||
                          "…load this page in the browser to generate the link"}
                      </code>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="shrink-0"
                        disabled={!storefrontOrderDisplayUrl}
                        onClick={() => void copyStorefrontOrderUrl()}
                      >
                        {storefrontOrderCopied ? (
                          <>
                            <Check className="size-4" aria-hidden />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="size-4" aria-hidden />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
                    <Input
                      label="Secret header name"
                      placeholder="x-api-secret"
                      value={storefrontOrderHeaderDraft}
                      onChange={(e) =>
                        setStorefrontOrderHeaderDraft(e.target.value)
                      }
                    />
                    <Input
                      label="Shared secret"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Secret sent by the store frontend"
                      value={storefrontOrderSecretDraft}
                      onChange={(e) =>
                        setStorefrontOrderSecretDraft(e.target.value)
                      }
                    />
                  </div>
                  <p className="text-xs">
                    <span
                      className={
                        storefrontOrderSecretConfigured
                          ? "font-medium text-[color:var(--color-success)]"
                          : "text-[color:var(--color-text-muted)]"
                      }
                    >
                      {storefrontOrderSecretConfigured
                        ? "Secret is stored for this forwarded-order API."
                        : "No secret stored yet; forwarded orders will be rejected."}
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void saveStorefrontOrderWebhook()}
                    >
                      Save forwarding secret
                    </Button>
                    {storefrontOrderSecretConfigured ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => void clearStorefrontOrderWebhookSecret()}
                      >
                        Remove forwarding secret
                      </Button>
                    ) : null}
                  </div>
                  <p className="text-xs text-[color:var(--color-text-muted)]">
                    Expected payload:{" "}
                    <code className="rounded bg-[color:var(--color-code-bg)] px-1">
                      event=&quot;order.created&quot;
                    </code>
                    ,{" "}
                    <code className="rounded bg-[color:var(--color-code-bg)] px-1">
                      source=&quot;sokany-store&quot;
                    </code>
                    , and{" "}
                    <code className="rounded bg-[color:var(--color-code-bg)] px-1">
                      order
                    </code>{" "}
                    containing the WooCommerce order response.
                  </p>
                  {storefrontOrderMsg ? (
                    <p className="text-xs font-medium text-[color:var(--color-success)]">
                      {storefrontOrderMsg}
                    </p>
                  ) : null}
                  {storefrontOrderErr ? (
                    <p className="text-xs text-[color:var(--color-error)]">
                      {storefrontOrderErr}
                    </p>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>WhatsApp Cloud API</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-[color:var(--color-text-primary)]">
                  <p className="text-[color:var(--color-text-secondary)]">
                    Meta WhatsApp Business Platform: register this callback URL in
                    your Meta app, then paste the verify token, phone number ID,
                    and system user access token. Values are stored in Firestore
                    for this company only (never shown again in full after save).
                  </p>
                  <div className="space-y-2">
                    <span className="text-[12px] font-medium text-[color:var(--color-text-muted)]">
                      Callback URL (Webhook)
                    </span>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <code className="block flex-1 break-all rounded-[var(--ds-radius-md)] bg-[color:var(--color-code-bg)] px-3 py-2 text-xs">
                        {waDisplayUrl ||
                          "…load this page in the browser to generate the link"}
                      </code>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="shrink-0"
                        disabled={!waDisplayUrl}
                        onClick={() => void copyWaUrl()}
                      >
                        {waCopied ? (
                          <>
                            <Check className="size-4" aria-hidden />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="size-4" aria-hidden />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  {waSigDiag ? (
                    <ul className="space-y-1 text-xs text-[color:var(--color-text-secondary)]">
                      <li className="flex justify-between gap-2">
                        <span>POST signature: server WHATSAPP_APP_SECRET</span>
                        <span
                          className={
                            waSigDiag.hasGlobalAppSecret
                              ? "font-medium text-[color:var(--color-success)]"
                              : "text-[color:var(--color-text-muted)]"
                          }
                        >
                          {waSigDiag.hasGlobalAppSecret ? "Set" : "—"}
                        </span>
                      </li>
                      <li className="flex justify-between gap-2">
                        <span>POST signature: per-company App secret</span>
                        <span
                          className={
                            waSigDiag.hasTenantAppSecret
                              ? "font-medium text-[color:var(--color-success)]"
                              : "text-[color:var(--color-text-muted)]"
                          }
                        >
                          {waSigDiag.hasTenantAppSecret ? "Set" : "—"}
                        </span>
                      </li>
                      <li className="flex justify-between gap-2">
                        <span>Webhook signature ready</span>
                        <span
                          className={
                            waSigDiag.signatureReady
                              ? "font-medium text-[color:var(--color-success)]"
                              : "text-[color:var(--color-error)]"
                          }
                        >
                          {waSigDiag.signatureReady ? "Yes" : "Configure env or App secret"}
                        </span>
                      </li>
                    </ul>
                  ) : null}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      label="Phone number ID"
                      placeholder="From Meta → WhatsApp → API setup"
                      value={waPhoneIdDraft}
                      onChange={(e) => setWaPhoneIdDraft(e.target.value)}
                    />
                    <Input
                      label="Business account ID (optional)"
                      placeholder="waba-…"
                      value={waBizDraft}
                      onChange={(e) => setWaBizDraft(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[color:var(--color-text-muted)]">
                      Verify token
                      {waVerifyConfigured ? (
                        <span className="ms-2 font-normal text-[color:var(--color-success)]">
                          (saved)
                        </span>
                      ) : null}
                    </label>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      placeholder={
                        waVerifyConfigured
                          ? "Enter new token to replace"
                          : "Same token you enter in Meta webhook form"
                      }
                      value={waVerifyDraft}
                      onChange={(e) => setWaVerifyDraft(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[color:var(--color-text-muted)]">
                      System user access token
                      {waAccessLast4 ? (
                        <span className="ms-2 font-normal text-[color:var(--color-text-muted)]">
                          …{waAccessLast4}
                        </span>
                      ) : null}
                    </label>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      placeholder="Long-lived token (EAA…)"
                      value={waAccessDraft}
                      onChange={(e) => setWaAccessDraft(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[color:var(--color-text-muted)]">
                      App secret (optional, overrides server env)
                      {waAppSecretLast4 ? (
                        <span className="ms-2 font-normal text-[color:var(--color-text-muted)]">
                          …{waAppSecretLast4}
                        </span>
                      ) : null}
                    </label>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      placeholder="Meta App secret for X-Hub-Signature-256"
                      value={waAppSecretDraft}
                      onChange={(e) => setWaAppSecretDraft(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      loading={waSaving}
                      onClick={() => void saveWhatsAppCloud()}
                    >
                      Save WhatsApp Cloud
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      loading={waSaving}
                      onClick={() =>
                        void applyWhatsAppIntegrationsPatch(
                          { whatsapp_verify_token: null },
                          "Verify token removed.",
                        )
                      }
                      disabled={!waVerifyConfigured}
                    >
                      Remove verify token
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      loading={waSaving}
                      onClick={() =>
                        void applyWhatsAppIntegrationsPatch(
                          { whatsapp_access_token: null },
                          "Access token removed.",
                        )
                      }
                      disabled={!waAccessLast4}
                    >
                      Remove access token
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      loading={waSaving}
                      onClick={() =>
                        void applyWhatsAppIntegrationsPatch(
                          { whatsapp_app_secret: null },
                          "App secret removed.",
                        )
                      }
                      disabled={!waAppSecretLast4}
                    >
                      Remove app secret
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      loading={waSaving}
                      onClick={() => void clearWhatsAppCloud()}
                    >
                      Clear all WhatsApp fields
                    </Button>
                  </div>
                  {waMsg ? (
                    <p className="text-xs font-medium text-[color:var(--color-success)]">
                      {waMsg}
                    </p>
                  ) : null}
                  {waErr ? (
                    <p className="text-xs text-[color:var(--color-error)]">
                      {waErr}
                    </p>
                  ) : null}
                  <p className="text-xs text-[color:var(--color-text-muted)]">
                    Subscribe in Meta to{" "}
                    <code className="rounded bg-[color:var(--color-code-bg)] px-1">
                      messages
                    </code>{" "}
                    and{" "}
                    <code className="rounded bg-[color:var(--color-code-bg)] px-1">
                      message_status
                    </code>
                    . Order confirmation templates and n8n are configured under
                    Workspace → Shipment &amp; confirmation.
                  </p>
                </CardContent>
              </Card>

              {can(permissionSubject, "user:manage") ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Webhook health (server)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm text-[color:var(--color-text-primary)]">
                    <p className="text-[color:var(--color-text-secondary)]">
                      Shown for admins. These checks reflect the{" "}
                      <strong>deployed</strong> server: set env vars in Vercel, not
                      only <code className="rounded bg-[color:var(--color-code-bg)] px-1 text-xs">.env.local</code>.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={
                          wooWebhookTesting || wooWebhookFiring || !wooSecretConfigured
                        }
                        onClick={() => void sendWooDiagnosticWebhook()}
                      >
                        {wooWebhookTesting
                          ? "Sending diagnostic…"
                          : "Send diagnostic webhook"}
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        disabled={
                          wooWebhookFiring || wooWebhookTesting || !wooSecretConfigured
                        }
                        onClick={() => void fireTestOrderWebhook()}
                      >
                        {wooWebhookFiring ? "Creating order…" : "Fire test order"}
                      </Button>
                      <span className="text-xs text-[color:var(--color-text-muted)]">
                        Diagnostic logs{" "}
                        <code className="rounded bg-[color:var(--color-code-bg)] px-1">
                          diagnostic_200
                        </code>{" "}
                        without saving an order; Fire test order creates one test
                        order.
                      </span>
                    </div>
                    {wooWebhookTestMsg ? (
                      <p className="text-xs font-medium text-[color:var(--color-success)]">
                        {wooWebhookTestMsg}
                      </p>
                    ) : null}
                    {wooWebhookFireMsg ? (
                      <p className="text-xs font-medium text-[color:var(--color-success)]">
                        {wooWebhookFireMsg}
                      </p>
                    ) : null}
                    {wooDiagnostic ? (
                      <ul className="space-y-1.5 text-xs">
                        {[
                          [
                            "HMAC: per-tenant secret in Integrations",
                            wooDiagnostic.hasPerTenantWooSecret,
                          ],
                          [
                            "HMAC: WOOCOMMERCE_WEBHOOK_SECRET on server",
                            wooDiagnostic.hasServerEnvWooSecret,
                          ],
                          [
                            "HMAC: at least one secret (ready to verify)",
                            wooDiagnostic.effectiveSecretReady,
                          ],
                          [
                            "SUPABASE_SERVICE_ROLE_KEY (write orders in Supabase)",
                            wooDiagnostic.hasSupabaseConfigured,
                          ],
                          [
                            "NEXT_PUBLIC_APP_URL (stable production link)",
                            wooDiagnostic.hasCustomAppUrl,
                          ],
                          [
                            "VERCEL_URL present (Vercel deploy fallback for base URL)",
                            wooDiagnostic.hasVercelUrl,
                          ],
                        ].map(([label, ok]) => (
                          <li
                            key={String(label)}
                            className="flex items-start justify-between gap-2"
                          >
                            <span className="text-[color:var(--color-text-secondary)]">
                              {label}
                            </span>
                            <span
                              className={
                                ok
                                  ? "shrink-0 font-medium text-[color:var(--color-success)]"
                                  : "shrink-0 text-[color:var(--color-text-muted)]"
                              }
                            >
                              {ok ? "OK" : "—"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-[color:var(--color-text-muted)]">
                        {wooErr
                          ? "Open this tab with an account that can load Integrations, or fix the error above."
                          : "Loading…"}
                      </p>
                    )}
                    {wooDiagnostic?.warnings?.length ? (
                      <div className="space-y-1 rounded-[var(--ds-radius-md)] border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-100">
                        {wooDiagnostic.warnings.map((w) => (
                          <p key={w}>{w}</p>
                        ))}
                      </div>
                    ) : null}
                    {wooIngestLoadErr ? (
                      <p className="text-xs text-[color:var(--color-error)]">
                        {wooIngestLoadErr}
                      </p>
                    ) : null}
                    {wooDiagnostic && !wooIngestLoadErr && !wooErr ? (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px] text-left text-xs [direction:ltr]">
                          <thead>
                            <tr className="border-b border-[color:var(--color-divider)] text-[color:var(--color-text-muted)]">
                              <th className="py-1.5 pe-2 font-medium">Time (UTC)</th>
                              <th className="py-1.5 pe-2 font-medium">saved in OMS</th>
                              <th className="py-1.5 pe-2 font-medium">outcome</th>
                              <th className="py-1.5 pe-2 font-medium">http</th>
                              <th className="py-1.5 pe-2 font-medium">delivery</th>
                              <th className="py-1.5 pe-2 font-medium">Woo #</th>
                              <th className="py-1.5 pe-2 font-medium">OMS order</th>
                              <th className="py-1.5 font-medium">error</th>
                            </tr>
                          </thead>
                          <tbody>
                            {wooIngestLogs.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={8}
                                  className="py-4 text-center text-[color:var(--color-text-muted)]"
                                >
                                  No webhook delivery rows yet. Create a test order in WooCommerce
                                  or use &quot;Delivery&quot; on the webhook. Failed deliveries
                                  (no order saved) appear here as{" "}
                                  <code className="rounded bg-[color:var(--color-code-bg)] px-0.5">
                                    processing_failed_400
                                  </code>{" "}
                                  or other non-success outcomes.
                                </td>
                              </tr>
                            ) : (
                              wooIngestLogs.map((r) => {
                                const saved =
                                  r.outcome === "order_upserted_200"
                                    ? "yes"
                                    : r.outcome === "duplicate_200"
                                      ? "replay"
                                      : r.outcome === "diagnostic_200"
                                        ? "diagnostic"
                                        : "no";
                                return (
                                  <tr
                                    key={r.id}
                                    className={cn(
                                      "border-b border-[color:var(--color-border)]/60",
                                      saved === "no" &&
                                        "bg-red-500/[0.07] dark:bg-red-500/[0.12]",
                                    )}
                                  >
                                    <td className="whitespace-nowrap py-1.5 pe-2 font-mono text-[10px] text-[color:var(--color-text-secondary)]">
                                      {r.createdAt}
                                    </td>
                                    <td
                                      className={cn(
                                        "py-1.5 pe-2 font-medium",
                                        saved === "yes" &&
                                          "text-[color:var(--color-success)]",
                                        saved === "replay" &&
                                          "text-[color:var(--color-text-muted)]",
                                        saved === "diagnostic" &&
                                          "text-[color:var(--color-success)]",
                                        saved === "no" && "text-[color:var(--color-error)]",
                                      )}
                                    >
                                      {saved === "yes"
                                        ? "Yes"
                                        : saved === "replay"
                                          ? "Replay"
                                          : saved === "diagnostic"
                                            ? "Diagnostic OK"
                                            : "No"}
                                    </td>
                                    <td className="py-1.5 pe-2 font-mono text-[10px]">
                                      {r.outcome}
                                    </td>
                                    <td className="py-1.5 pe-2 tabular-nums">
                                      {r.httpStatus}
                                    </td>
                                    <td
                                      className="max-w-[8rem] truncate py-1.5 pe-2 font-mono text-[10px]"
                                      title={r.deliveryId}
                                    >
                                      {r.deliveryId}
                                    </td>
                                    <td className="py-1.5 pe-2 font-mono text-[10px]">
                                      {r.wooOrderId ?? "—"}
                                    </td>
                                    <td className="py-1.5 pe-2">
                                      {r.orderId ? (
                                        <Link
                                          className="text-[color:var(--color-primary)] hover:underline"
                                          href={`/orders/${r.orderId}`}
                                        >
                                          {r.orderId.slice(0, 8)}…
                                        </Link>
                                      ) : (
                                        "—"
                                      )}
                                    </td>
                                    <td
                                      className="max-w-[10rem] truncate text-[color:var(--color-error)]"
                                      title={r.errorMessage}
                                    >
                                      {r.errorMessage ?? "—"}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                        {wooIngestLogs.length > 0 ? (
                          <p className="mt-2 text-[10px] text-[color:var(--color-text-muted)]">
                            Each WordPress call writes one row. If the order is not saved, look for
                            a red <span className="font-medium">No</span> under &quot;saved in
                            OMS&quot; and the error column — typically{" "}
                            <code className="rounded bg-[color:var(--color-code-bg)] px-0.5">
                              processing_failed_400
                            </code>{" "}
                            or <code className="rounded bg-[color:var(--color-code-bg)] px-0.5">
                              claim_failed_500
                            </code>
                            .
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ) : null}

              <Card>
                <CardHeader>
                  <CardTitle>Tenant staff API key</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-[color:var(--color-text-primary)]">
                  <p className="text-[color:var(--color-text-secondary)]">
                    Scripts and integrations can call this API with{" "}
                    <code className="rounded bg-[color:var(--color-code-bg)] px-1 text-[11px]">
                      Authorization: Bearer (your key)
                    </code>
                    , plus headers{" "}
                    <code className="rounded bg-[color:var(--color-code-bg)] px-1 text-[11px]">
                      X-Tenant-Id
                    </code>
                    ,{" "}
                    <code className="rounded bg-[color:var(--color-code-bg)] px-1 text-[11px]">
                      X-User-Id
                    </code>
                    ,{" "}
                    <code className="rounded bg-[color:var(--color-code-bg)] px-1 text-[11px]">
                      X-User-Role
                    </code>
                    . The full key is shown once when you register the company;
                    store it in a secret manager.
                  </p>
                  <p className="text-xs">
                    <span
                      className={
                        staffApiKeyConfigured
                          ? "font-medium text-[color:var(--color-success)]"
                          : "text-[color:var(--color-text-muted)]"
                      }
                    >
                      {staffApiKeyConfigured
                        ? `Key active (ends with …${staffApiKeyLast4 ?? "????"})`
                        : "No tenant key record (use Supabase sign-in or staff API key)."}
                    </span>
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Bosta</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-[color:var(--color-text-primary)]">
                  <p className="text-[color:var(--color-text-secondary)]">
                    API key and optional API base are stored per tenant. Creating
                    a shipment uses this tenant&apos;s key first, then falls
                    back to server{" "}
                    <code className="rounded bg-[color:var(--color-code-bg)] px-1 text-xs">
                      BOSTA_API_KEY
                    </code>{" "}
                    /{" "}
                    <code className="rounded bg-[color:var(--color-code-bg)] px-1 text-xs">
                      BOSTA_BASE_URL
                    </code>{" "}
                    if unset.
                  </p>
                  <p className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={
                        bostaKeyConfigured
                          ? "font-medium text-[color:var(--color-success)]"
                          : "text-[color:var(--color-text-muted)]"
                      }
                    >
                      {bostaKeyConfigured
                        ? "API key stored for this tenant."
                        : "No tenant API key (mock AWBs unless env key is set)."}
                    </span>
                  </p>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[color:var(--color-text-muted)]">
                      API key
                    </label>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      placeholder="Bosta API key"
                      value={bostaKeyDraft}
                      onChange={(e) => setBostaKeyDraft(e.target.value)}
                    />
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void saveBostaKey()}
                      >
                        Save API key
                      </Button>
                      {bostaKeyConfigured ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => void clearBostaKey()}
                        >
                          Remove key
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div className="space-y-1 border-t border-[color:var(--color-divider)] pt-4">
                    <label className="text-xs font-medium text-[color:var(--color-text-muted)]">
                      API base URL (optional)
                    </label>
                    <Input
                      placeholder="https://app.bosta.co"
                      value={bostaBaseDraft}
                      onChange={(e) => setBostaBaseDraft(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="mt-2"
                      onClick={() => void saveBostaBaseUrl()}
                    >
                      Save base URL
                    </Button>
                    <p className="text-xs text-[color:var(--color-text-muted)]">
                      Use the Bosta host only (e.g. production{" "}
                      <code className="rounded bg-[color:var(--color-code-bg)] px-1">
                        https://app.bosta.co
                      </code>{" "}
                      or staging{" "}
                      <code className="rounded bg-[color:var(--color-code-bg)] px-1">
                        https://stg-app.bosta.co
                      </code>
                      ). The server calls{" "}
                      <code className="rounded bg-[color:var(--color-code-bg)] px-1">
                        /api/v0
                      </code>{" "}
                      automatically.
                    </p>
                  </div>
                  <div className="space-y-3 border-t border-[color:var(--color-divider)] pt-4">
                    <span className="text-[12px] font-medium text-[color:var(--color-text-muted)]">
                      Delivery address defaults (required for real AWBs)
                    </span>
                    <p className="text-xs text-[color:var(--color-text-muted)]">
                      This is the warehouse / pickup address the shipment leaves
                      from. Load cities from Bosta, choose{" "}
                      <strong>10th of Ramadan</strong> (or the closest warehouse
                      city), then choose a zone if Bosta returns one. Customer
                      address still comes from the WooCommerce order.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={bostaCitiesLoading}
                        onClick={() => void loadBostaCities()}
                      >
                        {bostaCitiesLoading ? "Loading cities…" : "Load Bosta cities"}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={bostaZonesLoading || !bostaCityDraft.trim()}
                        onClick={() => void loadBostaZones()}
                      >
                        {bostaZonesLoading ? "Loading zones…" : "Load zones"}
                      </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-[color:var(--color-text-muted)]">
                          Warehouse city
                        </label>
                        <Select
                          value={bostaCityDraft}
                          onChange={(e) => {
                            const next = e.target.value;
                            setBostaCityDraft(next);
                            setBostaZoneDraft("");
                            setBostaZones([]);
                            if (next) void loadBostaZones(next);
                          }}
                        >
                          <option value="">
                            {bostaCities.length
                              ? "Choose city"
                              : bostaCityDraft || "Load cities first"}
                          </option>
                          {bostaCityDraft &&
                          !bostaCities.some((c) => c.id === bostaCityDraft) ? (
                            <option value={bostaCityDraft}>
                              Current saved city ({bostaCityDraft})
                            </option>
                          ) : null}
                          {bostaCities.map((city) => (
                            <option key={city.id} value={city.id}>
                              {city.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-[color:var(--color-text-muted)]">
                          Warehouse zone
                        </label>
                        <Select
                          value={bostaZoneDraft}
                          disabled={!bostaCityDraft.trim()}
                          onChange={(e) => setBostaZoneDraft(e.target.value)}
                        >
                          <option value="">
                            {bostaZones.length ? "No zone / choose zone" : "Load zones"}
                          </option>
                          {bostaZoneDraft &&
                          !bostaZones.some((z) => z.id === bostaZoneDraft) ? (
                            <option value={bostaZoneDraft}>
                              Current saved zone ({bostaZoneDraft})
                            </option>
                          ) : null}
                          {bostaZones.map((zone) => (
                            <option key={zone.id} value={zone.id}>
                              {zone.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-[color:var(--color-text-muted)]">
                          Building number
                        </label>
                        <Input
                          placeholder="1"
                          value={bostaBuildingDraft}
                          onChange={(e) => setBostaBuildingDraft(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-xs font-medium text-[color:var(--color-text-muted)]">
                          Fallback address line (if order has no address)
                        </label>
                        <Input
                          placeholder="Street / landmark"
                          value={bostaAddressLineDraft}
                          onChange={(e) =>
                            setBostaAddressLineDraft(e.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-xs font-medium text-[color:var(--color-text-muted)]">
                          Package description (optional)
                        </label>
                        <Input
                          placeholder="e.g. Store order shipment"
                          value={bostaPackageDescDraft}
                          onChange={(e) =>
                            setBostaPackageDescDraft(e.target.value)
                          }
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => void saveBostaAddressFields()}
                    >
                      Save Bosta address defaults
                    </Button>
                  </div>
                  {bostaMsg ? (
                    <p className="text-xs font-medium text-[color:var(--color-success)]">
                      {bostaMsg}
                    </p>
                  ) : null}
                  {bostaErr ? (
                    <p className="text-xs text-[color:var(--color-error)]">
                      {bostaErr}
                    </p>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>J&amp;T Egypt</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <p className="text-[color:var(--color-text-secondary)]">
                    Configure the J&amp;T Egypt OpenAPI account used for AWB creation,
                    tracking, cancellation, and waybill printing.
                  </p>
                  <p
                    className={
                      jntConfigured
                        ? "text-xs font-medium text-[color:var(--color-success)]"
                        : "text-xs text-[color:var(--color-text-muted)]"
                    }
                  >
                    {jntConfigured
                      ? "J&T credentials are stored for this tenant."
                      : "Missing one or more J&T credentials."}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      type="password"
                      autoComplete="new-password"
                      label="API account"
                      placeholder="JT_API_ACCOUNT"
                      value={jntApiAccountDraft}
                      onChange={(e) => setJntApiAccountDraft(e.target.value)}
                    />
                    <Input
                      type="password"
                      autoComplete="new-password"
                      label="Customer code"
                      value={jntCustomerCodeDraft}
                      onChange={(e) => setJntCustomerCodeDraft(e.target.value)}
                    />
                    <Input
                      type="password"
                      autoComplete="new-password"
                      label="Customer password"
                      value={jntPasswordDraft}
                      onChange={(e) => setJntPasswordDraft(e.target.value)}
                    />
                    <Input
                      type="password"
                      autoComplete="new-password"
                      label="Private/digest key"
                      value={jntDigestDraft}
                      onChange={(e) => setJntDigestDraft(e.target.value)}
                    />
                    <Select
                      label="Environment"
                      value={jntEnvironmentDraft}
                      onChange={(e) =>
                        setJntEnvironmentDraft(e.target.value as "test" | "prod")
                      }
                    >
                      <option value="prod">Production</option>
                      <option value="test">Demo / test</option>
                    </Select>
                    <Input
                      label="Base URL override"
                      placeholder="https://openapi.jtjms-eg.com"
                      value={jntBaseDraft}
                      onChange={(e) => setJntBaseDraft(e.target.value)}
                    />
                    <Input
                      label="Sender name"
                      value={jntSenderNameDraft}
                      onChange={(e) => setJntSenderNameDraft(e.target.value)}
                    />
                    <Input
                      label="Sender phone"
                      value={jntSenderPhoneDraft}
                      onChange={(e) => setJntSenderPhoneDraft(e.target.value)}
                    />
                    <Input
                      label="Sender city"
                      value={jntSenderCityDraft}
                      onChange={(e) => setJntSenderCityDraft(e.target.value)}
                    />
                    <Input
                      label="Sender area"
                      value={jntSenderAreaDraft}
                      onChange={(e) => setJntSenderAreaDraft(e.target.value)}
                    />
                    <Input
                      label="Default service code"
                      placeholder="EZ"
                      value={jntServiceDraft}
                      onChange={(e) => setJntServiceDraft(e.target.value)}
                    />
                    <Input
                      label="Default weight KG"
                      placeholder="1"
                      value={jntWeightDraft}
                      onChange={(e) => setJntWeightDraft(e.target.value)}
                    />
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-xs font-medium text-[color:var(--color-text-muted)]">
                        Sender address
                      </label>
                      <Input
                        value={jntSenderAddressDraft}
                        onChange={(e) => setJntSenderAddressDraft(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" onClick={() => void saveJntSettings()}>
                      Save J&amp;T settings
                    </Button>
                    {jntConfigured ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => void saveJntSettings(true)}
                      >
                        Remove credentials
                      </Button>
                    ) : null}
                  </div>
                  {jntMsg ? (
                    <p className="text-xs font-medium text-[color:var(--color-success)]">
                      {jntMsg}
                    </p>
                  ) : null}
                  {jntErr ? (
                    <p className="text-xs text-[color:var(--color-error)]">{jntErr}</p>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>FedEx</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <p className="text-[color:var(--color-text-secondary)]">
                    FedEx uses OAuth credentials and an account number. Labels are
                    requested as PDF or ZPLII based on the shipment option.
                  </p>
                  <p
                    className={
                      fedexConfigured
                        ? "text-xs font-medium text-[color:var(--color-success)]"
                        : "text-xs text-[color:var(--color-text-muted)]"
                    }
                  >
                    {fedexConfigured
                      ? "FedEx credentials are stored for this tenant."
                      : "Missing FedEx client credentials or account number."}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      type="password"
                      autoComplete="new-password"
                      label="Client ID"
                      value={fedexClientIdDraft}
                      onChange={(e) => setFedexClientIdDraft(e.target.value)}
                    />
                    <Input
                      type="password"
                      autoComplete="new-password"
                      label="Client secret"
                      value={fedexClientSecretDraft}
                      onChange={(e) => setFedexClientSecretDraft(e.target.value)}
                    />
                    <Input
                      label="Account number"
                      value={fedexAccountDraft}
                      onChange={(e) => setFedexAccountDraft(e.target.value)}
                    />
                    <Select
                      label="Environment"
                      value={fedexEnvironmentDraft}
                      onChange={(e) =>
                        setFedexEnvironmentDraft(e.target.value as "test" | "prod")
                      }
                    >
                      <option value="prod">Production</option>
                      <option value="test">Sandbox</option>
                    </Select>
                    <Input
                      label="Base URL override"
                      placeholder="https://apis.fedex.com"
                      value={fedexBaseDraft}
                      onChange={(e) => setFedexBaseDraft(e.target.value)}
                    />
                    <Input
                      label="Default service"
                      placeholder="INTERNATIONAL_PRIORITY"
                      value={fedexServiceDraft}
                      onChange={(e) => setFedexServiceDraft(e.target.value)}
                    />
                    <Input
                      label="Default packaging"
                      placeholder="YOUR_PACKAGING"
                      value={fedexPackagingDraft}
                      onChange={(e) => setFedexPackagingDraft(e.target.value)}
                    />
                    <Input
                      label="Default weight KG"
                      placeholder="1"
                      value={fedexWeightDraft}
                      onChange={(e) => setFedexWeightDraft(e.target.value)}
                    />
                    <Input
                      label="Shipper name"
                      value={fedexShipperNameDraft}
                      onChange={(e) => setFedexShipperNameDraft(e.target.value)}
                    />
                    <Input
                      label="Shipper phone"
                      value={fedexShipperPhoneDraft}
                      onChange={(e) => setFedexShipperPhoneDraft(e.target.value)}
                    />
                    <Input
                      label="Shipper city"
                      value={fedexCityDraft}
                      onChange={(e) => setFedexCityDraft(e.target.value)}
                    />
                    <Input
                      label="Postal code"
                      value={fedexPostalDraft}
                      onChange={(e) => setFedexPostalDraft(e.target.value)}
                    />
                    <Input
                      label="Country code"
                      value={fedexCountryDraft}
                      onChange={(e) => setFedexCountryDraft(e.target.value)}
                    />
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-xs font-medium text-[color:var(--color-text-muted)]">
                        Shipper street
                      </label>
                      <Input
                        value={fedexStreetDraft}
                        onChange={(e) => setFedexStreetDraft(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void saveFedexSettings()}
                    >
                      Save FedEx settings
                    </Button>
                    {fedexConfigured ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => void saveFedexSettings(true)}
                      >
                        Remove credentials
                      </Button>
                    ) : null}
                  </div>
                  {fedexMsg ? (
                    <p className="text-xs font-medium text-[color:var(--color-success)]">
                      {fedexMsg}
                    </p>
                  ) : null}
                  {fedexErr ? (
                    <p className="text-xs text-[color:var(--color-error)]">
                      {fedexErr}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          )}

          {section === "notifications" && (
            <Card>
              <CardHeader>
                <CardTitle>Notification preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  {
                    id: "order",
                    title: "Order completion alerts",
                    desc: "Ping when orders reach delivered or cancelled.",
                    value: orderAlerts,
                    set: setOrderAlerts,
                  },
                  {
                    id: "inv",
                    title: "Inventory thresholds",
                    desc: "Stock warnings from warehouse signals.",
                    value: inventoryAlerts,
                    set: setInventoryAlerts,
                  },
                  {
                    id: "tix",
                    title: "Ticket escalations",
                    desc: "When a ticket sits unassigned too long.",
                    value: ticketEscalation,
                    set: setTicketEscalation,
                  },
                ].map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center justify-between gap-4 rounded-[var(--ds-radius-md)] bg-[color:var(--color-bg-subtle)] p-4 shadow-none"
                  >
                    <div>
                      <p className="font-medium" id={`${row.id}-label`}>
                        {row.title}
                      </p>
                      <p className="text-xs text-[color:var(--color-text-muted)]">
                        {row.desc}
                      </p>
                    </div>
                    <Switch
                      checked={row.value}
                      onCheckedChange={row.set}
                      aria-labelledby={`${row.id}-label`}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {section === "billing" && (
            <Card>
              <CardHeader>
                <CardTitle>Billing</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-[color:var(--color-text-secondary)]">
                Payment gateways and WooCommerce settlement views will appear
                here. Today, payment status is mirrored from ingested orders
                only.
              </CardContent>
            </Card>
          )}

          {section === "advanced" && (
            <div className="space-y-4">
              <div className="rounded-[var(--ds-radius-md)] bg-[color:var(--color-card)] p-2 ring-1 ring-inset ring-[color:var(--color-border)]">
                <Tabs
                  items={advTabs}
                  value={advTab}
                  onChange={(id) => setAdvTab(id as AdvTabId)}
                />
              </div>

              {settingsMsg && section === "advanced" ? (
                <p className="text-sm text-[color:var(--color-success)]">
                  {settingsMsg}
                </p>
              ) : null}
              {settingsErr ? (
                <p className="text-sm text-[color:var(--color-error)]">
                  {settingsErr}
                </p>
              ) : null}

              {advTab === "general" && (
                <Card>
                  <CardHeader>
                    <CardTitle>Workspace</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <p>
                      Tenant:{" "}
                      <span className="font-mono font-medium">{tenantId}</span>
                    </p>
                    <Select
                      label="Theme"
                      value={themePreference}
                      onChange={(e) =>
                        setThemePreference(e.target.value as ThemePreference)
                      }
                    >
                      <option value="dark">Dark</option>
                      <option value="light">Light</option>
                      <option value="system">System</option>
                    </Select>
                    <p className="text-xs text-[color:var(--color-text-muted)]">
                      Admin analytics:{" "}
                      <Link href="/admin" className="text-[color:var(--color-primary)] hover:underline">
                        /admin
                      </Link>
                    </p>
                  </CardContent>
                </Card>
              )}

              {advTab === "inbox_templates" &&
                can(permissionSubject, "inbox:manage") && (
                  <InboxTemplatesSettings />
                )}

              {advTab === "kanban" && (
                <Card>
                  <CardHeader>
                    <CardTitle>Kanban column config</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <p className="text-[color:var(--color-text-secondary)]">
                      Edit JSON array of columns: id, title, statuses[], optional
                      cardFields.
                    </p>
                    {kanbanErr ? (
                      <p className="text-sm text-[color:var(--color-error)]">
                        {kanbanErr}
                      </p>
                    ) : null}
                    <textarea
                      className="min-h-[280px] w-full rounded-[var(--ds-radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-input-bg)] p-3 font-mono text-xs leading-relaxed text-[color:var(--color-text-primary)] shadow-none outline-none transition-[border-color,box-shadow] placeholder:text-[color:var(--color-text-muted)] focus:border-[color:var(--color-primary)] focus:shadow-[var(--shadow-focus-ring)] focus:ring-0"
                      value={kanbanJson}
                      onChange={(e) => setKanbanJson(e.target.value)}
                      spellCheck={false}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" onClick={saveKanban}>
                        Save Kanban
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={resetKanbanDefault}
                      >
                        Reset default (local)
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {advTab === "shipment" && can(permissionSubject, "user:manage") && (
                <Card>
                  <CardHeader>
                    <CardTitle>Shipment &amp; confirmation (WhatsApp)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-xs font-medium uppercase text-[color:var(--color-text-secondary)]">
                      Shipment automation
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={autoShip}
                        onChange={(e) => setAutoShip(e.target.checked)}
                      />
                      Auto-create shipment
                    </label>
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-[color:var(--color-text-secondary)]">
                        Create at stage
                      </span>
                      <Select
                        value={shipStage}
                        onChange={(e) =>
                          setShipStage(e.target.value as "confirmed" | "invoiced")
                        }
                      >
                        <option value="confirmed">After confirmed</option>
                        <option value="invoiced">After invoiced (warehouse ready)</option>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-[color:var(--color-text-secondary)]">
                        رسالة واتساب الافتراضية (فريق التأكيد)
                      </span>
                      <textarea
                        className="min-h-[100px] w-full rounded-[var(--ds-radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-input-bg)] p-3 text-sm leading-relaxed text-[color:var(--color-text-primary)] shadow-none outline-none transition-[border-color,box-shadow] placeholder:text-[color:var(--color-text-muted)] focus:border-[color:var(--color-primary)] focus:shadow-[var(--shadow-focus-ring)] focus:ring-0"
                        value={whTemplate}
                        onChange={(e) => setWhTemplate(e.target.value)}
                        placeholder="مثال: مرحباً {name} — طلب {orderId}"
                        spellCheck={false}
                      />
                      <div className="space-y-2 rounded-[var(--ds-radius-md)] bg-[color:var(--color-bg-subtle)] p-3 text-xs text-[color:var(--color-text-muted)]">
                        <p>
                          متغيرات سريعة: {`{name}`}، {`{orderId}`}،{" "}
                          {`{wooOrderId}`}، {`{awb}`}، {`{orderLink}`}،{" "}
                          {`{customer.address}`}، {`{customer.phone}`}،{" "}
                          {`{payment.total}`}، {`{shipping.method}`}.
                        </p>
                        <p>
                          المنتجات: استخدم {`{items.summary}`} لكل المنتجات كسطور،
                          أو {`{items:name,quantity,lineTotal,sku,link}`} لتحديد
                          شكل كل سطر. ويمكن قراءة مسار آمن من الأوردر مثل{" "}
                          {`{order.customer.email}`} أو {`{order.payment.total_amount}`}.
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-[color:var(--color-text-secondary)]">
                        قالب لينك الطلب/التتبع لكل شركة
                      </span>
                      <Input
                        value={orderLinkTemplateDraft}
                        onChange={(e) =>
                          setOrderLinkTemplateDraft(e.target.value)
                        }
                        placeholder="https://store.example.com/order-tracking/{wooOrderId}"
                      />
                      <p className="text-xs text-[color:var(--color-text-muted)]">
                        استخدم {`{orderLink}`} داخل رسالة واتساب لإظهار هذا
                        الرابط. قالب اللينك يدعم نفس متغيرات الأوردر مثل{" "}
                        {`{orderId}`}، {`{wooOrderId}`}، {`{customer.phone}`}.
                        لو الحقل فارغ، {`{orderLink}`} يتحول لنص فارغ.
                      </p>
                    </div>

                    <div className="border-t border-[color:var(--color-border-subtle)] pt-4">
                      <div className="text-xs font-medium uppercase text-[color:var(--color-text-secondary)]">
                        Inbox / WhatsApp Cloud + n8n
                      </div>
                      <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
                        When enabled, the server sends signed events to your n8n
                        webhook (incoming messages, order confirmation, human
                        takeover). Use the Inbox to take over from the bot.
                      </p>
                      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                        <a
                          href="https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-[color:var(--color-primary)] hover:underline"
                        >
                          إنشاء Webhook في n8n
                          <ExternalLink className="size-3 shrink-0" aria-hidden />
                        </a>
                        <a
                          href="https://app.n8n.cloud/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-[color:var(--color-primary)] hover:underline"
                        >
                          n8n Cloud
                          <ExternalLink className="size-3 shrink-0" aria-hidden />
                        </a>
                      </p>
                      <div className="mt-3 flex items-center justify-between gap-4 rounded-[var(--ds-radius-md)] bg-[color:var(--color-bg-subtle)] p-4">
                        <div>
                          <p className="font-medium" id="wa-auto-label">
                            WhatsApp automation (Cloud API + n8n)
                          </p>
                          <p className="text-xs text-[color:var(--color-text-muted)]">
                            Order confirmation template flow and webhook events to
                            n8n.
                          </p>
                        </div>
                        <Switch
                          checked={whatsappAutomationEnabled}
                          onCheckedChange={setWhatsappAutomationEnabled}
                          aria-labelledby="wa-auto-label"
                        />
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-4 rounded-[var(--ds-radius-md)] bg-[color:var(--color-bg-subtle)] p-4">
                        <div>
                          <p className="font-medium" id="inline-class-label">
                            Inline keyword classifier (OMS)
                          </p>
                          <p className="text-xs text-[color:var(--color-text-muted)]">
                            Classifies each incoming WhatsApp message on a linked order,
                            writes <code className="text-[11px]">chat.classified</code> to
                            the order, sends{" "}
                            <code className="text-[11px]">chat.reply.classified</code> to
                            n8n, and queues a human if confidence &lt; 80%.
                          </p>
                        </div>
                        <Switch
                          checked={inlineReplyClassifier}
                          onCheckedChange={setInlineReplyClassifier}
                          aria-labelledby="inline-class-label"
                        />
                      </div>
                      <div className="mt-4 space-y-1">
                        <span className="text-xs font-medium text-[color:var(--color-text-secondary)]">
                          n8n webhook URL
                        </span>
                        <Input
                          value={n8nWebhookUrlDraft}
                          onChange={(e) => setN8nWebhookUrlDraft(e.target.value)}
                          placeholder="https://your-n8n.example.com/webhook/..."
                          autoComplete="off"
                        />
                      </div>
                      <div className="mt-4 space-y-1">
                        <span className="text-xs font-medium text-[color:var(--color-text-secondary)]">
                          n8n HMAC secret ({`X-OMS-Signature`})
                        </span>
                        <Input
                          type="password"
                          value={n8nWebhookSecretDraft}
                          onChange={(e) =>
                            setN8nWebhookSecretDraft(e.target.value)
                          }
                          placeholder={
                            n8nSecretConfigured
                              ? "Leave blank to keep current secret"
                              : "Min 8 characters"
                          }
                          autoComplete="new-password"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          {n8nSecretConfigured ? (
                            <span className="text-xs text-[color:var(--color-success)]">
                              Secret is configured
                            </span>
                          ) : (
                            <span className="text-xs text-[color:var(--color-text-muted)]">
                              Required for signed POSTs to n8n (min 8 chars).
                            </span>
                          )}
                          {n8nSecretConfigured ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => void clearN8nSecret()}
                            >
                              Clear secret
                            </Button>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <span className="text-xs font-medium text-[color:var(--color-text-secondary)]">
                            Order confirmation template name (Meta)
                          </span>
                          <Input
                            value={orderConfirmationTemplateNameDraft}
                            onChange={(e) =>
                              setOrderConfirmationTemplateNameDraft(e.target.value)
                            }
                            placeholder="e.g. order_confirm_v1"
                            autoComplete="off"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs font-medium text-[color:var(--color-text-secondary)]">
                            Template language code
                          </span>
                          <Input
                            value={orderConfirmationTemplateLangDraft}
                            onChange={(e) =>
                              setOrderConfirmationTemplateLangDraft(e.target.value)
                            }
                            placeholder="ar or en"
                            autoComplete="off"
                          />
                        </div>
                      </div>
                    </div>

                    <Button type="button" onClick={() => void saveAutomation()}>
                      حفظ الأتمتة وواتساب التأكيد
                    </Button>
                  </CardContent>
                </Card>
              )}

              {advTab === "shipment" && can(permissionSubject, "user:manage") && (
                <Card>
                  <CardHeader>
                    <CardTitle>Warehouse scan (AWB)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-[color:var(--color-text-secondary)]">
                      One scan from &quot;ready for warehouse&quot; can either go to
                      packed only, or mark shipped in one step. In per-step mode, a
                      short cooldown after packing reduces accidental double scans.
                    </p>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={whSingleScan}
                        onChange={(e) => setWhSingleScan(e.target.checked)}
                      />
                      One AWB scan fulfills shipment (ready → shipped)
                    </label>
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-[color:var(--color-text-secondary)]">
                        Min seconds before packed → shipped (per-step mode)
                      </span>
                      <Input
                        type="number"
                        min={0}
                        step={0.1}
                        value={whCooldownSec}
                        onChange={(e) =>
                          setWhCooldownSec(Number(e.target.value) || 0)
                        }
                      />
                    </div>
                    <Button type="button" onClick={() => void saveWarehouse()}>
                      حفظ إعدادات المسح
                    </Button>
                  </CardContent>
                </Card>
              )}

              {advTab === "webhooks" && can(permissionSubject, "user:manage") && (
                <div className="space-y-4">
                  <Card>
                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                      <div>
                        <CardTitle>Order status webhooks</CardTitle>
                        <p className="mt-1 text-sm font-normal text-[color:var(--color-text-secondary)]">
                          Send a signed HTTP POST after selected order statuses.
                          Deliveries are non-blocking and never stop the order flow.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={addOutboundWebhookDraft}
                      >
                        Add webhook
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {outboundWebhookErr ? (
                        <p className="rounded-[var(--ds-radius-md)] border border-[color:var(--color-error)]/25 bg-[color:var(--color-error)]/12 p-3 text-sm text-[color:var(--color-error)] shadow-none">
                          {outboundWebhookErr}
                        </p>
                      ) : null}
                      {outboundWebhookDrafts.length === 0 ? (
                        <div className="rounded-[var(--ds-radius-md)] bg-[color:var(--color-bg-subtle)] p-4 text-sm text-[color:var(--color-text-secondary)]">
                          No outbound webhooks yet. Add one to notify Zapier,
                          Make, WordPress, or any custom platform when an order
                          reaches a status.
                        </div>
                      ) : null}
                      {outboundWebhookDrafts.map((webhook, index) => (
                        <div
                          key={webhook.id}
                          className="space-y-4 rounded-[var(--ds-radius-md)] bg-[color:var(--color-bg-subtle)] p-4 shadow-none"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <label className="flex items-center gap-2 text-sm font-medium">
                              <input
                                type="checkbox"
                                checked={webhook.enabled}
                                onChange={(e) =>
                                  updateOutboundWebhookDraft(webhook.id, {
                                    enabled: e.target.checked,
                                  })
                                }
                              />
                              Enabled
                            </label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setOutboundWebhookDrafts((rows) =>
                                  rows.filter((row) => row.id !== webhook.id),
                                )
                              }
                            >
                              Remove
                            </Button>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <Input
                              label="Name"
                              value={webhook.name}
                              onChange={(e) =>
                                updateOutboundWebhookDraft(webhook.id, {
                                  name: e.target.value,
                                })
                              }
                            />
                            <Input
                              label="Webhook URL"
                              placeholder="https://hooks.example.com/order-status"
                              value={webhook.url}
                              onChange={(e) =>
                                updateOutboundWebhookDraft(webhook.id, {
                                  url: e.target.value,
                                })
                              }
                            />
                            <Input
                              label={
                                webhook.secretConfigured
                                  ? "Secret (stored; enter a new value to rotate)"
                                  : "Secret (optional)"
                              }
                              type="password"
                              autoComplete="new-password"
                              placeholder={
                                webhook.secretConfigured
                                  ? "Leave empty to keep existing secret"
                                  : "Used for X-OMS-Signature"
                              }
                              value={webhook.secret}
                              onChange={(e) =>
                                updateOutboundWebhookDraft(webhook.id, {
                                  secret: e.target.value,
                                })
                              }
                            />
                            <label className="flex items-center gap-2 self-end text-sm">
                              <input
                                type="checkbox"
                                checked={webhook.includeOrderSnapshot}
                                onChange={(e) =>
                                  updateOutboundWebhookDraft(webhook.id, {
                                    includeOrderSnapshot: e.target.checked,
                                  })
                                }
                              />
                              Include WooCommerce snapshot
                            </label>
                          </div>
                          <div className="space-y-2">
                            <span className="text-[12px] font-medium text-[color:var(--color-text-muted)]">
                              Send when status becomes
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {ORDER_STATUSES.map((status) => (
                                <label
                                  key={`${webhook.id}-${status}`}
                                  className="flex items-center gap-1.5 rounded-[var(--ds-radius-md)] bg-[color:var(--color-card)] px-2 py-1 text-xs text-[color:var(--color-text-secondary)]"
                                >
                                  <input
                                    type="checkbox"
                                    checked={webhook.statuses.includes(status)}
                                    onChange={() =>
                                      toggleOutboundWebhookStatus(
                                        webhook.id,
                                        status,
                                      )
                                    }
                                  />
                                  {status}
                                </label>
                              ))}
                            </div>
                          </div>
                          <p className="text-xs text-[color:var(--color-text-muted)]">
                            Payload event:{" "}
                            <code className="rounded bg-[color:var(--color-code-bg)] px-1">
                              order.status_changed
                            </code>{" "}
                            . Webhook #{index + 1} keeps the order status update
                            successful even if delivery fails.
                          </p>
                        </div>
                      ))}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          onClick={() => void saveOutboundWebhooks()}
                        >
                          Save webhooks
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={addOutboundWebhookDraft}
                        >
                          Add another
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Recent webhook deliveries</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      {outboundWebhookLogs.length === 0 ? (
                        <p className="text-[color:var(--color-text-muted)]">
                          No delivery attempts yet.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[720px] text-left text-xs [direction:ltr]">
                            <thead>
                              <tr className="border-b border-[color:var(--color-divider)] text-[color:var(--color-text-muted)]">
                                <th className="py-1.5 pe-2 font-medium">time</th>
                                <th className="py-1.5 pe-2 font-medium">webhook</th>
                                <th className="py-1.5 pe-2 font-medium">order</th>
                                <th className="py-1.5 pe-2 font-medium">from</th>
                                <th className="py-1.5 pe-2 font-medium">to</th>
                                <th className="py-1.5 pe-2 font-medium">http</th>
                                <th className="py-1.5 font-medium">result</th>
                              </tr>
                            </thead>
                            <tbody>
                              {outboundWebhookLogs.map((row) => (
                                <tr
                                  key={row.id}
                                  className="border-b border-[color:var(--color-border)]/60"
                                >
                                  <td className="py-1.5 pe-2 font-mono text-[10px] text-[color:var(--color-text-secondary)]">
                                    {row.createdAt}
                                  </td>
                                  <td className="py-1.5 pe-2">
                                    {row.webhookName}
                                  </td>
                                  <td className="py-1.5 pe-2 font-mono text-[10px]">
                                    {row.orderId.slice(0, 8)}
                                  </td>
                                  <td className="py-1.5 pe-2">{row.fromStatus}</td>
                                  <td className="py-1.5 pe-2">{row.toStatus}</td>
                                  <td className="py-1.5 pe-2">
                                    {row.httpStatus ?? "—"}
                                  </td>
                                  <td
                                    className={
                                      row.success
                                        ? "py-1.5 font-medium text-[color:var(--color-success)]"
                                        : "py-1.5 text-[color:var(--color-error)]"
                                    }
                                    title={row.errorMessage}
                                  >
                                    {row.success ? "success" : row.errorMessage ?? "failed"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {advTab === "payment" && (
                <Card>
                  <CardHeader>
                    <CardTitle>Payment providers</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-[color:var(--color-text-secondary)]">
                    Gateway configuration will be added later. Payment state is
                    imported from orders.
                  </CardContent>
                </Card>
              )}

              {advTab === "users" && can(permissionSubject, "user:read") ? (
                <Card>
                  <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                    <CardTitle>Users</CardTitle>
                    <Link
                      href="/users"
                      className="text-sm font-medium text-[color:var(--color-primary)] hover:underline"
                    >
                      Open full page
                    </Link>
                  </CardHeader>
                  <CardContent>
                    <UsersManagement />
                  </CardContent>
                </Card>
              ) : null}

              {advTab === "developer" && (
                <Card>
                  <CardHeader>
                    <CardTitle>Developer session headers</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2">
                    {mockDataOn ? (
                      <div className="sm:col-span-2 rounded-[var(--ds-radius-md)] border border-[color:var(--color-dev-badge-border)] bg-[color:var(--color-dev-badge-bg)] p-3 text-sm text-[color:var(--color-dev-badge-text)] shadow-none">
                        <strong>Mock data on.</strong> Set{" "}
                        <code className="rounded bg-[color:var(--color-code-bg)] px-1">
                          DEV_MOCK_DATA=true
                        </code>{" "}
                        in{" "}
                        <code className="rounded bg-[color:var(--color-code-bg)] px-1">
                          .env.local
                        </code>
                        . Try scan AWBs{" "}
                        <code className="rounded bg-[color:var(--color-code-bg)] px-1">
                          MOCK-DEMO-001
                        </code>{" "}
                        /{" "}
                        <code className="rounded bg-[color:var(--color-code-bg)] px-1">
                          MOCK-DEMO-002
                        </code>
                        .
                      </div>
                    ) : (
                      <p className="sm:col-span-2 text-sm text-[color:var(--color-text-secondary)]">
                        Enable{" "}
                        <code className="rounded bg-[color:var(--color-code-bg)] px-1">
                          DEV_MOCK_DATA=true
                        </code>{" "}
                        and restart the dev server.
                      </p>
                    )}
                    <div className="space-y-1">
                      <label className="text-xs text-[color:var(--color-text-secondary)]">
                        X-Tenant-Id
                      </label>
                      <Input
                        value={tenantId}
                        onChange={(e) => setSession({ tenantId: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-[color:var(--color-text-secondary)]">
                        X-User-Id
                      </label>
                      <Input
                        value={userId}
                        onChange={(e) => setSession({ userId: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-[color:var(--color-text-secondary)]">
                        X-User-Role
                      </label>
                      <Select
                        value={role}
                        onChange={(e) =>
                          setSession({ role: e.target.value as typeof role })
                        }
                      >
                        {(
                          [
                            "admin",
                            "moderator",
                            "confirmation",
                            "invoicing",
                            "warehouse",
                            "support",
                          ] as const
                        ).map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <p className="sm:col-span-2 text-xs text-[color:var(--color-text-muted)]">
                      These values populate client requests to{" "}
                      <code className="rounded bg-[color:var(--color-code-bg)] px-1">
                        /api/*
                      </code>
                      . Replace with real auth in production.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
