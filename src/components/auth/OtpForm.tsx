"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n";
import type { Role } from "@/types";
import { formatEgyptPhone, normalizeEgyptPhone, toWesternDigits } from "@/lib/phone";
import { formatCount } from "@/lib/format";
import styles from "./OtpForm.module.css";

export interface OtpSuccess {
  id: string;
  role: Role;
  name: string | null;
  isNew: boolean;
}

const RESEND_SECONDS = 30;
const CODE_LENGTH = 6;

/**
 * Left-to-right isolate so "+20…" and digits never reorder inside Arabic sentences, with
 * no-break spaces so a number never wraps across two lines (WCAG 1.3.2).
 */
const ltr = (s: string) => `\u2066${s.replace(/ /g, "\u00a0")}\u2069`;

/**
 * Render a dictionary string that contains {placeholders} as rich content:
 *   rich("I agree to the {terms} and the {privacy}", { terms: <a/>, privacy: <a/> })
 */
function rich(template: string, parts: Record<string, ReactNode>): ReactNode[] {
  return template.split(/(\{\w+\})/g).map((chunk, i) => {
    const m = /^\{(\w+)\}$/.exec(chunk);
    return m && m[1] in parts ? <span key={i}>{parts[m[1]]}</span> : chunk;
  });
}

/**
 * Two-step phone + OTP sign-in/sign-up form. Reusable anywhere (login page, AuthGateDialog).
 * Calls /api/auth/request-otp then /api/auth/verify-otp. In dev the code is shown in a banner.
 *
 * Accessibility (WCAG 2.2): errors are announced (role=alert, 4.1.3) and tied to the field
 * (aria-describedby + aria-invalid, 3.3.1); focus moves to the next field on each step and to
 * the field in error (2.4.3); the phone and code are LTR islands inside RTL (1.3.2).
 */
