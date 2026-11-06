"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { BellOff, Check } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { unsubscribeAction, type UnsubscribeState } from "./actions";
import styles from "../login/login.module.css";
import own from "./unsubscribe.module.css";

/**
 * Confirmation card. The withdrawal is a POST (the button), so link scanners and chat previews that
 * GET the URL change nothing. The outcome replaces the heading and text, and focus moves to the
 * new heading (WCAG 2.4.3, 4.1.3).
 */
export function UnsubscribeForm({ userId, token }: { userId: string; token: string }) {
  const { t, locale } = useI18n();
  const [state, action, pending] = useActionState<UnsubscribeState, FormData>(unsubscribeAction, { status: "idle" });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const outcome = state.status === "done" || state.status === "invalid";
  useEffect(() => {
    if (outcome) headingRef.current?.focus();
  }, [outcome]);

  const title = state.status === "done" ? "unsubscribe.doneTitle" : state.status === "invalid" ? "unsubscribe.invalidTitle" : "unsubscribe.title";
  const body = state.status === "done" ? "unsubscribe.doneBody" : state.status === "invalid" ? "unsubscribe.invalidBody" : "unsubscribe.body";
  return (
    <section className={styles.card} aria-labelledby="unsub-title">
      <header className={styles.head} role={outcome ? "status" : undefined}>
        <span className={styles.badge} aria-hidden="true">
          {state.status === "done" ? <Check size={20} /> : <BellOff size={20} />}
        </span>
        <h1 id="unsub-title" ref={headingRef} tabIndex={-1} className={`${styles.title} ${own.heading}`}>
          {t(title)}
        </h1>
        <p className={styles.subtitle}>{t(body)}</p>
      </header>
      {outcome ? (
        <Link className={own.secondary} href={`/${locale}/account`}>
          {t("unsubscribe.account")}
        </Link>
      ) : (
        <form action={action} className={own.form}>
          <input type="hidden" name="u" value={userId} />
          <input type="hidden" name="t" value={token} />
          <input type="hidden" name="locale" value={locale} />
          {state.status === "error" ? (
            <p className={own.error} role="alert">
              {t("unsubscribe.error")}
            </p>
          ) : null}
          <button
            type="submit"
            className={own.primary}
            aria-disabled={pending || undefined}
            aria-busy={pending || undefined}
            onClick={(e) => pending && e.preventDefault()}
          >
            {pending ? t("unsubscribe.busy") : t("unsubscribe.button")}
          </button>
          <Link className={own.secondary} href={`/${locale}`}>
            {t("unsubscribe.home")}
          </Link>
        </form>
      )}
    </section>
  );
}
