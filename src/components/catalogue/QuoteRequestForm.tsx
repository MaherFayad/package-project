"use client";

import { parseTypedWhole } from "@/lib/number-input";
import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
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
  const [qty, setQty] = useState("1000");
  const [preset, setPreset] = useState(presets[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error" | "qty" | "limited">("idle");

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
      <p className={styles.success} role="status">
        {COPY.formSent[locale]}
      </p>
    );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    // R5-JR-19: Arabic-Indic digits ("٥٠٠٠") used to be stripped to 0 and refused.
    const quantity = parseTypedWhole(qty) ?? NaN;
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
        <input id={`${id}-q`} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} aria-invalid={state === "qty" || undefined} aria-describedby={state === "qty" ? `${id}-qe` : undefined} required />
        {state === "qty" ? (
          <p id={`${id}-qe`} className={styles.error} role="alert">
            {COPY.formErrorQty[locale]}
          </p>
        ) : null}
      </div>
      {presets.length ? (
        <div className={styles.field}>
          <label htmlFor={`${id}-s`}>{COPY.formSize[locale]}</label>
          <select id={`${id}-s`} value={preset} onChange={(e) => setPreset(e.target.value)}>
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
        <textarea id={`${id}-n`} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} aria-describedby={`${id}-nh`} />
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
        <button type="submit" className={`${mk.pill} ${mk.pillLarge}`} disabled={state === "sending"}>
          {state === "sending" ? COPY.formSending[locale] : COPY.formSubmit[locale]}
        </button>
      </div>
      <p className={styles.hint}>{COPY.formPrivacy[locale]}</p>
    </form>
  );
}
