"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { useI18n } from "@/i18n/client";
import styles from "./marketing.module.css";

/** Bump the value when the announcement changes, so a new one shows again. */
export const ANNOUNCE_COOKIE = "elba_announce";
const ANNOUNCE_VALUE = "v1";
const DISMISS_DAYS = 30;

/**
 * Transactional pages carry no promotion (R4-CR-09; Polaris: no promo in task flows): the account,
 * orders and invoices, sign-in and the opt-out page. Decided from the path, which is known while
 * rendering on the server, so these pages never flash the bar.
 */
const TRANSACTIONAL = /^\/(ar|en)\/(account|orders|login|unsubscribe)(\/|$)/;
export const isTransactionalPath = (path: string) => TRANSACTIONAL.test(path);

function dismissed(): boolean {
  try {
    return document.cookie.split("; ").includes(`${ANNOUNCE_COOKIE}=${ANNOUNCE_VALUE}`);
  } catch {
    return false;
  }
}
const noopSubscribe = () => () => undefined;

/** Inline, runs during HTML parse right after the bar: hides it before paint when dismissed (no layout shift). */
const HIDE_SCRIPT = `(function(s){try{if(document.cookie.split("; ").indexOf("${ANNOUNCE_COOKIE}=${ANNOUNCE_VALUE}")>-1){s.previousElementSibling.style.display="none"}}catch(e){}})(document.currentScript)`;

/** Thin announcement bar above the header. A dismissal is remembered for 30 days (functional cookie). */
export function AnnouncementBar() {
  const { t, locale } = useI18n();
  const path = usePathname() ?? "";
  const wasDismissed = useSyncExternalStore(noopSubscribe, dismissed, () => false);
  const [closed, setClosed] = useState(false);
  if (isTransactionalPath(path) || wasDismissed || closed) return null;
  return (
    <>
      <div className={styles.announce} role="region" aria-label={t("marketing.announce.link")}>
        <div className={`${styles.container} ${styles.announceInner}`}>
          <p>
            <span className={styles.announceLong}>{t("marketing.announce.text")}</span>
            <span className={styles.announceShort}>{t("marketing.announce.textShort")}</span>{" "}
            <Link href={`/${locale}#finishes`} className={`${styles.textLink} ${styles.announceLink}`}>
              {t("marketing.announce.link")}
            </Link>
          </p>
          <button
            type="button"
            className={styles.announceClose}
            aria-label={t("marketing.announce.dismiss")}
            onClick={() => {
              try {
                const secure = window.location.protocol === "https:" ? "; Secure" : "";
                document.cookie = `${ANNOUNCE_COOKIE}=${ANNOUNCE_VALUE}; Path=/; Max-Age=${DISMISS_DAYS * 86_400}; SameSite=Lax${secure}`;
              } catch {
                /* ignore */
              }
              setClosed(true);
            }}
          >
            <X size={16} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: HIDE_SCRIPT }} />
    </>
  );
}
