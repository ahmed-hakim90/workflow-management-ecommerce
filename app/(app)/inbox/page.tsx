"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSessionStore, buildAuthHeaders } from "@/store/zustand/session-store";
import { can } from "@/lib/auth/rbac";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { ChatConversation, InboxListFilter } from "@/lib/types/chat";
import type { ChatMessage } from "@/lib/types/chat";
import type { MessageTemplate } from "@/lib/types/chat";
import { CONVERSATION_TAG_PRESETS } from "@/lib/types/chat";
import { cn } from "@/lib/ui/cn";
import { WhatsAppMediaPreview } from "@/components/inbox/whatsapp-media-preview";

function messageMeta(m: ChatMessage): Record<string, unknown> {
  const v = m.metadata;
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return {};
}

type OrderSummary = {
  id: string;
  status: string;
  customer: { name?: string; phone?: string };
  payment: { total_amount: number };
  wooCommerceOrderId?: string;
};

type AgentStatsPayload = {
  since: string;
  until: string;
  sampleSize: number;
  staffRepliesByUser: Record<string, number>;
  takeoversByUser: Record<string, number>;
  automationConfirms: number;
  avgReplyMsByUser: Record<string, number>;
  userNames: Record<string, string>;
};

const FILTERS: { id: InboxListFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "mine", label: "Assigned to me" },
  { id: "bot", label: "Bot active" },
  { id: "needs_human", label: "Needs human" },
  { id: "closed", label: "Closed" },
];

function inboxSlaBadge(c: ChatConversation): {
  label: string;
  tone: "info" | "warning" | "error";
} | null {
  if (c.slaBreached || c.slaBreachedAt) {
    return { label: "SLA breached", tone: "error" };
  }
  const due = c.slaFirstResponseDueAt;
  if (!due) return null;
  const end = new Date(due).getTime();
  if (Number.isNaN(end)) return null;
  const now = Date.now();
  if (end < now) {
    return { label: "First response overdue", tone: "warning" };
  }
  const mins = Math.ceil((end - now) / 60000);
  if (mins < 120) {
    return { label: `SLA ${mins}m`, tone: "info" };
  }
  const h = Math.ceil(mins / 60);
  return { label: `SLA ${h}h`, tone: "info" };
}

async function postJson(url: string, headers: Record<string, string>, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as {
    data?: unknown;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(json.error || res.statusText);
  }
  return json.data;
}

