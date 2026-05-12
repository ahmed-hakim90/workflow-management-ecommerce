"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSessionStore, buildAuthHeaders } from "@/store/zustand/session-store";
import { N8N_OMS_EVENT_IDS } from "@/lib/constants/n8n-oms-events";
import type {
  MessageTemplate,
  MessageTemplateEventKey,
  N8nOmsEventType,
  TemplateApprovalStatus,
} from "@/lib/types/chat";

const CATEGORIES = [
  { id: "general", label: "General" },
  { id: "confirmation", label: "Confirmation" },
  { id: "shipping", label: "Shipping" },
  { id: "return", label: "Return" },
  { id: "complaint", label: "Complaint" },
] as const;

const EVENT_KEYS: { id: MessageTemplateEventKey; label: string }[] = [
  { id: "order_confirm", label: "order_confirm" },
  { id: "ask_address", label: "ask_address" },
  { id: "shipped", label: "shipped" },
  { id: "delivery_failed", label: "delivery_failed" },
  { id: "return", label: "return" },
  { id: "complaint", label: "complaint" },
];

const N8N_EVENTS: { id: N8nOmsEventType; label: string }[] =
  N8N_OMS_EVENT_IDS.map((id) => ({ id, label: id }));

const APPROVAL: { id: TemplateApprovalStatus; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
];

function emptyForm() {
  return {
    title: "",
    body: "",
    whatsappTemplateName: "",
    eventKey: "" as "" | MessageTemplateEventKey,
    category: "general",
    linkedOmsEvent: "" as "" | N8nOmsEventType,
    approvalStatus: "pending" as TemplateApprovalStatus,
  };
}

export function InboxTemplatesSettings() {
  const session = useSessionStore();
  const headers = useMemo(() => buildAuthHeaders(session), [session]);
  const [rows, setRows] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/inbox/templates?all=1", { headers });
      const json = (await res.json()) as { data?: MessageTemplate[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setRows(json.data ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Load failed");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    void load();
  }, [load]);

  function startEdit(t: MessageTemplate) {
    setEditingId(t.id);
    setForm({
      title: t.title,
      body: t.body,
      whatsappTemplateName: t.whatsappTemplateName ?? "",
      eventKey: t.eventKey ?? "",
      category: t.category?.trim() || "general",
      linkedOmsEvent: t.linkedOmsEvent ?? "",
      approvalStatus: t.approvalStatus ?? "approved",
    });
    setMsg(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm());
  }

  async function save() {
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const payload = {
        title: form.title.trim(),
        body: form.body.trim(),
        whatsappTemplateName: form.whatsappTemplateName.trim() || null,
        eventKey: form.eventKey || null,
        category: form.category.trim() || null,
        linkedOmsEvent: form.linkedOmsEvent || null,
        approvalStatus: form.approvalStatus,
      };
      if (!payload.title || !payload.body) {
        throw new Error("Title and body are required");
      }
      if (editingId) {
        const res = await fetch(`/api/inbox/templates/${editingId}`, {
          method: "PATCH",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? res.statusText);
        setMsg("Template updated.");
      } else {
        const res = await fetch("/api/inbox/templates", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? res.statusText);
        setMsg("Template created.");
      }
      cancelEdit();
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!globalThis.confirm("Delete this template?")) return;
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/inbox/templates/${id}`, {
        method: "DELETE",
        headers,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      if (editingId === id) cancelEdit();
      setMsg("Template deleted.");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inbox templates &amp; saved replies</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 text-sm">
        <p className="text-[color:var(--color-text-secondary)]">
          Only <strong>approved</strong> rows appear as quick replies in the Inbox.
          Link rows to an <strong>OMS / n8n event</strong> for automation mapping.
        </p>
        {err ? (
          <p className="text-sm text-[color:var(--color-error)]">{err}</p>
        ) : null}
        {msg ? (
          <p className="text-sm text-[color:var(--color-success)]">{msg}</p>
        ) : null}

        <div className="rounded-[var(--ds-radius-md)] border border-[color:var(--color-border-subtle)] p-4 space-y-3">
          <div className="text-xs font-medium uppercase text-[color:var(--color-text-secondary)]">
            {editingId ? "Edit template" : "New template"}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
            <Select
              label="Category"
              value={form.category}
              onChange={(e) =>
                setForm((f) => ({ ...f, category: e.target.value }))
              }
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <span className="text-xs font-medium text-[color:var(--color-text-secondary)]">
              Message body
            </span>
            <textarea
              className="min-h-[88px] w-full rounded-[var(--ds-radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-input-bg)] p-3 text-sm"
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              spellCheck={false}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="WhatsApp template name (Meta)"
              value={form.whatsappTemplateName}
              onChange={(e) =>
                setForm((f) => ({ ...f, whatsappTemplateName: e.target.value }))
              }
              placeholder="optional"
            />
            <Select
              label="Product event key"
              value={form.eventKey}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  eventKey: e.target.value as MessageTemplateEventKey | "",
                }))
              }
            >
              <option value="">—</option>
              {EVENT_KEYS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Linked OMS / n8n event"
              value={form.linkedOmsEvent}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  linkedOmsEvent: e.target.value as N8nOmsEventType | "",
                }))
              }
            >
              <option value="">—</option>
              {N8N_EVENTS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
            <Select
              label="Approval"
              value={form.approvalStatus}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  approvalStatus: e.target.value as TemplateApprovalStatus,
                }))
              }
            >
              {APPROVAL.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={saving} onClick={() => void save()}>
              {saving ? "Saving…" : editingId ? "Update" : "Create"}
            </Button>
            {editingId ? (
              <Button type="button" variant="secondary" onClick={cancelEdit}>
                Cancel
              </Button>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium uppercase text-[color:var(--color-text-secondary)]">
            All templates
          </div>
          {loading ? (
            <p className="text-[color:var(--color-text-muted)]">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-[color:var(--color-text-muted)]">No templates yet.</p>
          ) : (
            <ul className="divide-y divide-[color:var(--color-border-subtle)] rounded-[var(--ds-radius-md)] border border-[color:var(--color-border-subtle)]">
              {rows.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{t.title}</span>
                      <Badge tone="default" className="text-[10px] capitalize">
                        {t.approvalStatus ?? "approved"}
                      </Badge>
                      {t.category ? (
                        <Badge tone="agentTask" className="text-[10px]">
                          {t.category}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="line-clamp-2 text-xs text-[color:var(--color-text-muted)]">
                      {t.body}
                    </p>
                    {t.linkedOmsEvent ? (
                      <p className="font-mono text-[10px] text-[color:var(--color-text-muted)]">
                        OMS: {t.linkedOmsEvent}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => startEdit(t)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => void remove(t.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
