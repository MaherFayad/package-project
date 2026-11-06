"use client";

import { parseWholeInput } from "@/lib/money/input";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { Locale } from "@/types";
import type { CataloguePresetRow } from "@/data/catalogue/types";
import { COPY } from "./copy";
import mk from "@/components/marketing/marketing.module.css";
import styles from "./catalogue.module.css";

/**
 * Request-a-quote form for models no printer prices instantly. Signed-out visitors get a
 * sign-in link that comes back here (the reply goes to the account phone).
 */
export function QuoteRequestForm({ locale, code, slug, presets, signedIn }: { locale: Locale; code: string; slug: string; presets: (CataloguePresetRow & { label: string })[]; signedIn: boolean }) {
  const id = useId();
  // a11y R6-AX-02: the fields are uncontrolled and read from the form on submit. A value typed
  // before hydration (slow phone, busy server) used to be replaced by the default state, so the
  // field showed "5000" while "1000" was sent. Send waits for hydration (before it, a press
  // would do a native GET of this page).
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error" | "qty" | "limited">("idle");
  // The form (and its focused Send button) is replaced by the confirmation: move focus to it so
  // keyboard and screen-reader users are not dropped to <body> (WCAG 2.4.3).
  const sentRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state === "sent") sentRef.current?.focus();
  }, [state]);

  if (!signedIn)
    return (
      <div className={styles.ctaRow}>
        <Link className={`${mk.pill} ${mk.pillLarge}`} href={`/${locale}/login?next=${encodeURIComponent(`/${locale}/catalog/${slug}#quote`)}`}>
          {COPY.formSignIn[locale]}
        </Link>
      </div>
    );

  if (state === "sent")
    return (
      <p className={styles.success} role="status" tabIndex={-1} ref={sentRef}>
        {COPY.formSent[locale]}
      </p>
    );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget as HTMLFormElement);
    const qty = String(f.get("quantity") ?? "");
    const preset = String(f.get("preset") ?? "");
    const notes = String(f.get("notes") ?? "");
    // R5-JR-19: Arabic-Indic digits ("٥٠٠٠") used to be stripped to 0 and refused.
    const quantity = parseWholeInput(qty) ?? NaN;
    if (!Number.isInteger(quantity) || quantity < 100 || quantity > 1_000_000) return setState("qty");
    setState("sending");
    try {
      const res = await fetch("/api/catalogue/quote-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, quantity, ...(preset ? { presetId: preset } : {}), ...(notes.trim() ? { notes: notes.trim() } : {}) }),
      });
      setState(res.ok ? "sent" : res.status === 429 ? "limited" : "error");
    } catch {
      setState("error");
    }
  };

  return (
    <form className={styles.form} onSubmit={submit} noValidate aria-labelledby={`${id}-t`} id="quote">
      <h3 id={`${id}-t`} className={mk.h3}>
        {COPY.formTitle[locale]}
      </h3>
      <div className={styles.field}>
        <label htmlFor={`${id}-q`}>{COPY.formQty[locale]}</label>
        <input id={`${id}-q`} name="quantity" inputMode="numeric" defaultValue="1000" aria-invalid={state === "qty" || undefined} aria-describedby={state === "qty" ? `${id}-qe` : undefined} required />
        {state === "qty" ? (
          <p id={`${id}-qe`} className={styles.error} role="alert">
            {COPY.formErrorQty[locale]}
          </p>
        ) : null}
      </div>
      {presets.length ? (
        <div className={styles.field}>
          <label htmlFor={`${id}-s`}>{COPY.formSize[locale]}</label>
          <select id={`${id}-s`} name="preset" defaultValue={presets[0]?.id ?? ""}>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className={styles.field}>
        <label htmlFor={`${id}-n`}>{COPY.formNotes[locale]}</label>
        <textarea id={`${id}-n`} name="notes" maxLength={1000} aria-describedby={`${id}-nh`} />
        <p id={`${id}-nh`} className={styles.hint}>
          {COPY.formNotesHint[locale]}
        </p>
      </div>
      {state === "error" || state === "limited" ? (
        <p className={styles.error} role="alert">
          {state === "limited" ? COPY.formRateLimited[locale] : COPY.formError[locale]}
        </p>
      ) : null}
      <div className={styles.ctaRow}>
        <button type="submit" className={`${mk.pill} ${mk.pillLarge}`} disabled={!hydrated || state === "sending"}>
          {state === "sending" ? COPY.formSending[locale] : COPY.formSubmit[locale]}
        </button>
      </div>
      <p className={styles.hint}>{COPY.formPrivacy[locale]}</p>
    </form>
  );
}
