"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Cookie } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { Button, Icon, Link } from "@/components/ui";
import styles from "./SiteChrome.module.css";

export const COOKIE_ACK = "elba_cookie_ack";

function acknowledged(): boolean {
  try {
    return document.cookie.split("; ").some((c) => c === `${COOKIE_ACK}=1`);
  } catch {
    return true;
  }
}

const noopSubscribe = () => () => undefined;

/**
 * Whether the notice was already acknowledged. The server (and hydration) assume "no", so the
 * notice is in the server HTML and paints with the first frame instead of after hydration
 * (it was the late LCP element). COOKIE_HIDE_SCRIPT hides it before paint for returning
 * visitors; after hydration this reads the real cookie and unmounts it.
 */
export function useCookieAck(): [boolean, () => void] {
  const ack = useSyncExternalStore(noopSubscribe, acknowledged, () => false);
  const [dismissed, setDismissed] = useState(false);
  const dismiss = () => {
    document.cookie = `${COOKIE_ACK}=1; path=/; max-age=31536000; samesite=lax`;
    setDismissed(true);
  };
  return [ack || dismissed, dismiss];
}

/** Inline, runs during HTML parse right after the notice: hides it if the ack cookie exists. */
export const COOKIE_HIDE_SCRIPT = `(function(s){try{if(document.cookie.split("; ").indexOf("${COOKIE_ACK}=1")>-1){s.previousElementSibling.style.display="none"}}catch(e){}})(document.currentScript)`;

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
