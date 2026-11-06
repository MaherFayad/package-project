"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Languages } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { LOCALE_COOKIE } from "@/lib/auth/constants";
import styles from "./designer.module.css";

/** Language switch for the designer's dark top bar (keeps path, design id and preset). */
export function TopBarLanguage() {
  const { locale, t } = useI18n();
  const pathname = usePathname() || `/${locale}/design`;
  const search = useSearchParams();
  const other = locale === "ar" ? "en" : "ar";
  // The editor updates ?d= with history.replaceState; read the live URL on click.
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
      className={styles.topBarLink}
      onClick={(e) => {
        document.cookie = `${LOCALE_COOKIE}=${other}; path=/; max-age=31536000; samesite=lax`;
        const live = window.location.pathname.replace(/^\/(ar|en)(?=\/|$)/, `/${other}`) + window.location.search;
        if (live !== href) {
          e.preventDefault();
          window.location.assign(live);
        }
      }}
    >
      <Languages aria-hidden size={16} />
      <span>{other === "ar" ? t("common.switchToArabic") : t("common.switchToEnglish")}</span>
    </Link>
  );
}
