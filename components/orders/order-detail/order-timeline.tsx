"use client";

import { MessageCircle, Workflow } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/ui/cn";
import type { ActivityLog, OrderEvent } from "@/lib/types/models";

type TimelineItem =
  | {
      id: string;
      kind: "chat";
      action: string;
      userId: string;
      metadata?: Record<string, unknown>;
      at: string;
    }
  | {
      id: string;
      kind: "activity";
      action: string;
      userId: string;
      metadata?: Record<string, unknown>;
      at: string;
    };

type OrderTimelineProps = {
  events: OrderEvent[];
  activities: ActivityLog[];
  userName: (id: string) => string;
};

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("ar-EG", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function metadataBlock(metadata?: Record<string, unknown>) {
  if (!metadata || Object.keys(metadata).length === 0) return null;
  return (
    <pre
      className={cn(
        "mt-3 overflow-x-auto rounded-[var(--ds-radius-md)] border border-[color:var(--color-code-border)]",
        "bg-[color:var(--color-code-bg)] p-2 text-[11px] [direction:ltr] [text-align:left]",
      )}
    >
      {JSON.stringify(metadata, null, 2)}
    </pre>
  );
}

export function OrderTimeline({ events, activities, userName }: OrderTimelineProps) {
  const items: TimelineItem[] = [
    ...events.map((event) => ({
      id: event.id,
      kind: "chat" as const,
      action: event.action,
      userId: event.userId,
      metadata: event.metadata,
      at: event.createdAt,
    })),
    ...activities.map((activity) => ({
      id: activity.id,
      kind: "activity" as const,
      action: activity.action,
      userId: activity.userId,
      metadata: activity.metadata,
      at: activity.timestamp,
    })),
  ].sort((first, second) => new Date(second.at).getTime() - new Date(first.at).getTime());

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <div>
          <CardTitle>خط زمني موحد للطلب</CardTitle>
          <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
            يجمع أحداث المحادثة وسجل الإجراءات في تسلسل واحد.
          </p>
        </div>
        <Badge tone="default">{items.length} حدث</Badge>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {items.length === 0 ? (
          <p className="rounded-[var(--ds-radius-md)] bg-[color:var(--color-bg-subtle)] p-4 text-center text-[color:var(--color-text-muted)]">
            لا توجد أحداث مسجلة على هذا الطلب بعد.
          </p>
        ) : (
          <ul className="space-y-3 border-s-2 border-[color:var(--color-divider)] ps-4">
            {items.map((item) => (
              <li
                key={`${item.kind}-${item.id}`}
                className="relative rounded-[var(--ds-radius-md)] bg-[color:var(--color-bg-subtle)] p-3 text-[color:var(--color-text-secondary)] shadow-none"
              >
                <span
                  className={cn(
                    "absolute -start-[21px] top-4 size-2 rounded-full shadow-none",
                    item.kind === "chat"
                      ? "bg-[color:var(--color-success)]"
                      : "bg-[color:var(--color-primary)]",
                  )}
                />
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.kind === "chat" ? (
                        <MessageCircle className="size-4 text-[color:var(--color-success)]" aria-hidden />
                      ) : (
                        <Workflow className="size-4 text-[color:var(--color-primary)]" aria-hidden />
                      )}
                      <span className="font-medium text-[color:var(--color-text-primary)]">
                        {item.action}
                      </span>
                      <Badge tone={item.kind === "chat" ? "success" : "default"}>
                        {item.kind === "chat" ? "chat" : "activity"}
                      </Badge>
                    </div>
                    <p className="text-xs text-[color:var(--color-text-muted)]">
                      {userName(item.userId)}
                    </p>
                  </div>
                  <span className="text-xs text-[color:var(--color-text-muted)]">
                    {formatWhen(item.at)}
                  </span>
                </div>
                {metadataBlock(item.metadata)}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
