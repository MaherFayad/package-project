"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import styles from "./marketing.module.css";

/** Egyptian mobile: 01[0125] + 8 digits, after removing spaces, dashes and a +20 / 0020 prefix. */
export function normalizeEgyptMobile(raw: string): string | null {
  const ascii = raw.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  let s = ascii.replace(/[\s\-().]/g, "");
  if (s.startsWith("+20")) s = `0${s.slice(3)}`;
  else if (s.startsWith("0020")) s = `0${s.slice(4)}`;
  return /^01[0125]\d{8}$/.test(s) ? s : null;
}

/**
 * Hero lead form (marketing-site "email + start" pattern, with a mobile number because Elba
 * accounts are phone + OTP). The number is optional: empty goes straight to the free
 * designer; a valid number goes to sign-in first (we text a code), then into the designer.
 */
export function HeroPhoneForm({
  locale,
  designPath,
  labels,
}: {
  locale: string;
  designPath: string;
  labels: { label: string; placeholder: string; submit: string; error: string; fine: string };
}) {
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) {
      router.push(designPath);
      return;
    }
    const phone = normalizeEgyptMobile(value);
    if (!phone) {
      setError(true);
      return;
    }
    router.push(`/${locale}/login?next=${encodeURIComponent(designPath)}&phone=${phone}`);
  };
  return (
    <form className={styles.heroForm} onSubmit={onSubmit} noValidate>
      <label htmlFor={`${id}-phone`} className={styles.heroFieldLabel}>
        {labels.label}
      </label>
      <div className={styles.heroField}>
        <input
          id={`${id}-phone`}
          className={styles.heroInput}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          dir="ltr"
          placeholder={labels.placeholder}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(false);
          }}
          aria-invalid={error || undefined}
          aria-describedby={`${error ? `${id}-err ` : ""}${id}-fine`}
        />
        <button type="submit" className={`${styles.pill} ${styles.pillLarge}`}>
          {labels.submit}
        </button>
      </div>
      {error ? (
        <p id={`${id}-err`} className={styles.heroError} role="alert">
          {labels.error}
        </p>
      ) : null}
      <p id={`${id}-fine`} className={styles.fine}>
        {labels.fine}
      </p>
    </form>
  );
}
