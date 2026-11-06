"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useI18n } from "@/i18n/client";
import { COOKIE_HIDE_SCRIPT, useCookieAck } from "@/components/store/cookieAck";
import styles from "./marketing.module.css";

/**
 * Essential-cookies notice as a bottom bar. It never covers content: while it is shown the
 * page reserves its height at the bottom (padding on .site via --mk-cookie-h) and as scroll
 * padding, so the footer and any focused control stay visible above it (WCAG 2.4.11).
 */
export function CookieBar() {
  const { t, locale } = useI18n();
  const [ack, dismiss] = useCookieAck();
  const show = !ack;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    const el = ref.current;
    if (!show || !el) return;
    const apply = () => {
      const h = el.offsetHeight;
      root.style.setProperty("--mk-cookie-h", `${h}px`);
      root.style.scrollPaddingBlockEnd = `${h + 16}px`;
    };
    apply();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(apply) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      root.style.removeProperty("--mk-cookie-h");
      root.style.scrollPaddingBlockEnd = "";
    };
  }, [show]);

  if (!show) return null;
  return (
    <>
      <div ref={ref} className={styles.cookie} role="region" aria-label={t("store.cookie.label")} suppressHydrationWarning>
        <div className={`${styles.container} ${styles.cookieInner}`}>
          <p className={styles.cookieText}>
            {t("store.cookie.message")}{" "}
            <Link href={`/${locale}/legal/cookies`}>{t("store.cookie.more")}</Link>
          </p>
          <button type="button" className={`${styles.pill} ${styles.pillSmall}`} onClick={dismiss}>
            {t("store.cookie.ok")}
          </button>
        </div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: COOKIE_HIDE_SCRIPT }} />
    </>
  );
}
