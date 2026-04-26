"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Copy, Check } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useSessionStore, buildAuthHeaders } from "@/store/zustand/session-store";
import {
  useThemeStore,
  type ThemePreference,
} from "@/store/zustand/theme-store";
import { defaultKanbanSettings } from "@/lib/kanban/column";
import { cn } from "@/lib/ui/cn";
import { can } from "@/lib/auth/rbac";
import { defaultTenantAutomation } from "@/lib/types/models";
import { UsersManagement } from "@/components/users/users-management";

type AdvTabId =
  | "general"
  | "kanban"
  | "shipment"
  | "payment"
  | "users"
  | "developer";

const ADV_TAB_DEFS: { id: AdvTabId; label: string }[] = [
  { id: "general", label: "General" },
  { id: "shipment", label: "Shipment rules" },
  { id: "kanban", label: "Kanban JSON" },
  { id: "payment", label: "Payment" },
  { id: "users", label: "Users" },
  { id: "developer", label: "Developer session" },
];

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
  const setSession = useSessionStore((s) => s.setSession);
  const themePreference = useThemeStore((s) => s.themePreference);
  const setThemePreference = useThemeStore((s) => s.setThemePreference);

  const advTabs = useMemo(
    () =>
      ADV_TAB_DEFS.filter(
        (t) => t.id !== "users" || can(role, "user:read"),
      ),
    [role],
  );

  const [section, setSection] = useState<SectionId>("profile");
  const [advTab, setAdvTab] = useState<AdvTabId>("general");
  const [firstName, setFirstName] = useState("Alex");
  const [lastName, setLastName] = useState("Rivers");
  const [bio, setBio] = useState(
    "Operations lead focused on SLA-backed fulfillment.",
  );
  const [timezone, setTimezone] = useState("America/Los_Angeles");
  const [language, setLanguage] = useState("en");
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
  const [wooCopied, setWooCopied] = useState(false);
  const [wooWebhookCanonical, setWooWebhookCanonical] = useState<string | null>(
    null,
  );
  const [staffApiKeyConfigured, setStaffApiKeyConfigured] = useState(false);
  const [staffApiKeyLast4, setStaffApiKeyLast4] = useState<string | null>(null);

  const [bostaKeyConfigured, setBostaKeyConfigured] = useState(false);
  const [bostaKeyDraft, setBostaKeyDraft] = useState("");
  const [bostaBaseDraft, setBostaBaseDraft] = useState("");
  const [bostaMsg, setBostaMsg] = useState<string | null>(null);
  const [bostaErr, setBostaErr] = useState<string | null>(null);

  const [wooRestConfigured, setWooRestConfigured] = useState(false);
  const [wooStoreDraft, setWooStoreDraft] = useState("");
  const [wooCkDraft, setWooCkDraft] = useState("");
  const [wooCsDraft, setWooCsDraft] = useState("");
  const [wooCkLast4, setWooCkLast4] = useState<string | null>(null);
  const [wooCsLast4, setWooCsLast4] = useState<string | null>(null);

  const [bostaCityDraft, setBostaCityDraft] = useState("");
  const [bostaZoneDraft, setBostaZoneDraft] = useState("");
  const [bostaBuildingDraft, setBostaBuildingDraft] = useState("");
  const [bostaAddressLineDraft, setBostaAddressLineDraft] = useState("");
  const [bostaPackageDescDraft, setBostaPackageDescDraft] = useState("");

  const wooWebhookUrl = useMemo(() => {
    const base = (appOrigin || "").replace(/\/$/, "");
    if (!base) return "";
    return `${base}/api/webhooks/woocommerce?tenant=${encodeURIComponent(tenantId)}`;
  }, [appOrigin, tenantId]);

  const wooDisplayUrl = useMemo(
    () => wooWebhookCanonical?.trim() || wooWebhookUrl,
    [wooWebhookCanonical, wooWebhookUrl],
  );

  useEffect(() => {
    setAppOrigin(
      typeof window !== "undefined" ? window.location.origin : "",
    );
  }, []);

  useEffect(() => {
    if (section !== "api") return;
    let cancelled = false;
    (async () => {
      setWooErr(null);
      setBostaErr(null);
      try {
        const res = await fetch("/api/settings/integrations", {
          headers: buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? res.statusText);
        const d = json.data as {
          serverPublicBaseUrl?: string;
          woocommerceWebhookUrl?: string;
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
        };
        if (!cancelled) {
          setWooWebhookCanonical(d.woocommerceWebhookUrl?.trim() || null);
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
        }
      } catch (e) {
        if (!cancelled)
          setWooErr(e instanceof Error ? e.message : "Could not load integrations");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [section, apiSecret, idToken, tenantId, userId, role]);

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
    const ck = wooCkDraft.trim();
    const cs = wooCsDraft.trim();
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
          woocommerce_consumer_key: ck,
          woocommerce_consumer_secret: cs,
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
      setWooCkDraft("");
      setWooCsDraft("");
      setWooCkLast4(d.woocommerceConsumerKeyLast4 ?? null);
      setWooCsLast4(d.woocommerceConsumerSecretLast4 ?? null);
      setWooMsg("WooCommerce REST keys saved. OMS will push order status to Woo.");
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
    if (advTab === "users" && !can(role, "user:read")) {
      setAdvTab("general");
    }
  }, [role, advTab]);

  useEffect(() => {
    if (section !== "advanced" || advTab !== "shipment") return;
    if (!can(role, "user:manage")) return;
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
        };
        if (!cancelled) {
          setAutoShip(d.auto_create_shipment);
          setShipStage(d.create_shipment_stage);
          setWhTemplate(
            d.whatsappMessageTemplate?.trim() ||
              defaultTenantAutomation.whatsappMessageTemplate ||
              "",
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
  }, [section, advTab, apiSecret, idToken, tenantId, userId, role]);

  useEffect(() => {
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
  }, [section, advTab, apiSecret, idToken, tenantId, userId, role]);

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

  async function saveAutomation() {
    setSettingsMsg(null);
    setSettingsErr(null);
    try {
      const res = await fetch("/api/settings/automation", {
        method: "PATCH",
        headers: buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
        body: JSON.stringify({
          auto_create_shipment: autoShip,
          create_shipment_stage: shipStage,
          whatsappMessageTemplate: whTemplate.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      if (json.data?.whatsappMessageTemplate) {
        setWhTemplate(json.data.whatsappMessageTemplate);
      }
      setSettingsMsg("Shipment automation & confirmation WhatsApp saved.");
    } catch (e) {
      setSettingsErr(e instanceof Error ? e.message : "Save failed");
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
        <nav className="flex flex-col gap-1 rounded-2xl bg-[color:var(--color-card)] p-2 shadow-[var(--shadow-neo-raised)] lg:sticky lg:top-4 lg:self-start">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              className={cn(
                "rounded-xl px-3 py-2.5 text-start text-sm font-medium transition-all",
                section === item.id
                  ? "border-s-[3px] border-[color:var(--color-primary)] bg-[color:var(--color-nav-active-bg)] text-[color:var(--color-primary)]"
                  : "border-s-[3px] border-transparent text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-hover-bg)]",
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
                    onClick={() => setSettingsMsg("Profile saved (local demo).")}
                  >
                    Save Changes
                  </Button>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2 flex items-center gap-4">
                    <div className="flex size-16 items-center justify-center rounded-2xl bg-[color:var(--color-muted-bg)] text-lg font-bold text-[color:var(--color-text-primary)] shadow-[var(--shadow-neo-inset)]">
                      {firstName[0]}
                      {lastName[0]}
                    </div>
                    <button
                      type="button"
                      className="text-sm font-medium text-[color:var(--color-primary)] hover:underline"
                    >
                      Change profile picture
                    </button>
                  </div>
                  <Input
                    label="First name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                  <Input
                    label="Last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-medium text-[color:var(--color-text-secondary)]">
                      Public bio
                    </label>
                    <textarea
                      className="min-h-[100px] w-full rounded-xl border-0 bg-[color:var(--color-input-bg)] p-3 text-sm text-[color:var(--color-text-primary)] shadow-[var(--shadow-neo-inset)] outline-none focus:ring-2 focus:ring-[color:var(--color-primary)] focus:ring-offset-1 focus:ring-offset-[color:var(--color-bg)]"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                    />
                  </div>
                  <Select
                    label="Timezone"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                  >
                    <option value="America/Los_Angeles">PST (UTC-8)</option>
                    <option value="Africa/Cairo">Africa/Cairo</option>
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">America/New_York</option>
                  </Select>
                  <Select
                    label="Preferred language"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                  >
                    <option value="en">English (US)</option>
                    <option value="ar">Arabic</option>
                  </Select>
                </CardContent>
              </Card>

              <Card className="border border-[color:var(--color-error)]/35 bg-[color:var(--color-error)]/5 shadow-[var(--shadow-neo-inset)]">
                <CardHeader>
                  <CardTitle className="text-[color:var(--color-error)]">
                    Danger zone
                  </CardTitle>
                  <p className="text-sm font-normal text-[color:var(--color-error)]">
                    Irreversible actions that affect your entire account access.
                  </p>
                </CardHeader>
                <CardContent className="rounded-xl border border-[color:var(--color-divider)] bg-[color:var(--color-card)] p-4 shadow-[var(--shadow-neo-raised-sm)]">
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
                    <span className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-muted)]">
                      Webhook delivery URL (paste in WooCommerce)
                    </span>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <code className="block flex-1 break-all rounded-xl bg-[color:var(--color-code-bg)] px-3 py-2 text-xs shadow-[var(--shadow-neo-inset)]">
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
                    <span className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-muted)]">
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
                    <span className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-muted)]">
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
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

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
                        : "No tenant key record (use Firebase sign-in or staff API key)."}
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
                      ). The SDK calls{" "}
                      <code className="rounded bg-[color:var(--color-code-bg)] px-1">
                        /api/v0
                      </code>{" "}
                      automatically.
                    </p>
                  </div>
                  <div className="space-y-3 border-t border-[color:var(--color-divider)] pt-4">
                    <span className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-muted)]">
                      Delivery address defaults (required for real AWBs)
                    </span>
                    <p className="text-xs text-[color:var(--color-text-muted)]">
                      Bosta needs a city code (e.g.{" "}
                      <code className="rounded bg-[color:var(--color-code-bg)] px-1">
                        EG-01
                      </code>
                      ) and zone. Use the Bosta dashboard or cities API; customer
                      street text from Woo fills{" "}
                      <strong>first line</strong> when present.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-[color:var(--color-text-muted)]">
                          Default city code
                        </label>
                        <Input
                          placeholder="EG-01"
                          value={bostaCityDraft}
                          onChange={(e) => setBostaCityDraft(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-[color:var(--color-text-muted)]">
                          Default zone
                        </label>
                        <Input
                          placeholder="District or zone name"
                          value={bostaZoneDraft}
                          onChange={(e) => setBostaZoneDraft(e.target.value)}
                        />
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
                    className="flex items-center justify-between gap-4 rounded-xl bg-[color:var(--color-bg-subtle)] p-4 shadow-[var(--shadow-neo-raised-sm)]"
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
              <div className="rounded-2xl bg-[color:var(--color-card)] p-2 shadow-[var(--shadow-neo-well)]">
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
                      className="min-h-[280px] w-full rounded-xl border-0 bg-[color:var(--color-input-bg)] p-3 font-mono text-xs text-[color:var(--color-text-primary)] shadow-[var(--shadow-neo-inset)] outline-none focus:ring-2 focus:ring-[color:var(--color-primary)] focus:ring-offset-1 focus:ring-offset-[color:var(--color-bg)]"
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

              {advTab === "shipment" && can(role, "user:manage") && (
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
                        رسالة واتساب الافتراضية (فريق التأكيد) — {`{name}`}،{" "}
                        {`{orderId}`}، {`{awb}`}
                      </span>
                      <textarea
                        className="min-h-[100px] w-full rounded-xl border-0 bg-[color:var(--color-input-bg)] p-3 text-sm text-[color:var(--color-text-primary)] shadow-[var(--shadow-neo-inset)] outline-none focus:ring-2 focus:ring-[color:var(--color-primary)]"
                        value={whTemplate}
                        onChange={(e) => setWhTemplate(e.target.value)}
                        placeholder="مثال: مرحباً {name} — طلب {orderId}"
                        spellCheck={false}
                      />
                    </div>
                    <Button type="button" onClick={() => void saveAutomation()}>
                      حفظ الأتمتة وواتساب التأكيد
                    </Button>
                  </CardContent>
                </Card>
              )}

              {advTab === "shipment" && can(role, "user:manage") && (
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

              {advTab === "users" && can(role, "user:read") ? (
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
                      <div className="sm:col-span-2 rounded-xl border-0 bg-[color:var(--color-dev-badge-bg)] p-3 text-sm text-[color:var(--color-dev-badge-text)] shadow-[var(--shadow-neo-raised-sm)]">
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
