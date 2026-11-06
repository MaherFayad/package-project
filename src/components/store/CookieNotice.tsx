"use client";

import { useEffect, useRef } from "react";
import { Cookie } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Link } from "@/components/ui/Link";
import styles from "./SiteChrome.module.css";
import { COOKIE_ACK, COOKIE_HIDE_SCRIPT, useCookieAck } from "./cookieAck";

export { COOKIE_ACK, COOKIE_HIDE_SCRIPT, useCookieAck };

/**
 * Essential-cookies notice (we set no advertising cookies, so this is information, not a
 * consent wall). Shown once per browser. While visible it reserves scroll padding at the
 * bottom so focused elements are never hidden behind it (WCAG 2.4.11).
 */
export function CookieNotice() {
  const { t, locale } = useI18n();
  const [ack, dismiss] = useCookieAck();
  const show = !ack;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (!show || !ref.current) return;
    const el = ref.current;
    const apply = () => {
      root.style.scrollPaddingBlockEnd = `${el.offsetHeight + 16}px`;
      // Reserve the notice's height so the end of the page (footer links) is never stuck under it.
      document.body.style.paddingBlockEnd = `${el.offsetHeight + 16}px`;
    };
    apply();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(apply) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      root.style.scrollPaddingBlockEnd = "";
      document.body.style.paddingBlockEnd = "";
    };
  }, [show]);

  if (!show) return null;
  return (
    <>
      <div ref={ref} className={styles.cookie} role="region" aria-label={t("store.cookie.label")} suppressHydrationWarning>
        <span className={styles.cookieIcon}>
          <Icon source={Cookie} />
        </span>
        <p className={styles.cookieText}>
          {t("store.cookie.message")}{" "}
          <Link url={`/${locale}/legal/cookies`} monochrome>
            {t("store.cookie.more")}
          </Link>
        </p>
        <Button variant="secondary" onClick={dismiss}>
          {t("store.cookie.ok")}
        </Button>
      </div>
      <script dangerouslySetInnerHTML={{ __html: COOKIE_HIDE_SCRIPT }} />
    </>
  );
}
