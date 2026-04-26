"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

export type KanbanColumn<T extends string> = { id: T; title: string };

type ResponsiveKanbanProps<T extends string> = {
  columns: KanbanColumn<T>[];
  countFor: (columnId: T) => number;
  /** Shown after the count in column headers, e.g. "orders" / "tickets". */
  countNoun?: string;
  renderMobileFlowLabel?: boolean;
  renderColumnCards: (columnId: T) => ReactNode;
};

export function ResponsiveKanban<T extends string>({
  columns,
  countFor,
  countNoun = "items",
  renderColumnCards,
  renderMobileFlowLabel = true,
}: ResponsiveKanbanProps<T>) {
  return (
    <>
      <div className="hidden gap-3 overflow-x-auto pb-2 md:flex md:gap-4">
        {columns.map((c) => (
          <div
            key={c.id}
            className="flex w-[min(220px,70vw)] shrink-0 flex-col rounded-2xl border-0 bg-[color:var(--color-kanban-column)] shadow-[var(--shadow-neo-raised)] md:w-[240px] lg:w-[280px]"
          >
            <div className="border-b border-[color:var(--color-divider)] px-3 py-2.5">
              <div className="text-sm font-semibold text-[color:var(--color-kanban-header)]">
                {c.title}
              </div>
              <div className="text-xs text-[color:var(--color-text-muted)]">
                {countFor(c.id)} {countNoun}
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
              className="mb-2 text-sm font-semibold text-[color:var(--color-kanban-header)]"
            >
              {c.title}
              <span className="ms-2 font-normal text-[color:var(--color-text-muted)]">
                ({countFor(c.id)})
              </span>
            </h2>
            <div className="flex flex-col gap-3">{renderColumnCards(c.id)}</div>
          </section>
        ))}
      </div>
    </>
  );
}
