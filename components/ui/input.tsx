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
        <label className="text-[13px] font-medium text-[color:var(--color-text-secondary)]">
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
          "h-9 min-h-9 w-full rounded-[var(--ds-radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-input-bg)] px-3 text-[13px] leading-5 shadow-none sm:text-sm",
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
          "h-9 min-h-9 w-full rounded-[var(--ds-radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-input-bg)] px-3 text-[13px] leading-5 shadow-none sm:text-sm",
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
          "min-h-[120px] w-full rounded-[var(--ds-radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-input-bg)] px-3 py-2.5 text-[13px] leading-relaxed shadow-none sm:text-sm",
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
            "mt-0.5 size-[18px] shrink-0 cursor-pointer rounded-[var(--ds-radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-input-bg)]",
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
            className="cursor-pointer text-[13px] font-normal leading-snug text-[color:var(--color-text-primary)] sm:text-sm"
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
