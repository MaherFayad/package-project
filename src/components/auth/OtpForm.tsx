"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n";
import type { Role } from "@/types";
import styles from "./OtpForm.module.css";

export interface OtpSuccess {
  id: string;
  role: Role;
  name: string | null;
  isNew: boolean;
}

/**
 * Two-step phone + OTP sign-in/sign-up form. Reusable anywhere (login page, AuthGateDialog).
 * Calls /api/auth/request-otp then /api/auth/verify-otp. In dev the code is shown in a banner.
 */
export function OtpForm({ onSuccess, reason }: { onSuccess: (u: OtpSuccess) => void; reason?: string }) {
  const { t, locale } = useI18n();
  const uid = useId();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [normalized, setNormalized] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  function errorText(codeKey: string, retryAfterSec?: number) {
    return t(`auth.errors.${codeKey}` as DictKey, { seconds: retryAfterSec ?? 30 });
  }

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(errorText(data.error ?? "INVALID_INPUT", data.retryAfterSec));
        return;
      }
      setNormalized(data.phone);
      setDevCode(data.devCode ?? null);
      setStep("code");
      setCooldown(30);
    } catch {
      setError(t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: normalized,
          code,
          name: name || undefined,
          locale,
          acceptTerms,
          marketingConsent: marketing,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(errorText(data.error ?? "INVALID_INPUT", data.retryAfterSec));
        return;
      }
      onSuccess(data.user as OtpSuccess);
    } catch {
      setError(t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  const errId = `${uid}-err`;
  return (
    <div className={styles.root}>
      {reason && <p className={styles.reason}>{reason}</p>}
      {error && (
        <p id={errId} role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {step === "phone" ? (
        <form onSubmit={sendCode} className={styles.form} noValidate>
          <label className={styles.field}>
            <span className={styles.label}>{t("auth.phoneLabel")}</span>
            <input
              className={styles.input}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              aria-describedby={`${uid}-hint${error ? ` ${errId}` : ""}`}
              aria-invalid={!!error}
              placeholder="010 1234 5678"
            />
            <span id={`${uid}-hint`} className={styles.hint}>
              {t("auth.phoneHint")}
            </span>
          </label>
          <button type="submit" className={styles.primary} disabled={busy || phone.trim().length < 8}>
            {busy ? t("common.loading") : t("auth.sendCode")}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className={styles.form} noValidate>
          {devCode && (
            <p className={styles.devBanner} role="status" data-testid="otp-dev-code">
              {t("auth.devBanner", { code: devCode })}
            </p>
          )}
          <label className={styles.field}>
            <span className={styles.label}>{t("auth.codeLabel")}</span>
            <input
              className={styles.input}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              dir="ltr"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              aria-describedby={`${uid}-codehint`}
              aria-invalid={!!error}
            />
            <span id={`${uid}-codehint`} className={styles.hint}>
              {t("auth.codeHint", { phone: normalized })}
            </span>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>
              {t("auth.nameLabel")} <span className={styles.muted}>({t("common.optional")})</span>
            </span>
            <input
              className={styles.input}
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className={styles.check}>
            <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
            <span>{t("auth.acceptTerms")}</span>
          </label>
          <label className={styles.check}>
            <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
            <span>{t("auth.marketingConsent")}</span>
          </label>
          <button type="submit" className={styles.primary} disabled={busy || code.length !== 6}>
            {busy ? t("common.loading") : t("auth.verify")}
          </button>
          <div className={styles.row}>
            <button type="button" className={styles.plain} onClick={() => setStep("phone")}>
              {t("auth.changeNumber")}
            </button>
            <button type="button" className={styles.plain} disabled={cooldown > 0 || busy} onClick={() => sendCode()}>
              {cooldown > 0 ? t("auth.resendIn", { seconds: cooldown }) : t("auth.resend")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
