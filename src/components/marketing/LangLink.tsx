"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Globe } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { LOCALE_COOKIE } from "@/lib/auth/constants";

/** /ar/... <-> /en/... keeping path and query; remembers the choice in a cookie. */
export function LangLink({ className, showIcon = true }: { className?: string; showIcon?: boolean }) {
  const { locale, t } = useI18n();
  const pathname = usePathname() || `/${locale}`;
  const search = useSearchParams();
  const other = locale === "ar" ? "en" : "ar";
  const qs = search?.toString();
  const href = pathname.replace(/^\/(ar|en)(?=\/|$)/, `/${other}`) + (qs ? `?${qs}` : "");
  return (
    <Link
      href={href}
      hrefLang={other}
      // No prefetch: the other locale's payload carries its font preloads (PERF-05), and the
      // switch is rarely used.
      prefetch={false}
      lang={other}
      className={className}
      onClick={() => {
        document.cookie = `${LOCALE_COOKIE}=${other}; path=/; max-age=31536000; samesite=lax`;
      }}
    >
      {showIcon ? <Globe aria-hidden size={18} /> : null}
      <span>{other === "ar" ? t("common.switchToArabic") : t("common.switchToEnglish")}</span>
    </Link>
  );
}
