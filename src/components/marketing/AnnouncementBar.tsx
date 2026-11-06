"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useI18n } from "@/i18n/client";
import styles from "./marketing.module.css";

const KEY = "elba_announce_v1";

/** Thin announcement bar above the header. Dismissal is remembered for the browser session. */
export function AnnouncementBar() {
  const { t, locale } = useI18n();
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try {
      if (sessionStorage.getItem(KEY) === "1") setHidden(true);
    } catch {
      /* storage blocked: keep showing */
    }
  }, []);
  if (hidden) return null;
  return (
    <div className={styles.announce} role="region" aria-label={t("marketing.announce.link")}>
      <div className={`${styles.container} ${styles.announceInner}`}>
        <p>
          {t("marketing.announce.text")}{" "}
          <Link href={`/${locale}#finishes`} className={styles.textLink}>
            {t("marketing.announce.link")}
          </Link>
        </p>
        <button
          type="button"
          className={styles.announceClose}
          aria-label={t("marketing.announce.dismiss")}
          onClick={() => {
            try {
              sessionStorage.setItem(KEY, "1");
            } catch {
              /* ignore */
            }
            setHidden(true);
          }}
        >
          <X size={18} aria-hidden />
        </button>
      </div>
    </div>
  );
}
