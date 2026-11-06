/** Edge-safe auth constants (importable from middleware and client code). */
export const SESSION_COOKIE = "elba_session";
export const ANON_COOKIE = "elba_anon";
export const LOCALE_COOKIE = "elba_locale";
export const SESSION_TTL_DAYS = 30;
export const OTP_TTL_MINUTES = 5;
export const OTP_LENGTH = 6;
export const OTP_MAX_ATTEMPTS = 5;
/** Version id of the consent wording shown on the sign-up form. Bump when the text changes. */
export const CONSENT_TEXT_VERSION = "2026-11-05";
/** Wrong codes per phone (across all its codes) before sign-in is locked for the window. */
export const OTP_LOCKOUT_MAX_FAILURES = 10;
export const OTP_LOCKOUT_WINDOW_MINUTES = 60;
/** OTP rows (phone + IP) are deleted after this many hours (PDPL storage limitation). */
export const OTP_RETENTION_HOURS = 24;
