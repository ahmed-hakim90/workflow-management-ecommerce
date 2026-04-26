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
          "h-9 w-full rounded-xl border-0 bg-[color:var(--color-input-bg)] px-3 text-sm shadow-[var(--shadow-neo-inset)]",
          "text-[color:var(--color-text-primary)] outline-none",
          "placeholder:text-[color:var(--color-text-secondary)]/70",
          "focus:ring-2 focus:ring-[color:var(--color-primary)] focus:ring-offset-1 focus:ring-offset-[color:var(--color-bg)]",
          error &&
            "ring-2 ring-[color:var(--color-error)] ring-offset-1 ring-offset-[color:var(--color-bg)]",
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
          "h-9 w-full rounded-xl border-0 bg-[color:var(--color-input-bg)] px-3 text-sm shadow-[var(--shadow-neo-inset)]",
          "text-[color:var(--color-text-primary)] outline-none",
          "focus:ring-2 focus:ring-[color:var(--color-primary)] focus:ring-offset-1 focus:ring-offset-[color:var(--color-bg)]",
          error &&
            "ring-2 ring-[color:var(--color-error)] ring-offset-1 ring-offset-[color:var(--color-bg)]",
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
