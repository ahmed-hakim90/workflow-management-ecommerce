"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

export type KanbanColumn<T extends string> = {
  id: T;
  title: string;
  /** Optional status dot (Tailwind classes for background color). */
  statusDotClass?: string;
};

type ResponsiveKanbanProps<T extends string> = {
  columns: KanbanColumn<T>[];
  countFor: (columnId: T) => number;
  renderMobileFlowLabel?: boolean;
  renderColumnCards: (columnId: T) => ReactNode;
};

export function ResponsiveKanban<T extends string>({
  columns,
  countFor,
  renderColumnCards,
  renderMobileFlowLabel = true,
}: ResponsiveKanbanProps<T>) {
  return (
    <>
      <div className="hidden gap-3 overflow-x-auto pb-2 md:flex md:gap-4">
        {columns.map((c) => (
          <div
            key={c.id}
            className="flex w-[min(220px,70vw)] shrink-0 flex-col rounded-[var(--ds-radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-kanban-column)] shadow-none md:w-[240px] lg:w-[268px]"
          >
            <div className="border-b border-[color:var(--color-divider)] px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  {c.statusDotClass ? (
                    <span
                      className={`size-1.5 shrink-0 rounded-full ${c.statusDotClass}`}
                      aria-hidden
                    />
                  ) : null}
                  <span className="truncate text-[12px] font-semibold tracking-tight text-[color:var(--color-kanban-header)]">
                    {c.title}
                  </span>
                  <span className="shrink-0 rounded-full bg-[color:var(--color-shell)] px-1.5 py-px text-[11px] font-medium tabular-nums text-[color:var(--color-text-muted)] ring-1 ring-[color:var(--color-border)]">
                    {countFor(c.id)}
                  </span>
                </div>
              </div>
            </div>
            <div
              className={cn(
                "flex max-h-[70vh] flex-col gap-3 overflow-y-auto p-3",
                "motion-reduce:scroll-auto",
              )}
            >
              {renderColumnCards(c.id)}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-8 md:hidden">
        {columns.map((c, idx) => (
          <section key={c.id} aria-labelledby={`kanban-col-${c.id}`}>
            {renderMobileFlowLabel && idx > 0 ? (
              <div
                className="mb-3 flex justify-center text-[color:var(--color-text-muted)]"
                aria-hidden
              >
                <span className="text-lg leading-none">↓</span>
              </div>
            ) : null}
            <h2
              id={`kanban-col-${c.id}`}
              className="mb-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-[color:var(--color-kanban-header)]"
            >
              {c.statusDotClass ? (
                <span
                  className={`size-2 rounded-full ${c.statusDotClass}`}
                  aria-hidden
                />
              ) : null}
              <span className="tracking-tight">{c.title}</span>
              <span className="rounded-full bg-[color:var(--color-muted-bg)] px-2 py-0.5 text-xs font-semibold tabular-nums text-[color:var(--color-text-secondary)]">
                {countFor(c.id)}
              </span>
            </h2>
            <div className="flex flex-col gap-3">{renderColumnCards(c.id)}</div>
          </section>
        ))}
      </div>
    </>
  );
}
