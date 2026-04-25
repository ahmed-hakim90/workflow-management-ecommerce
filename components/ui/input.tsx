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
        <label className="text-xs font-medium text-[color:var(--color-text-secondary)]">
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
          "h-9 w-full rounded-lg border bg-[color:var(--color-card)] px-3 text-sm",
          "text-[color:var(--color-text-primary)] outline-none",
          "border-[color:var(--color-border)] placeholder:text-[color:var(--color-text-secondary)]/70",
          "focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20",
          error && "border-[color:var(--color-error)] focus:ring-[color:var(--color-error)]/20",
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
          "h-9 w-full rounded-lg border bg-[color:var(--color-card)] px-3 text-sm",
          "text-[color:var(--color-text-primary)] outline-none",
          "border-[color:var(--color-border)]",
          "focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20",
          error && "border-[color:var(--color-error)] focus:ring-[color:var(--color-error)]/20",
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
