import type { Locale } from "@/types";

/** Elba wordmark for the marketing site: our own box mark + name (never mirrored). */
export function Wordmark({ locale }: { locale: Locale }) {
  return (
    <>
      <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false">
        <path d="M12 2.5 21 7v10l-9 4.5L3 17V7z" fill="var(--e-color-brand-kraft, #c8955c)" />
        <path d="M3 7l9 4.5L21 7M12 11.5V21.5" fill="none" stroke="var(--e-color-brand-kraft-strong, #8a5a2b)" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
      <span>{locale === "ar" ? "علبة" : "Elba"}</span>
    </>
  );
}
