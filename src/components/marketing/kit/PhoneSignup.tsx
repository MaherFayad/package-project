"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { useI18n } from "@/i18n/client";
import { normalizeEgyptMobile } from "../HeroPhoneForm";
import styles from "./kit.module.css";

export interface PhoneSignupProps {
  /** Where an empty submit goes (the free designer) and where sign-in returns to. */
  designPath: string;
  /** Override any of the default strings (mk.phone.*). */
  labels?: Partial<{ label: string; placeholder: string; submit: string; error: string; fine: string }>;
  align?: "start" | "center";
  className?: string;
}

/**
 * Phone sign-up pill (the reference's "email + Start free" bar, with an Egyptian mobile because
 * Elba accounts are phone + OTP). Same logic as HeroPhoneForm: empty goes straight to the
 * designer; a valid number goes to sign-in with `next` (the number never goes in the URL: PDPL
 * 151/2020 data minimisation). Visible label (WCAG 3.3.2), inline error tied to the field (3.3.1).
 */
export function PhoneSignup({ designPath, labels, align = "start", className }: PhoneSignupProps) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const L = {
    label: labels?.label ?? t("mk.phone.label"),
    placeholder: labels?.placeholder ?? t("mk.phone.placeholder"),
    submit: labels?.submit ?? t("mk.phone.submit"),
    error: labels?.error ?? t("mk.phone.error"),
    fine: labels?.fine ?? t("mk.phone.fine"),
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) {
      router.push(designPath);
      return;
    }
    if (!normalizeEgyptMobile(value)) {
      setError(true);
      return;
    }
    router.push(`/${locale}/login?next=${encodeURIComponent(designPath)}`);
  };
  return (
    <form className={[styles.phone, className].filter(Boolean).join(" ")} data-align={align} onSubmit={onSubmit} noValidate>
      <label htmlFor={`${id}-phone`} className={styles.phoneLabel}>
        {L.label}
      </label>
      <div className={styles.phoneField}>
        <input
          id={`${id}-phone`}
          className={styles.phoneInput}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          dir="ltr"
          placeholder={L.placeholder}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(false);
          }}
          aria-invalid={error || undefined}
          aria-describedby={`${error ? `${id}-err ` : ""}${id}-fine`}
        />
        <button type="submit" className={styles.pill} data-variant="dark" data-size="md">
          {L.submit}
        </button>
      </div>
      {error ? (
        <p id={`${id}-err`} className={styles.phoneError} role="alert">
          {L.error}
        </p>
      ) : null}
      <p id={`${id}-fine`} className={styles.phoneFine}>
        {L.fine}
      </p>
    </form>
  );
}
