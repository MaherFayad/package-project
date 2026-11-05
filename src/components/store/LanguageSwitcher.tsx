"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Languages } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { LOCALE_COOKIE } from "@/lib/auth/constants";
import styles from "./SiteChrome.module.css";

/** Switches /ar/... <-> /en/... keeping the rest of the path and query, and remembers the choice. */
export function LanguageSwitcher() {
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
      lang={other}
      className={styles.lang}
      onClick={() => {
        document.cookie = `${LOCALE_COOKIE}=${other}; path=/; max-age=31536000; samesite=lax`;
      }}
    >
      <Languages aria-hidden size={16} />
      <span>{other === "ar" ? t("common.switchToArabic") : t("common.switchToEnglish")}</span>
    </Link>
  );
}
