"use client";

import { Globe } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/ui/cn";
import {
  getNextLocale,
  LOCALE_LABELS,
  type Locale,
} from "@/lib/i18n/config";
import { writeLocaleCookie } from "@/lib/i18n/client";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useProfileStore } from "@/store/zustand/profile-store";

export function LanguageToggle({
  locale: controlledLocale,
  refreshOnChange = false,
  className,
}: {
  locale?: Locale;
  refreshOnChange?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const ctx = useLocale();
  const setProfile = useProfileStore((s) => s.setProfile);
  const locale = controlledLocale ?? ctx.locale;
  const nextLocale = getNextLocale(locale);

  function onClick() {
    writeLocaleCookie(nextLocale);
    setProfile({ language: nextLocale });
    ctx.setLocale(nextLocale);
    if (refreshOnChange) router.refresh();
  }

  return (
    <button
      type="button"
      className={cn(
        "inline-flex min-h-9 items-center justify-center gap-2 rounded-xl px-2.5 text-xs font-semibold text-[color:var(--color-text-secondary)] shadow-[var(--shadow-neo-raised-sm)] transition-all hover:text-[color:var(--color-primary)] hover:shadow-[var(--shadow-neo-raised)] active:shadow-[var(--shadow-neo-pressed-sm)]",
        className,
      )}
      aria-label={`Switch language to ${LOCALE_LABELS[nextLocale]}`}
      title={`Switch language to ${LOCALE_LABELS[nextLocale]}`}
      onClick={onClick}
    >
      <Globe className="size-4" aria-hidden />
      <span>{nextLocale.toUpperCase()}</span>
    </button>
  );
}
