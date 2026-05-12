"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type { User } from "@/lib/types/models";

export type ActionModalMode =
  | "note"
  | "invoice"
  | "assign"
  | "confirm-delete"
  | "paid-amount";

export type ActionModalResult =
  | { mode: "note"; note: string }
  | { mode: "invoice"; invoiceNumber: string }
  | { mode: "assign"; assigneeUserId: string | null }
  | { mode: "confirm-delete"; confirmed: true }
  | { mode: "paid-amount"; paidAmount: number };

type ActionModalProps = {
  open: boolean;
  mode: ActionModalMode;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  users?: User[];
  defaultValue?: string;
  currentAssigneeId?: string | null;
  totalAmount?: number;
  onClose: () => void;
  onSubmit: (result: ActionModalResult) => void;
};

function parseMoneyInput(value: string): number | null {
  const normalized = value.trim().replace(/,/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function ActionModal({
  open,
  mode,
  title,
  description,
  confirmLabel,
  cancelLabel = "إلغاء",
  destructive = false,
  loading = false,
  users = [],
  defaultValue = "",
  currentAssigneeId,
  totalAmount,
  onClose,
  onSubmit,
}: ActionModalProps) {
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (mode === "assign") {
      setValue(currentAssigneeId ?? "");
    } else {
      setValue(defaultValue);
    }
    setError(null);
  }, [currentAssigneeId, defaultValue, mode, open]);

  const helperText = useMemo(() => {
    if (mode === "confirm-delete") {
      return 'اكتب "حذف" لتأكيد الحذف النهائي.';
    }
    if (mode === "assign") {
      return "اتركها بدون اختيار لإلغاء التعيين.";
    }
    if (mode === "paid-amount" && typeof totalAmount === "number") {
      return `الإجمالي: ${totalAmount.toLocaleString("ar-EG-u-nu-latn")} EGP`;
    }
    return undefined;
  }, [mode, totalAmount]);

  function submit() {
    setError(null);

    if (mode === "note") {
      const note = value.trim();
      if (!note) {
        setError("الملاحظة مطلوبة لهذا الإجراء.");
        return;
      }
      onSubmit({ mode, note });
      return;
    }

    if (mode === "invoice") {
      const invoiceNumber = value.trim();
      if (!invoiceNumber) {
        setError("رقم الفاتورة مطلوب.");
        return;
      }
      onSubmit({ mode, invoiceNumber });
      return;
    }

    if (mode === "assign") {
      onSubmit({ mode, assigneeUserId: value.trim() || null });
      return;
    }

    if (mode === "confirm-delete") {
      if (value.trim() !== "حذف") {
        setError('اكتب "حذف" كما هي لتأكيد العملية.');
        return;
      }
      onSubmit({ mode, confirmed: true });
      return;
    }

    const paidAmount = parseMoneyInput(value);
    if (paidAmount === null) {
      setError("قيمة الدفع المسبق غير صحيحة.");
      return;
    }
    if (paidAmount < 0) {
      setError("قيمة الدفع المسبق لا يمكن أن تكون بالسالب.");
      return;
    }
    if (typeof totalAmount === "number" && paidAmount > totalAmount) {
      setError("قيمة الدفع المسبق لا يمكن أن تتجاوز إجمالي الطلب.");
      return;
    }
    onSubmit({ mode, paidAmount });
  }

  return (
    <Modal
      open={open}
      title={title}
      onClose={() => {
        if (!loading) onClose();
      }}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={loading}
            onClick={onClose}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? "danger" : "primary"}
            loading={loading}
            onClick={submit}
          >
            {confirmLabel ?? (destructive ? "تأكيد" : "حفظ")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        {description ? (
          <p className="rounded-[var(--ds-radius-md)] bg-[color:var(--color-bg-subtle)] p-3 text-[color:var(--color-text-secondary)]">
            {description}
          </p>
        ) : null}

        {mode === "note" ? (
          <Textarea
            label="السبب / الملاحظة"
            value={value}
            error={error ?? undefined}
            onChange={(event) => setValue(event.target.value)}
            placeholder="اكتب سبب الإجراء أو أي ملاحظة مهمة للمتابعة"
          />
        ) : mode === "assign" ? (
          <Select
            label="المستخدم المسؤول"
            value={value}
            helperText={helperText}
            error={error ?? undefined}
            onChange={(event) => setValue(event.target.value)}
          >
            <option value="">بدون تعيين</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} ({user.role})
              </option>
            ))}
          </Select>
        ) : (
          <Input
            label={
              mode === "invoice"
                ? "رقم الفاتورة"
                : mode === "paid-amount"
                  ? "قيمة الدفع المسبق"
                  : "تأكيد الحذف"
            }
            type={mode === "paid-amount" ? "number" : "text"}
            min={mode === "paid-amount" ? "0" : undefined}
            step={mode === "paid-amount" ? "0.01" : undefined}
            value={value}
            helperText={helperText}
            error={error ?? undefined}
            onChange={(event) => setValue(event.target.value)}
          />
        )}
      </div>
    </Modal>
  );
}
