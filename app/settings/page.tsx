"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { useSessionStore, buildAuthHeaders } from "@/store/zustand/session-store";
import {
  useThemeStore,
  type ThemePreference,
} from "@/store/zustand/theme-store";
import { defaultKanbanSettings } from "@/lib/kanban/column";

type TabId =
  | "general"
  | "kanban"
  | "shipment"
  | "payment"
  | "integrations"
  | "developer";

const tabs: { id: TabId; label: string }[] = [
  { id: "general", label: "عام" },
  { id: "kanban", label: "Kanban" },
  { id: "shipment", label: "الشحن" },
  { id: "payment", label: "الدفع" },
  { id: "integrations", label: "التكاملات" },
  { id: "developer", label: "المطور" },
];

export default function SettingsPage() {
  const apiSecret = useSessionStore((s) => s.apiSecret);
  const tenantId = useSessionStore((s) => s.tenantId);
  const userId = useSessionStore((s) => s.userId);
  const role = useSessionStore((s) => s.role);
  const setSession = useSessionStore((s) => s.setSession);
  const themePreference = useThemeStore((s) => s.themePreference);
  const setThemePreference = useThemeStore((s) => s.setThemePreference);

  const [tab, setTab] = useState<TabId>("general");
  const [autoShip, setAutoShip] = useState(false);
  const [shipStage, setShipStage] = useState<"confirmed" | "invoiced">(
    "confirmed",
  );
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);
  const [settingsErr, setSettingsErr] = useState<string | null>(null);
  const [mockDataOn, setMockDataOn] = useState(false);
  const [kanbanJson, setKanbanJson] = useState("");
  const [kanbanErr, setKanbanErr] = useState<string | null>(null);

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
    if (tab !== "shipment") return;
    let cancelled = false;
    (async () => {
      setSettingsErr(null);
      try {
        const res = await fetch("/api/settings/automation", {
          headers: buildAuthHeaders({ apiSecret, tenantId, userId, role }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? res.statusText);
        const d = json.data as {
          auto_create_shipment: boolean;
          create_shipment_stage: "confirmed" | "invoiced";
        };
        if (!cancelled) {
          setAutoShip(d.auto_create_shipment);
          setShipStage(d.create_shipment_stage);
        }
      } catch (e) {
        if (!cancelled)
          setSettingsErr(
            e instanceof Error ? e.message : "تعذر تحميل الإعدادات",
          );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, apiSecret, tenantId, userId, role]);

  useEffect(() => {
    if (tab !== "kanban") return;
    let cancelled = false;
    (async () => {
      setKanbanErr(null);
      try {
        const res = await fetch("/api/settings/kanban", {
          headers: buildAuthHeaders({ apiSecret, tenantId, userId, role }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? res.statusText);
        const cols = (json.data as { columns: unknown }).columns;
        if (!cancelled) setKanbanJson(JSON.stringify(cols, null, 2));
      } catch (e) {
        if (!cancelled)
          setKanbanErr(e instanceof Error ? e.message : "تعذر التحميل");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, apiSecret, tenantId, userId, role]);

  async function saveKanban() {
    setSettingsMsg(null);
    setSettingsErr(null);
    setKanbanErr(null);
    try {
      const columns = JSON.parse(kanbanJson) as unknown;
      if (!Array.isArray(columns)) throw new Error("يجب أن يكون المصفوفة أعمدة");
      const res = await fetch("/api/settings/kanban", {
        method: "PATCH",
        headers: buildAuthHeaders({ apiSecret, tenantId, userId, role }),
        body: JSON.stringify({ columns }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setKanbanJson(JSON.stringify(json.data.columns, null, 2));
      setSettingsMsg("تم حفظ إعدادات Kanban.");
    } catch (e) {
      const m = e instanceof Error ? e.message : "فشل الحفظ";
      if (m.includes("JSON")) setKanbanErr("JSON غير صالح");
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
        headers: buildAuthHeaders({ apiSecret, tenantId, userId, role }),
        body: JSON.stringify({
          auto_create_shipment: autoShip,
          create_shipment_stage: shipStage,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setSettingsMsg("تم حفظ إعدادات الشحن.");
    } catch (e) {
      setSettingsErr(e instanceof Error ? e.message : "فشل الحفظ");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="الإعدادات"
        description="إعدادات المستأجر، التكاملات، وجلسة التطوير."
      />

      <div className="border-b border-[color:var(--color-border)] pb-3">
        <Tabs
          items={tabs}
          value={tab}
          onChange={(id) => setTab(id as TabId)}
        />
      </div>

      {tab === "kanban" && (
        <Card>
          <CardHeader>
            <CardTitle>تخطيط Kanban</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-[color:var(--color-text-primary)]">
            <p className="text-[color:var(--color-text-secondary)]">
              حرّر مصفوفة JSON للأعمدة: كل عمود يحتوي{" "}
              <code className="rounded border border-[color:var(--color-code-border)] bg-[color:var(--color-code-bg)] px-1 text-xs">
                id
              </code>
              ،{" "}
              <code className="rounded border border-[color:var(--color-code-border)] bg-[color:var(--color-code-bg)] px-1 text-xs">
                title
              </code>
              ،{" "}
              <code className="rounded border border-[color:var(--color-code-border)] bg-[color:var(--color-code-bg)] px-1 text-xs">
                statuses
              </code>{" "}
              (قائمة حالات الطلب)، واختياري{" "}
              <code className="rounded border border-[color:var(--color-code-border)] bg-[color:var(--color-code-bg)] px-1 text-xs">
                cardFields
              </code>
              : customer | total | payment | status | assigned | woo
            </p>
            {kanbanErr ? (
              <p className="text-sm text-[color:var(--color-error)]">{kanbanErr}</p>
            ) : null}
            {settingsMsg && tab === "kanban" ? (
              <p className="text-sm text-[color:var(--color-success)]">{settingsMsg}</p>
            ) : null}
            {settingsErr && tab === "kanban" ? (
              <p className="text-sm text-[color:var(--color-error)]">{settingsErr}</p>
            ) : null}
            <textarea
              className="min-h-[280px] w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-3 font-mono text-xs text-[color:var(--color-text-primary)] outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20"
              value={kanbanJson}
              onChange={(e) => setKanbanJson(e.target.value)}
              spellCheck={false}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={saveKanban}>
                حفظ Kanban
              </Button>
              <Button type="button" variant="secondary" onClick={resetKanbanDefault}>
                تعبئة افتراضي (محلياً)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "general" && (
        <Card>
          <CardHeader>
            <CardTitle>عام</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-[color:var(--color-text-primary)]">
            <p>
              المستأجر الحالي:{" "}
              <span className="font-mono font-medium">{tenantId}</span>
            </p>
            <p>اتجاه الواجهة: RTL (عربي).</p>
            <Select
              label="المظهر"
              value={themePreference}
              onChange={(e) =>
                setThemePreference(e.target.value as ThemePreference)
              }
            >
              <option value="dark">داكن</option>
              <option value="light">فاتح</option>
              <option value="system">حسب النظام</option>
            </Select>
          </CardContent>
        </Card>
      )}

      {tab === "shipment" && (
        <Card>
          <CardHeader>
            <CardTitle>أتمتة الشحن</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {settingsErr ? (
              <p className="text-sm text-[color:var(--color-error)]">{settingsErr}</p>
            ) : null}
            {settingsMsg ? (
              <p className="text-sm text-[color:var(--color-success)]">{settingsMsg}</p>
            ) : null}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoShip}
                onChange={(e) => setAutoShip(e.target.checked)}
              />
              إنشاء شحنة تلقائياً
            </label>
            <div className="space-y-1">
              <span className="text-xs font-medium text-[color:var(--color-text-secondary)]">
                مرحلة الإنشاء
              </span>
              <Select
                value={shipStage}
                onChange={(e) =>
                  setShipStage(e.target.value as "confirmed" | "invoiced")
                }
              >
                <option value="confirmed">بعد التأكيد</option>
                <option value="invoiced">بعد الفوترة (جاهز للمخزن)</option>
              </Select>
            </div>
            <Button type="button" onClick={saveAutomation}>
              حفظ
            </Button>
          </CardContent>
        </Card>
      )}

      {tab === "payment" && (
        <Card>
          <CardHeader>
            <CardTitle>الدفع</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-[color:var(--color-text-secondary)]">
            إعدادات بوابات الدفع وربطها بووكومرس ستضاف لاحقاً. حالياً يتم
            استيراد حالة الدفع من الطلبات الواردة.
          </CardContent>
        </Card>
      )}

      {tab === "integrations" && (
        <Card>
          <CardHeader>
            <CardTitle>التكاملات</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-[color:var(--color-text-primary)]">
            <p>
              Webhook ووكومرس:{" "}
              <code className="rounded border border-[color:var(--color-code-border)] bg-[color:var(--color-code-bg)] px-1 text-xs">
                POST /api/webhooks/woocommerce?tenant=
                {tenantId}
              </code>
            </p>
            <p>
              عرّف{" "}
              <code className="rounded border border-[color:var(--color-code-border)] bg-[color:var(--color-code-bg)] px-1">
                WOOCOMMERCE_WEBHOOK_SECRET
              </code>{" "}
              في البيئة للتحقق من التوقيع.
            </p>
            <p>
              Bosta: عيّن{" "}
              <code className="rounded border border-[color:var(--color-code-border)] bg-[color:var(--color-code-bg)] px-1">
                BOSTA_API_KEY
              </code>{" "}
              لاستخدام الـ API الحقيقي؛ بدون مفتاح يُستخدم AWB وهمي.
            </p>
          </CardContent>
        </Card>
      )}

      {tab === "developer" && (
        <Card>
          <CardHeader>
            <CardTitle>جلسة API (تطوير)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {mockDataOn ? (
              <div className="sm:col-span-2 rounded-lg border border-[color:var(--color-dev-badge-border)] bg-[color:var(--color-dev-badge-bg)] p-3 text-sm text-[color:var(--color-dev-badge-text)]">
                <strong>بيانات وهمية مفعّلة:</strong> عيّن{" "}
                <code className="rounded border border-[color:var(--color-code-border)] bg-[color:var(--color-code-bg)] px-1 text-[color:var(--color-text-primary)]">
                  DEV_MOCK_DATA=true
                </code>{" "}
                في{" "}
                <code className="rounded border border-[color:var(--color-code-border)] bg-[color:var(--color-code-bg)] px-1 text-[color:var(--color-text-primary)]">
                  .env.local
                </code>
                . الـ API يستخدم ذاكرة محلية (طلبات، مستخدمون، تذاكر، شحن) دون
                Firestore. استخدم المستأجر{" "}
                <code className="rounded border border-[color:var(--color-code-border)] bg-[color:var(--color-code-bg)] px-1 text-[color:var(--color-text-primary)]">
                  default
                </code>{" "}
                لرؤية البيانات الجاهزة. جرّب مسح AWB:{" "}
                <code className="rounded border border-[color:var(--color-code-border)] bg-[color:var(--color-code-bg)] px-1 text-[color:var(--color-text-primary)]">
                  MOCK-DEMO-001
                </code>{" "}
                أو{" "}
                <code className="rounded border border-[color:var(--color-code-border)] bg-[color:var(--color-code-bg)] px-1 text-[color:var(--color-text-primary)]">
                  MOCK-DEMO-002
                </code>
                .
              </div>
            ) : (
              <p className="sm:col-span-2 text-sm text-[color:var(--color-text-secondary)]">
                لتفعيل البيانات الوهمية أضف{" "}
                <code className="rounded border border-[color:var(--color-code-border)] bg-[color:var(--color-code-bg)] px-1">
                  DEV_MOCK_DATA=true
                </code>{" "}
                ثم أعد تشغيل الخادم.
              </p>
            )}
            <div className="space-y-1">
              <label className="text-xs text-[color:var(--color-text-secondary)]">OMS_API_SECRET</label>
              <Input
                type="password"
                value={apiSecret}
                onChange={(e) => setSession({ apiSecret: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[color:var(--color-text-secondary)]">X-Tenant-Id</label>
              <Input
                value={tenantId}
                onChange={(e) => setSession({ tenantId: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[color:var(--color-text-secondary)]">X-User-Id</label>
              <Input
                value={userId}
                onChange={(e) => setSession({ userId: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[color:var(--color-text-secondary)]">X-User-Role</label>
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
              تُستخدم هذه القيم في ترويسات طلبات الواجهة نحو{" "}
              <code className="rounded border border-[color:var(--color-code-border)] bg-[color:var(--color-code-bg)] px-1">
                /api/*
              </code>
              . في الإنتاج استبدلها بمصادقة حقيقية.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
