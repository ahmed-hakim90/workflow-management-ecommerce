"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { OrderActionsPanel } from "@/components/orders/order-detail/order-actions-panel";
import { OrderInfoSection } from "@/components/orders/order-detail/order-info-section";
import { OrderLinkedEntities } from "@/components/orders/order-detail/order-linked-entities";
import { OrderSummaryCards } from "@/components/orders/order-detail/order-summary-cards";
import { OrderTimeline } from "@/components/orders/order-detail/order-timeline";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { OrderDetailSkeleton } from "@/components/ui/skeleton";
import { can } from "@/lib/auth/rbac";
import { defaultTenantAutomation } from "@/lib/types/models";
import type { ActivityLog, Order, OrderEvent, Shipment, User } from "@/lib/types/models";
import { buildAuthHeaders, useSessionStore } from "@/store/zustand/session-store";

type Bundle = { order: Order; shipments: Shipment[] };

function displayOrderId(order: Order) {
  return order.wooCommerceOrderId?.trim() || order.id.slice(0, 8).toUpperCase();
}

function formatWhen(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ar-EG", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const apiSecret = useSessionStore((state) => state.apiSecret);
  const idToken = useSessionStore((state) => state.idToken);
  const tenantId = useSessionStore((state) => state.tenantId);
  const userId = useSessionStore((state) => state.userId);
  const role = useSessionStore((state) => state.role);
  const permissions = useSessionStore((state) => state.permissions);
  const authReady = useSessionStore((state) => state.authReady);

  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [chatTimeline, setChatTimeline] = useState<OrderEvent[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [statusNeighbors, setStatusNeighbors] = useState<{
    prevId: string | null;
    nextId: string | null;
  }>({ prevId: null, nextId: null });
  const [whatsappTemplate, setWhatsappTemplate] = useState(
    defaultTenantAutomation.whatsappMessageTemplate!,
  );
  const [orderLinkTemplate, setOrderLinkTemplate] = useState("");

  const headers = useMemo(
    () => buildAuthHeaders({ apiSecret, idToken, tenantId, userId, role }),
    [apiSecret, idToken, role, tenantId, userId],
  );

  const subject = useMemo(() => ({ role, permissions }), [permissions, role]);
  const canViewFinance = can(subject, "finance:view");

  const userName = useCallback(
    (id: string) => users.find((user) => user.id === id)?.name ?? id,
    [users],
  );

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    setStatusNeighbors({ prevId: null, nextId: null });
    try {
      const [bundleRes, activityRes, usersRes, whatsappRes, neighborsRes, chatRes] =
        await Promise.all([
          fetch(`/api/orders/${encodeURIComponent(orderId)}`, { headers }),
          fetch(
            `/api/activity?entityType=order&entityId=${encodeURIComponent(orderId)}&limit=80`,
            { headers },
          ),
          fetch("/api/users", { headers }),
          fetch("/api/settings/confirmation-whatsapp", { headers }),
          fetch(`/api/orders/${encodeURIComponent(orderId)}/neighbors`, { headers }),
          fetch(
            `/api/orders/${encodeURIComponent(orderId)}/events?prefix=${encodeURIComponent("chat.")}&limit=60`,
            { headers },
          ),
        ]);

      const bundleJson = await bundleRes.json();
      const activityJson = await activityRes.json();
      const usersJson = await usersRes.json();
      if (!bundleRes.ok) throw new Error(bundleJson.error ?? bundleRes.statusText);
      if (!activityRes.ok) throw new Error(activityJson.error ?? activityRes.statusText);
      if (!usersRes.ok) throw new Error(usersJson.error ?? usersRes.statusText);

      setBundle(bundleJson.data as Bundle);
      setActivities(activityJson.data as ActivityLog[]);
      setUsers(usersJson.data as User[]);

      if (neighborsRes.ok) {
        const neighborsJson = (await neighborsRes.json()) as {
          data?: { prevId: string | null; nextId: string | null };
        };
        setStatusNeighbors(neighborsJson.data ?? { prevId: null, nextId: null });
      }

      if (chatRes.ok) {
        const chatJson = (await chatRes.json()) as { data?: OrderEvent[] };
        setChatTimeline(chatJson.data ?? []);
      } else {
        setChatTimeline([]);
      }

      if (whatsappRes.ok) {
        const whatsappJson = (await whatsappRes.json()) as {
          data?: {
            whatsappMessageTemplate?: string;
            orderLinkTemplate?: string;
          };
        };
        setWhatsappTemplate(
          whatsappJson.data?.whatsappMessageTemplate ||
            defaultTenantAutomation.whatsappMessageTemplate!,
        );
        setOrderLinkTemplate(whatsappJson.data?.orderLinkTemplate?.trim() ?? "");
      } else {
        setWhatsappTemplate(defaultTenantAutomation.whatsappMessageTemplate!);
        setOrderLinkTemplate("");
      }
    } catch (error) {
      setErr(error instanceof Error ? error.message : "خطأ");
      setBundle(null);
      setActivities([]);
      setChatTimeline([]);
      setStatusNeighbors({ prevId: null, nextId: null });
    } finally {
      setLoading(false);
    }
  }, [headers, orderId]);

  useEffect(() => {
    if (!authReady) return;
    void load();
  }, [authReady, load]);

  const order = bundle?.order;
  const shipments = bundle?.shipments ?? [];
  const displayId = order ? displayOrderId(order) : orderId.slice(0, 8).toUpperCase();
  const whatsappUser =
    order?.whatsappSentByUserName?.trim() || order?.whatsappSentByUserId?.trim();

  const { prevId, nextId } = statusNeighbors;

  function goOrder(targetId: string) {
    router.push(`/orders/${targetId}`);
  }

  function onDeleted() {
    const navigateTo = statusNeighbors.nextId ?? statusNeighbors.prevId ?? null;
    router.push(navigateTo ? `/orders/${navigateTo}` : "/orders");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={loading ? "تفاصيل الطلب" : `طلب #${displayId}`}
        description={
          loading
            ? "تحميل بيانات الطلب، العميل، الدفع، الشحن وسجل الإجراءات."
            : `آخر تحديث: ${formatWhen(order?.updatedAt)}`
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/orders">
              <Button type="button" variant="secondary" size="sm">
                <ArrowLeft className="size-4" aria-hidden />
                القائمة
              </Button>
            </Link>
            {prevId ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => goOrder(prevId)}
              >
                <ChevronRight className="size-4" aria-hidden />
                السابق
              </Button>
            ) : null}
            {nextId ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => goOrder(nextId)}
              >
                التالي
                <ChevronLeft className="size-4" aria-hidden />
              </Button>
            ) : null}
          </div>
        }
      />

      {!loading && err ? (
        <p className="rounded-[var(--ds-radius-md)] border border-[color:var(--color-error)]/25 bg-[color:var(--color-error)]/12 p-3 text-sm text-[color:var(--color-error)] shadow-none">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p className="rounded-[var(--ds-radius-md)] border border-[color:var(--color-callout-success-border)] bg-[color:var(--color-callout-success-bg)] p-3 text-sm text-[color:var(--color-callout-success-text)] shadow-none">
          {msg}
        </p>
      ) : null}

      {loading ? (
        <OrderDetailSkeleton />
      ) : order ? (
        <>
          <OrderActionsPanel
            order={order}
            shipments={shipments}
            users={users}
            headers={headers}
            subject={subject}
            whatsappTemplate={whatsappTemplate}
            orderLinkTemplate={orderLinkTemplate}
            onReload={load}
            onDeleted={onDeleted}
            onMessage={setMsg}
            onError={setErr}
          />

          <OrderSummaryCards
            order={order}
            shipments={shipments}
            canViewFinance={canViewFinance}
          />

          <OrderLinkedEntities
            order={order}
            shipments={shipments}
            users={users}
            headers={headers}
            subject={subject}
            canViewFinance={canViewFinance}
            onReload={load}
            onMessage={setMsg}
            onError={setErr}
          />

          <OrderInfoSection
            order={order}
            canViewFinance={canViewFinance}
            whatsappUser={whatsappUser}
            userName={userName}
          />

          <OrderTimeline
            events={chatTimeline}
            activities={activities}
            userName={userName}
          />
        </>
      ) : null}
    </div>
  );
}