export function OtpForm({ onSuccess, reason }: { onSuccess: (u: OtpSuccess) => void; reason?: string }) {
  const { t, locale } = useI18n();
  const uid = useId();
  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [normalized, setNormalized] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<{ text: string; field: "phone" | "code" | "terms" | null } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const phoneRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const termsRef = useRef<HTMLInputElement>(null);
  const firstStep = useRef(true);

  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  // Move focus with the step (not on first render: the page decides initial focus).
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    (step === "code" ? codeRef : phoneRef).current?.focus();
  }, [step]);

  function fail(codeKey: string, retryAfterSec?: number) {
    const seconds = retryAfterSec ?? RESEND_SECONDS;
    const text = t(`auth.errors.${codeKey}` as DictKey, {
      seconds: formatCount(seconds, "second", locale),
      minutes: formatCount(Math.max(1, Math.ceil(seconds / 60)), "minute", locale),
    });
    const field =
      codeKey === "TERMS_REQUIRED"
        ? "terms"
        : codeKey === "INVALID_PHONE"
          ? "phone"
          : step === "code" && codeKey !== "RATE_LIMITED" && codeKey !== "LOCKED"
            ? "code"
            : null;
    setError({ text, field });
    if (retryAfterSec && (codeKey === "RATE_LIMITED" || codeKey === "LOCKED")) setCooldown(retryAfterSec);
    const target = field === "terms" ? termsRef : field === "code" ? codeRef : field === "phone" ? phoneRef : null;
    requestAnimationFrame(() => target?.current?.focus());
  }

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    setNotice(null);
    const target = step === "code" ? normalized : normalizeEgyptPhone(phone);
    if (!target) {
      fail("INVALID_PHONE");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: target }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // A server fault is not the user's input: say "something went wrong", not "check your details".
        if (res.status >= 500 || !data.error) setError({ text: t("common.error"), field: null });
        else fail(data.error, data.retryAfterSec);
        return;
      }
      const resent = step === "code";
      setNormalized(data.phone);
      setDevCode(data.devCode ?? null);
      setCode("");
      setStep("code");
      setCooldown(RESEND_SECONDS);
      setNotice(t(resent ? "auth.codeResent" : "auth.codeSent", { phone: ltr(formatEgyptPhone(data.phone)) }));
      if (resent) codeRef.current?.focus();
    } catch {
      setError({ text: t("common.error"), field: null });
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (code.length !== CODE_LENGTH) {
      fail("CODE_LENGTH");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: normalized,
          code,
          name: name.trim() || undefined,
          locale,
          acceptTerms,
          // Only an explicit tick is sent: leaving the box empty must never withdraw an
          // earlier consent (PDPL 151/2020; withdrawal lives on the account page).
          ...(marketing ? { marketingConsent: true } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // A server fault is not the user's input: say "something went wrong", not "check your details".
        if (res.status >= 500 || !data.error) setError({ text: t("common.error"), field: null });
        else fail(data.error, data.retryAfterSec);
        return;
      }
      onSuccess(data.user as OtpSuccess);
    } catch {
      setError({ text: t("common.error"), field: null });
    } finally {
      setBusy(false);
    }
  }

  const errId = `${uid}-err`;
  const describe = (own: string, field: "phone" | "code" | "terms") =>
    [own, error?.field === field ? errId : null].filter(Boolean).join(" ") || undefined;
  const newTab = <span className="visually-hidden"> {t("auth.opensNewTab")}</span>;
  const legalLink = (doc: "terms" | "privacy", label: string) => (
    <a href={`/${locale}/legal/${doc}`} target="_blank" rel="noopener" className={styles.link}>
      {label}
      {newTab}
    </a>
  );

  return (
    <div className={styles.root}>
      {reason && <p className={styles.reason}>{reason}</p>}
      {error && (
        <p id={errId} role="alert" className={styles.error}>
          {error.text}
        </p>
      )}
      <p role="status" className={notice ? styles.notice : "visually-hidden"}>
        {notice}
      </p>
      {step === "phone" ? (
        <form onSubmit={sendCode} className={styles.form} noValidate>
          <div className={styles.field}>
            <label htmlFor={`${uid}-phone`} className={styles.label}>
              {t("auth.phoneLabel")}
            </label>
            <input
              ref={phoneRef}
              id={`${uid}-phone`}
              className={`${styles.input} ${styles.ltr}`}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              required
              aria-required="true"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (error?.field === "phone") setError(null);
              }}
              aria-describedby={describe(`${uid}-hint`, "phone")}
              aria-invalid={error?.field === "phone" || undefined}
              placeholder="010 1234 5678"
            />
            <span id={`${uid}-hint`} className={styles.hint}>
              {t("auth.phoneHint")}
            </span>
          </div>
          <button type="submit" className={styles.primary} disabled={!hydrated || busy} aria-busy={busy || undefined}>
            {busy ? t("auth.sending") : t("auth.sendCode")}
          </button>
          <p className={styles.fine}>
            {rich(t("auth.privacyNote"), { privacy: legalLink("privacy", t("auth.privacyLink")) })}
          </p>
        </form>
      ) : (
        <form onSubmit={verify} className={styles.form} noValidate>
          {devCode && (
            <p className={styles.devBanner} role="status" data-testid="otp-dev-code">
              {t("auth.devBanner", { code: devCode })}
            </p>
          )}
          <div className={styles.field}>
            <label htmlFor={`${uid}-code`} className={styles.label}>
              {t("auth.codeLabel")}
            </label>
            <input
              ref={codeRef}
              id={`${uid}-code`}
              className={`${styles.input} ${styles.code}`}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              dir="ltr"
              required
              aria-required="true"
              value={code}
              onChange={(e) => {
                // Arabic-Indic digits from Arabic keyboards and pasted "123 456" both work.
                setCode(toWesternDigits(e.target.value).replace(/\D/g, "").slice(0, CODE_LENGTH));
                if (error?.field === "code") setError(null);
              }}
              aria-describedby={describe(`${uid}-codehint`, "code")}
              aria-invalid={error?.field === "code" || undefined}
            />
            <span id={`${uid}-codehint`} className={styles.hint}>
              {t("auth.codeHint", { phone: ltr(formatEgyptPhone(normalized)) })}{" "}
              <button
                type="button"
                className={styles.inlineLink}
                onClick={() => {
                  setError(null);
                  setNotice(null);
                  setDevCode(null);
                  setCode("");
                  setStep("phone");
                }}
              >
                {t("auth.changeNumber")}
              </button>
            </span>
          </div>
          <div className={styles.field}>
            <label htmlFor={`${uid}-name`} className={styles.label}>
              {t("auth.nameLabel")} <span className={styles.muted}>({t("common.optional")})</span>
            </label>
            <input
              id={`${uid}-name`}
              className={styles.input}
              type="text"
              autoComplete="name"
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-describedby={`${uid}-namehint`}
            />
            <span id={`${uid}-namehint`} className={styles.hint}>
              {t("auth.nameHint")}
            </span>
          </div>
          <fieldset className={styles.consents}>
            <legend className="visually-hidden">{t("auth.consentLegend")}</legend>
            <div className={styles.check}>
              <input
                ref={termsRef}
                id={`${uid}-terms`}
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => {
                  setAcceptTerms(e.target.checked);
                  if (error?.field === "terms") setError(null);
                }}
                aria-invalid={error?.field === "terms" || undefined}
                aria-describedby={describe(`${uid}-termshint`, "terms")}
              />
              <label htmlFor={`${uid}-terms`}>
                {rich(t("auth.acceptTermsRich"), {
                  terms: legalLink("terms", t("auth.termsLink")),
                  privacy: legalLink("privacy", t("auth.privacyLink")),
                })}
                <span id={`${uid}-termshint`} className={styles.checkHint}>
                  {t("auth.acceptTermsHint")}
                </span>
              </label>
            </div>
            <div className={styles.check}>
              <input id={`${uid}-mkt`} type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
              <label htmlFor={`${uid}-mkt`}>
                {t("auth.marketingConsent")}
                <span className={styles.checkHint}>{t("auth.marketingHint")}</span>
              </label>
            </div>
          </fieldset>
          <button type="submit" className={styles.primary} disabled={busy} aria-busy={busy || undefined}>
            {busy ? t("auth.verifying") : t("auth.verify")}
          </button>
          <div className={styles.row}>
            <button type="button" className={styles.plain} disabled={cooldown > 0 || busy} onClick={() => sendCode()}>
              {cooldown > 0 ? t("auth.resendIn", { seconds: formatCount(cooldown, "second", locale) }) : t("auth.resend")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