export default function InboxPage() {
  const { dir } = useLocale();
  const session = useSessionStore();
  const headers = useMemo(() => buildAuthHeaders(session), [session]);
  const subject = useMemo(
    () => ({ role: session.role, permissions: session.permissions }),
    [session.role, session.permissions],
  );
  const canWrite = can(subject, "inbox:write");
  const canManage = can(subject, "inbox:manage");
  const isWarehouse = session.role === "warehouse";

  const [filter, setFilter] = useState<InboxListFilter>("all");
  const [warehouseOrderId, setWarehouseOrderId] = useState("");
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    conversation: ChatConversation;
    order: OrderSummary | null;
  } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [msgCursor, setMsgCursor] = useState<string | null>(null);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [composer, setComposer] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [agentStats, setAgentStats] = useState<AgentStatsPayload | null>(null);
  const [tagDraft, setTagDraft] = useState("");
  const [phoneDraft, setPhoneDraft] = useState("");
  const [deptDraft, setDeptDraft] = useState("");
  const [phoneQ, setPhoneQ] = useState("");
  const [deptQ, setDeptQ] = useState("");
  const [listNextCursor, setListNextCursor] = useState<string | null>(null);
  const listCursorRef = useRef<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [departmentEdit, setDepartmentEdit] = useState("");

  useEffect(() => {
    listCursorRef.current = listNextCursor;
  }, [listNextCursor]);

  const templatesByCategory = useMemo(() => {
    const m = new Map<string, MessageTemplate[]>();
    for (const t of templates) {
      const k = (t.category?.trim() || "general").toLowerCase();
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(t);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [templates]);

  const filterCounts = useMemo<Record<InboxListFilter, number>>(() => {
    const mineUserId = session.userId;
    return {
      all: conversations.length,
      unread: conversations.filter((c) => c.hasUnread || c.unreadCount > 0)
        .length,
      mine: conversations.filter((c) => c.assignedUserId === mineUserId)
        .length,
      bot: conversations.filter((c) => c.status === "bot_active" || c.botEnabled)
        .length,
      needs_human: conversations.filter(
        (c) => c.status === "human_takeover" || c.humanTakeover,
      ).length,
      closed: conversations.filter((c) => c.status === "closed").length,
    };
  }, [conversations, session.userId]);

  const loadList = useCallback(
    async (opts?: { append?: boolean }) => {
      const append = opts?.append ?? false;
      setErr(null);
      if (!append) {
        setLoadingList(true);
        setListNextCursor(null);
      } else {
        setLoadingMore(true);
      }
      try {
        if (isWarehouse && warehouseOrderId.trim()) {
          let url = `/api/inbox/conversations?filter=${encodeURIComponent(filter)}`;
          url += `&linkedOrderId=${encodeURIComponent(warehouseOrderId.trim())}`;
          const res = await fetch(url, { headers });
          const json = (await res.json()) as { data?: ChatConversation[] };
          if (!res.ok) throw new Error("Failed to load conversations");
          setConversations(json.data ?? []);
          setListNextCursor(null);
          return;
        }

        const qs = new URLSearchParams();
        qs.set("filter", filter);
        qs.set("limit", "40");
        const p = phoneQ.trim();
        const d = deptQ.trim();
        if (p) qs.set("phoneContains", p);
        if (d) qs.set("department", d);
        if (append && listCursorRef.current && !p && !d) {
          qs.set("cursor", listCursorRef.current);
        }
        const res = await fetch(`/api/inbox/conversations?${qs}`, { headers });
        const json = (await res.json()) as {
          data?: { conversations: ChatConversation[]; nextCursor: string | null };
        };
        if (!res.ok) throw new Error("Failed to load conversations");
        const payload = json.data ?? { conversations: [], nextCursor: null };
        setConversations((prev) =>
          append ? [...prev, ...payload.conversations] : payload.conversations,
        );
        setListNextCursor(payload.nextCursor ?? null);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Error");
        if (!append) {
          setConversations([]);
          setListNextCursor(null);
        }
      } finally {
        if (!append) setLoadingList(false);
        else setLoadingMore(false);
      }
    },
    [filter, headers, isWarehouse, warehouseOrderId, phoneQ, deptQ],
  );

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (loadingList || loadingMore) return;
      void loadList();
    }, 45_000);
    return () => window.clearInterval(id);
  }, [loadList, loadingList, loadingMore]);

  useEffect(() => {
    setDepartmentEdit(detail?.conversation.department?.trim() ?? "");
  }, [detail?.conversation.department, detail?.conversation.id]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/inbox/agent-stats?days=7", { headers });
        const json = (await res.json()) as { data?: AgentStatsPayload };
        if (res.ok) setAgentStats(json.data ?? null);
      } catch {
        setAgentStats(null);
      }
    })();
  }, [headers]);

  useEffect(() => {
    if (!canWrite) return;
    void (async () => {
      try {
        const res = await fetch("/api/inbox/templates", { headers });
        const json = (await res.json()) as { data?: MessageTemplate[] };
        if (res.ok) setTemplates(json.data ?? []);
      } catch {
        /* ignore */
      }
    })();
  }, [headers, canWrite]);

  const loadMessages = useCallback(
    async (conversationId: string, cursor?: string | null) => {
      const qs = new URLSearchParams({ limit: "40" });
      if (cursor) qs.set("cursor", cursor);
      const res = await fetch(
        `/api/inbox/conversations/${conversationId}/messages?${qs}`,
        { headers },
      );
      const json = (await res.json()) as {
        data?: { messages: ChatMessage[]; nextCursor: string | null };
      };
      if (!res.ok) throw new Error("messages");
      return json.data!;
    },
    [headers],
  );

  const openConversation = useCallback(
    async (id: string) => {
      setSelectedId(id);
      setErr(null);
      try {
        const res = await fetch(`/api/inbox/conversations/${id}`, { headers });
        const json = (await res.json()) as {
          data?: {
            conversation: ChatConversation;
            order: OrderSummary | null;
          };
        };
        if (!res.ok) throw new Error("detail");
        setDetail(json.data ?? null);
        const page = await loadMessages(id, null);
        setMessages(page.messages);
        setMsgCursor(page.nextCursor);
        await postJson(`/api/inbox/conversations/${id}/read`, headers, {});
        void loadList();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Error");
      }
    },
    [headers, loadList, loadMessages],
  );

  async function loadOlder() {
    if (!selectedId || !msgCursor) return;
    try {
      const page = await loadMessages(selectedId, msgCursor);
      setMessages((prev) => [...prev, ...page.messages]);
      setMsgCursor(page.nextCursor);
    } catch {
      /* ignore */
    }
  }

  async function addInternalNote() {
    if (!selectedId || !internalNote.trim() || !canWrite) return;
    setNoteSaving(true);
    setErr(null);
    try {
      await postJson(`/api/inbox/conversations/${selectedId}/notes`, headers, {
        body: internalNote.trim(),
      });
      setInternalNote("");
      const page = await loadMessages(selectedId, null);
      setMessages(page.messages);
      setMsgCursor(page.nextCursor);
      void loadList();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Note failed");
    } finally {
      setNoteSaving(false);
    }
  }

  async function sendMessage() {
    if (!selectedId || !composer.trim() || !canWrite) return;
    setSending(true);
    setErr(null);
    try {
      await postJson("/api/whatsapp/send-message", headers, {
        conversationId: selectedId,
        body: composer.trim(),
      });
      setComposer("");
      const page = await loadMessages(selectedId, null);
      setMessages(page.messages);
      setMsgCursor(page.nextCursor);
      void loadList();
      const res = await fetch(`/api/inbox/conversations/${selectedId}`, {
        headers,
      });
      const json = (await res.json()) as {
        data?: {
          conversation: ChatConversation;
          order: OrderSummary | null;
        };
      };
      if (res.ok) setDetail(json.data ?? null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  async function patchConversation(body: Record<string, unknown>) {
    if (!selectedId) return;
    setErr(null);
    try {
      const res = await fetch(`/api/inbox/conversations/${selectedId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Update failed");
      await openConversation(selectedId);
      void loadList();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Update failed");
    }
  }

  function toggleConversationTag(label: string) {
    if (!detail || !canWrite) return;
    const cur = detail.conversation.tags ?? [];
    const lower = label.trim().toLowerCase();
    const has = cur.some((x) => x.toLowerCase() === lower);
    const next = has
      ? cur.filter((x) => x.toLowerCase() !== lower)
      : [...cur, label.trim()];
    void patchConversation({ tags: next });
  }

  function addCustomConversationTag() {
    const label = tagDraft.trim();
    if (!detail || !canWrite || !label) return;
    const cur = detail.conversation.tags ?? [];
    if (cur.some((x) => x.toLowerCase() === label.toLowerCase())) return;
    void patchConversation({ tags: [...cur, label] });
    setTagDraft("");
  }

  return (
    <div dir={dir} className="flex min-h-0 flex-1 flex-col gap-4">
      <PageHeader title="Inbox" description="WhatsApp conversations and replies." />

      {agentStats && agentStats.sampleSize > 0 ? (
        <Card>
          <CardContent className="space-y-3 py-4 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold text-[color:var(--color-text-primary)]">
                Agent activity (7 days)
              </h2>
              <span className="text-xs text-[color:var(--color-text-muted)]">
                {agentStats.sampleSize} order events in sample · n8n confirms:{" "}
                {agentStats.automationConfirms}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-xs">
                <thead>
                  <tr className="border-b border-[color:var(--color-border-subtle)] text-[color:var(--color-text-muted)]">
                    <th className="py-2 pe-3 font-medium">Agent</th>
                    <th className="py-2 pe-3 font-medium">Staff replies</th>
                    <th className="py-2 pe-3 font-medium">Takeovers</th>
                    <th className="py-2 font-medium">Avg reply time</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(
                    new Set([
                      ...Object.keys(agentStats.staffRepliesByUser),
                      ...Object.keys(agentStats.takeoversByUser),
                      ...Object.keys(agentStats.avgReplyMsByUser),
                    ]),
                  )
                    .sort(
                      (a, b) =>
                        (agentStats.staffRepliesByUser[b] ?? 0) -
                        (agentStats.staffRepliesByUser[a] ?? 0),
                    )
                    .map((uid) => (
                      <tr
                        key={uid}
                        className="border-b border-[color:var(--color-border-subtle)]"
                      >
                        <td className="py-2 pe-3">
                          {agentStats.userNames[uid] ?? uid}
                        </td>
                        <td className="py-2 pe-3 tabular-nums">
                          {agentStats.staffRepliesByUser[uid] ?? 0}
                        </td>
                        <td className="py-2 pe-3 tabular-nums">
                          {agentStats.takeoversByUser[uid] ?? 0}
                        </td>
                        <td className="py-2 tabular-nums text-[color:var(--color-text-secondary)]">
                          {agentStats.avgReplyMsByUser[uid] != null
                            ? `${Math.round((agentStats.avgReplyMsByUser[uid] ?? 0) / 60000)}m`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {isWarehouse && (
        <Card>
          <CardContent className="space-y-2 py-4 text-sm">
            <p className="text-[color:var(--color-text-muted)]">
              Warehouse: enter an order ID to load linked conversations.
            </p>
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="Order ID"
                value={warehouseOrderId}
                onChange={(e) => setWarehouseOrderId(e.target.value)}
                className="max-w-xs"
              />
              <Button type="button" variant="secondary" onClick={() => void loadList()}>
                Load
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.id}
            type="button"
            size="sm"
            variant={filter === f.id ? "primary" : "secondary"}
            onClick={() => setFilter(f.id)}
          >
            <span>{f.label}</span>
            <span className="ms-1 rounded-full bg-[color:var(--color-muted-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[color:var(--color-text-muted)]">
              {filterCounts[f.id]}
            </span>
          </Button>
        ))}
      </div>

      {!isWarehouse ? (
        <Card>
          <CardContent className="flex flex-wrap items-end gap-2 py-3">
            <div className="flex min-w-[140px] flex-1 flex-col gap-1">
              <span className="text-[10px] font-medium text-[color:var(--color-text-muted)]">
                Phone contains
              </span>
              <Input
                placeholder="e.g. +2010"
                value={phoneDraft}
                onChange={(e) => setPhoneDraft(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="flex min-w-[120px] flex-1 flex-col gap-1">
              <span className="text-[10px] font-medium text-[color:var(--color-text-muted)]">
                Department
              </span>
              <Input
                placeholder="e.g. shipping"
                value={deptDraft}
                onChange={(e) => setDeptDraft(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              className="h-9"
              onClick={() => {
                setPhoneQ(phoneDraft.trim());
                setDeptQ(deptDraft.trim());
              }}
            >
              Apply filters
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {err && (
        <p className="text-sm text-red-600" role="alert">
          {err}
        </p>
      )}

      <div className="grid min-h-[480px] flex-1 gap-4 lg:grid-cols-[minmax(280px,340px)_1fr]">
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <CardContent className="flex min-h-0 flex-1 flex-col gap-0 p-0">
            <div className="border-b border-[color:var(--color-border-subtle)] px-3 py-2 text-xs font-medium text-[color:var(--color-text-muted)]">
              Conversations
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {loadingList ? (
                <p className="p-3 text-sm text-[color:var(--color-text-muted)]">
                  Loading…
                </p>
              ) : conversations.length === 0 ? (
                <p className="p-3 text-sm text-[color:var(--color-text-muted)]">
                  No conversations.
                </p>
              ) : (
                conversations.map((c) => {
                  const sla = inboxSlaBadge(c);
                  return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => void openConversation(c.id)}
                    className={cn(
                      "flex w-full flex-col gap-1 border-b border-[color:var(--color-border-subtle)] px-3 py-2.5 text-start text-sm transition-colors hover:bg-[color:var(--color-bg-subtle)]",
                      selectedId === c.id && "bg-[color:var(--color-bg-subtle)]",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-[color:var(--color-text-primary)]">
                        {c.customerName || c.customerPhone}
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                        {sla ? (
                          <Badge
                            tone={
                              sla.tone === "error"
                                ? "danger"
                                : sla.tone === "warning"
                                  ? "warning"
                                  : "info"
                            }
                            className="text-[10px]"
                          >
                            {sla.label}
                          </Badge>
                        ) : null}
                        {c.hasUnread && (
                          <Badge tone="info" className="text-[10px]">
                            {c.unreadCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-[color:var(--color-text-muted)]">
                      {c.customerPhone}
                      {c.department?.trim() ? (
                        <span className="ms-2 text-[color:var(--color-text-secondary)]">
                          · {c.department}
                        </span>
                      ) : null}
                    </div>
                    <div className="line-clamp-2 text-xs text-[color:var(--color-text-secondary)]">
                      {c.lastMessageText || "—"}
                    </div>
                    <div className="flex flex-wrap gap-1 pt-1">
                      <Badge tone="default" className="text-[10px] capitalize ring-1 ring-[color:var(--color-border-subtle)]">
                        {c.status.replace(/_/g, " ")}
                      </Badge>
                      {c.assignedUserName && (
                        <Badge tone="agentTask" className="text-[10px]">
                          {c.assignedUserName}
                        </Badge>
                      )}
                      {c.linkedOrderId ? (
                        <Badge tone="default" className="text-[10px] ring-1 ring-[color:var(--color-border-subtle)]">
                          Order
                        </Badge>
                      ) : null}
                      {(c.tags ?? []).slice(0, 4).map((tag) => (
                        <Badge
                          key={tag}
                          tone="warning"
                          className="max-w-[120px] truncate text-[10px]"
                        >
                          {tag}
                        </Badge>
                      ))}
                      {(c.tags ?? []).length > 4 ? (
                        <Badge tone="default" className="text-[10px]">
                          +{(c.tags ?? []).length - 4}
                        </Badge>
                      ) : null}
                    </div>
                  </button>
                  );
                })
              )}
              {!loadingList &&
              !isWarehouse &&
              listNextCursor &&
              !phoneQ.trim() &&
              !deptQ.trim() ? (
                <div className="border-t border-[color:var(--color-border-subtle)] p-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    disabled={loadingMore}
                    onClick={() => void loadList({ append: true })}
                  >
                    {loadingMore ? "Loading…" : "Load more"}
                  </Button>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="flex min-h-0 flex-col gap-4 lg:flex-row">
          <Card className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <CardContent className="flex min-h-0 flex-1 flex-col gap-0 p-0">
              {!detail ? (
                <p className="p-4 text-sm text-[color:var(--color-text-muted)]">
                  Select a conversation.
                </p>
              ) : (
                <>
                  <div className="sticky top-0 z-10 border-b border-[color:var(--color-border-subtle)] bg-[color:var(--color-card)] px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h2 className="text-base font-semibold">
                          {detail.conversation.customerName}
                        </h2>
                        <p className="text-xs text-[color:var(--color-text-muted)]">
                          {detail.conversation.customerPhone}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          {(() => {
                            const s = inboxSlaBadge(detail.conversation);
                            return s ? (
                              <Badge
                                tone={
                                  s.tone === "error"
                                    ? "danger"
                                    : s.tone === "warning"
                                      ? "warning"
                                      : "info"
                                }
                                className="text-[10px]"
                              >
                                {s.label}
                              </Badge>
                            ) : null;
                          })()}
                          {detail.conversation.department?.trim() ? (
                            <Badge tone="default" className="text-[10px]">
                              {detail.conversation.department}
                            </Badge>
                          ) : null}
                        </div>
                        {canWrite ? (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Input
                              placeholder="Department / queue"
                              value={departmentEdit}
                              onChange={(e) => setDepartmentEdit(e.target.value)}
                              className="h-8 max-w-[220px] text-xs"
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="h-8 text-xs"
                              onClick={() =>
                                void patchConversation({
                                  department:
                                    departmentEdit.trim() || null,
                                })
                              }
                            >
                              Save queue
                            </Button>
                          </div>
                        ) : null}
                        {canWrite ? (
                          <div className="mt-2 space-y-1.5">
                            <span className="text-[10px] font-medium uppercase text-[color:var(--color-text-muted)]">
                              Tags
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {CONVERSATION_TAG_PRESETS.map((preset) => {
                                const active = (detail.conversation.tags ?? []).some(
                                  (x) => x.toLowerCase() === preset.toLowerCase(),
                                );
                                return (
                                  <Button
                                    key={preset}
                                    type="button"
                                    size="sm"
                                    variant={active ? "primary" : "secondary"}
                                    className="h-7 text-[10px]"
                                    onClick={() => toggleConversationTag(preset)}
                                  >
                                    {preset}
                                  </Button>
                                );
                              })}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              <Input
                                placeholder="Custom tag"
                                value={tagDraft}
                                onChange={(e) => setTagDraft(e.target.value)}
                                className="h-8 max-w-[160px] text-xs"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    addCustomConversationTag();
                                  }
                                }}
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-8 text-xs"
                                onClick={() => addCustomConversationTag()}
                              >
                                Add
                              </Button>
                            </div>
                          </div>
                        ) : (detail.conversation.tags?.length ?? 0) > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {(detail.conversation.tags ?? []).map((tag) => (
                              <Badge key={tag} tone="warning" className="text-[10px]">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      {canWrite && (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              void patchConversation({
                                takeOver: true,
                              })
                            }
                          >
                            Take over
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              void patchConversation({
                                releaseToBot: true,
                              })
                            }
                          >
                            Return to bot
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              void patchConversation({ status: "closed" })
                            }
                          >
                            Close
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              void patchConversation({
                                assignedUserId: session.userId,
                              })
                            }
                          >
                            Assign to me
                          </Button>
                          {canManage && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                void patchConversation({
                                  assignedUserId: null,
                                })
                              }
                            >
                              Unassign
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                    {msgCursor && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => void loadOlder()}
                      >
                        Load older
                      </Button>
                    )}
                    <div className="flex flex-col gap-2">
                      {[...messages].reverse().map((m) => (
                        <div
                          key={m.id}
                          className={cn(
                            "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                            m.direction === "incoming" &&
                              "self-start bg-[color:var(--color-bg-subtle)]",
                            m.direction === "outgoing" &&
                              "self-end bg-[color:var(--color-primary)] text-[color:var(--color-primary-fg)]",
                            m.direction === "internal" &&
                              "self-center border border-dashed border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-100",
                          )}
                        >
                          {(() => {
                            const meta = messageMeta(m);
                            const wmid =
                              typeof meta.whatsappMediaId === "string"
                                ? meta.whatsappMediaId
                                : "";
                            const fn =
                              typeof meta.fileName === "string"
                                ? meta.fileName
                                : undefined;
                            if (
                              wmid &&
                              (m.type === "image" ||
                                m.type === "audio" ||
                                m.type === "document")
                            ) {
                              return (
                                <WhatsAppMediaPreview
                                  mediaId={wmid}
                                  conversationId={detail.conversation.id}
                                  messageId={m.id}
                                  kind={m.type}
                                  headers={headers}
                                  fileName={fn}
                                />
                              );
                            }
                            return null;
                          })()}
                          <div className="whitespace-pre-wrap break-words">
                            {m.body}
                          </div>
                          <div className="mt-1 text-[10px] opacity-70">
                            {m.direction} · {m.status} ·{" "}
                            {new Date(m.createdAt).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {canWrite && (
                    <div className="border-t border-[color:var(--color-border-subtle)] p-3 space-y-3">
                      <div className="space-y-1">
                        <span className="text-xs font-medium text-[color:var(--color-text-muted)]">
                          Internal note (team only — also on order timeline when linked)
                        </span>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Add a note — not sent to the customer…"
                            value={internalNote}
                            onChange={(e) => setInternalNote(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                                e.preventDefault();
                                void addInternalNote();
                              }
                            }}
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={noteSaving || !internalNote.trim()}
                            onClick={() => void addInternalNote()}
                          >
                            {noteSaving ? "…" : "Note"}
                          </Button>
                        </div>
                      </div>
                      {templates.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-xs font-medium text-[color:var(--color-text-muted)]">
                            Quick replies
                          </span>
                          {templatesByCategory.map(([cat, items]) => (
                            <div key={cat} className="space-y-1">
                              <div className="text-[10px] uppercase tracking-wide text-[color:var(--color-text-muted)]">
                                {cat}
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {items.map((t) => (
                                  <Button
                                    key={t.id}
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    className="text-xs"
                                    onClick={() => setComposer(t.body)}
                                  >
                                    {t.title}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Input
                          placeholder="Type a message…"
                          value={composer}
                          onChange={(e) => setComposer(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              void sendMessage();
                            }
                          }}
                        />
                        <Button
                          type="button"
                          disabled={sending || !composer.trim()}
                          onClick={() => void sendMessage()}
                        >
                          Send
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {detail?.order && (
            <Card className="w-full shrink-0 lg:w-72">
              <CardContent className="space-y-2 py-4 text-sm">
                <h3 className="font-semibold">Linked order</h3>
                <p className="text-[color:var(--color-text-muted)]">
                  {detail.order.customer.name}
                </p>
                <p className="text-xs">{detail.order.customer.phone}</p>
                <p className="text-xs capitalize">Status: {detail.order.status}</p>
                <p className="text-xs">
                  Total: {detail.order.payment.total_amount}
                </p>
                <Link
                  href={`/orders/${detail.order.id}`}
                  className="inline-flex h-8 items-center justify-center rounded-[var(--ds-radius-md)] bg-[color:var(--color-muted-bg)] px-3 text-sm font-medium text-[color:var(--color-text-primary)] hover:opacity-90"
                >
                  Open order
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
