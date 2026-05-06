import * as React from "react";
import { cn } from "@/lib/ui/cn";

type FieldMetaProps = {
  label?: string;
  helperText?: string;
  error?: string;
};

function FieldMeta({ label, helperText, error }: FieldMetaProps) {
  return (
    <>
      {label ? (
        <label className="text-sm font-semibold text-[color:var(--color-text-secondary)]">
          {label}
        </label>
      ) : null}
      {error ? (
        <p className="text-xs text-[color:var(--color-error)]">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-[color:var(--color-text-secondary)]">{helperText}</p>
      ) : null}
    </>
  );
}

export function Input({
  className,
  label,
  helperText,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & FieldMetaProps) {
  return (
    <div className="space-y-1">
      <FieldMeta label={label} />
      <input
        className={cn(
          "h-11 min-h-11 w-full rounded-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-input-bg)] px-4 text-base leading-6 shadow-none",
          "text-[color:var(--color-text-primary)] outline-none transition-[border-color,box-shadow]",
          "placeholder:text-[color:var(--color-text-muted)]",
          "focus:border-[color:var(--color-primary)] focus:shadow-[var(--shadow-focus-ring)] focus:ring-0",
          "disabled:cursor-not-allowed disabled:bg-[color:var(--color-button-disabled-bg)] disabled:text-[color:var(--color-button-disabled-text)]",
          error && "border-[color:var(--color-error)] focus:border-[color:var(--color-error)] focus:shadow-none",
          className,
        )}
        {...props}
      />
      <FieldMeta helperText={helperText} error={error} />
    </div>
  );
}

export function Select({
  className,
  label,
  helperText,
  error,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & FieldMetaProps) {
  return (
    <div className="space-y-1">
      <FieldMeta label={label} />
      <select
        className={cn(
          "h-11 min-h-11 w-full rounded-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-input-bg)] px-4 text-base leading-6 shadow-none",
          "text-[color:var(--color-text-primary)] outline-none transition-[border-color,box-shadow]",
          "focus:border-[color:var(--color-primary)] focus:shadow-[var(--shadow-focus-ring)] focus:ring-0",
          "disabled:cursor-not-allowed disabled:bg-[color:var(--color-button-disabled-bg)] disabled:text-[color:var(--color-button-disabled-text)]",
          error && "border-[color:var(--color-error)] focus:border-[color:var(--color-error)] focus:shadow-none",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <FieldMeta helperText={helperText} error={error} />
    </div>
  );
}

export function Textarea({
  className,
  label,
  helperText,
  error,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & FieldMetaProps) {
  return (
    <div className="space-y-1">
      <FieldMeta label={label} />
      <textarea
        className={cn(
          "min-h-[120px] w-full rounded-lg border border-[color:var(--color-border-strong)] bg-[color:var(--color-input-bg)] px-4 py-3 text-sm leading-5 shadow-none",
          "text-[color:var(--color-text-primary)] outline-none transition-[border-color,box-shadow]",
          "placeholder:text-[color:var(--color-text-muted)]",
          "focus:border-[color:var(--color-primary)] focus:shadow-[var(--shadow-focus-ring)] focus:ring-0",
          "disabled:cursor-not-allowed disabled:bg-[color:var(--color-button-disabled-bg)] disabled:text-[color:var(--color-button-disabled-text)]",
          error && "border-[color:var(--color-error)] focus:border-[color:var(--color-error)] focus:shadow-none",
          className,
        )}
        {...props}
      />
      <FieldMeta helperText={helperText} error={error} />
    </div>
  );
}

export function Checkbox({
  className,
  label,
  helperText,
  error,
  id,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> &
  FieldMetaProps & { id?: string }) {
  const autoId = React.useId();
  const inputId = id ?? autoId;
  return (
    <div className="space-y-1">
      <div className="flex items-start gap-3">
        <input
          id={inputId}
          type="checkbox"
          className={cn(
            "mt-0.5 size-5 shrink-0 cursor-pointer rounded border-2 border-[color:var(--color-border-strong)] bg-[color:var(--color-input-bg)]",
            "accent-[color:var(--color-primary)] outline-none",
            "focus-visible:shadow-[var(--shadow-focus-ring)] focus-visible:ring-0",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          {...props}
        />
        {label ? (
          <label
            htmlFor={inputId}
            className="cursor-pointer text-base font-normal leading-6 text-[color:var(--color-text-primary)]"
          >
            {label}
          </label>
        ) : null}
      </div>
      {error || helperText ? (
        <FieldMeta helperText={helperText} error={error} />
      ) : null}
    </div>
  );
}
