/** Edge-safe auth constants (importable from middleware and client code). */
export const SESSION_COOKIE = "elba_session";
export const ANON_COOKIE = "elba_anon";
export const LOCALE_COOKIE = "elba_locale";
export const SESSION_TTL_DAYS = 30;
export const OTP_TTL_MINUTES = 5;
export const OTP_LENGTH = 6;
export const OTP_MAX_ATTEMPTS = 5;
/** Version id of the consent wording shown on the sign-up form. Bump when the text changes. */
export const CONSENT_TEXT_VERSION = "2026-11-06";
/** Wrong codes per phone (across all its codes) before sign-in is locked for the window. */
export const OTP_LOCKOUT_MAX_FAILURES = 10;
export const OTP_LOCKOUT_WINDOW_MINUTES = 60;
/** OTP rows (phone + IP) are deleted after this many hours (PDPL storage limitation). */
export const OTP_RETENTION_HOURS = 24;
/**
 * ADMIN sessions end this many hours after sign-in, whatever the cookie says (security R5-SEC-12;
 * OWASP ASVS 4.0.3 V3.3.2 Level 2: re-authenticate within 12 hours). Admins can refund, read every
 * buyer's data and export it; buyers and vendor staff keep the 30-day session.
 */
export const ADMIN_SESSION_MAX_HOURS = 12;

/** Pure: whether a stored session still counts at `now` (expiry, plus the admin cap). */
export function sessionLive(s: { expiresAt: Date; createdAt: Date }, role: string, now: Date = new Date()): boolean {
  if (s.expiresAt <= now) return false;
  if (role === "ADMIN" && now.getTime() - s.createdAt.getTime() > ADMIN_SESSION_MAX_HOURS * 3_600_000) return false;
  return true;
}
