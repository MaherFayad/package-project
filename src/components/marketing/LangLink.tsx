"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { LOCALE_COOKIE } from "@/lib/auth/constants";

/**
 * /ar/... <-> /en/... keeping path and query; remembers the choice in a cookie.
 *
 * Renders in the static HTML: it reads only the pathname. It used useSearchParams(), which
 * bails a prerendered page out to client rendering up to the nearest Suspense, so the language
 * link appeared only after hydration and pushed the page down 9 px on desktop (CLS, CR-45).
 * The query string is added at click time instead.
 */
export function LangLink({ className, showIcon = true }: { className?: string; showIcon?: boolean }) {
  const { locale, t } = useI18n();
  const pathname = usePathname() || `/${locale}`;
  const router = useRouter();
  const other = locale === "ar" ? "en" : "ar";
  const href = pathname.replace(/^\/(ar|en)(?=\/|$)/, `/${other}`);
  return (
    <Link
      href={href}
      hrefLang={other}
      // No prefetch: the other locale's payload carries its font preloads (PERF-05), and the
      // switch is rarely used.
      prefetch={false}
      lang={other}
      className={className}
      onClick={(e) => {
        document.cookie = `${LOCALE_COOKIE}=${other}; path=/; max-age=31536000; samesite=lax`;
        const qs = window.location.search;
        if (qs && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
          e.preventDefault();
          router.push(href + qs);
        }
      }}
    >
      {showIcon ? <Globe aria-hidden size={16} /> : null}
      <span>{other === "ar" ? t("common.switchToArabic") : t("common.switchToEnglish")}</span>
    </Link>
  );
}
