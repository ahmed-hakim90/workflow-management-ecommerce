"use client";

import { ArrowDownUp } from "lucide-react";
import { cn } from "@/lib/ui/cn";

export function TableWrap({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "overflow-auto rounded-[var(--ds-radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-card)] shadow-none",
        className,
      )}
    >
      <table className="w-full min-w-[640px] border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({
  className,
  children,
  sortable,
  onSort,
}: {
  className?: string;
  children: React.ReactNode;
  sortable?: boolean;
  onSort?: () => void;
}) {
  return (
    <th
      className={cn(
        "sticky top-0 z-10 border-b border-[color:var(--color-border)] bg-[color:var(--color-card)] px-3 py-2.5 text-start text-[11px] font-medium text-[color:var(--color-text-muted)]",
        className,
      )}
    >
      {sortable ? (
        <button
          type="button"
          className="inline-flex items-center gap-1 transition-colors hover:text-[color:var(--color-text-primary)]"
          onClick={onSort}
        >
          {children}
          <ArrowDownUp className="size-3" aria-hidden />
        </button>
      ) : (
        children
      )}
    </th>
  );
}

export function Td({
  className,
  children,
  colSpan,
  onClick,
}: {
  className?: string;
  children: React.ReactNode;
  colSpan?: number;
  onClick?: () => void;
}) {
  return (
    <td
      colSpan={colSpan}
      onClick={onClick}
      className={cn(
        "border-b border-[color:var(--color-border)] px-3 py-2.5 text-[color:var(--color-text-primary)]",
        onClick && "cursor-pointer",
        className,
      )}
    >
      {children}
    </td>
  );
}

export function Tr({
  className,
  children,
  onClick,
}: {
  className?: string;
  children: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLTableRowElement>;
}) {
  return (
    <tr
      className={cn(
        "transition-colors hover:bg-[color:var(--color-hover-bg)]",
        className,
      )}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

export function TablePagination({
  page,
  totalPages,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-t border-[color:var(--color-border)] px-3 py-2 text-xs text-[color:var(--color-text-secondary)]">
      <span>
        صفحة {page + 1} من {totalPages}
      </span>
      <div className="flex items-center gap-2">
        <button
          className="rounded-md px-2 py-1 hover:bg-[color:var(--color-hover-bg)]"
          onClick={onPrev}
          type="button"
        >
          السابق
        </button>
        <button
          className="rounded-md px-2 py-1 hover:bg-[color:var(--color-hover-bg)]"
          onClick={onNext}
          type="button"
        >
          التالي
        </button>
      </div>
    </div>
  );
}
