/** Server env access with dev-safe defaults. Server-only. */
export const isProd = process.env.NODE_ENV === "production";

export function sessionSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    if (isProd) throw new Error("SESSION_SECRET must be set (>= 32 chars) in production");
    return "dev-only-insecure-session-secret";
  }
  return s;
}

/**
 * Whether OTP codes are echoed to the client (dev banner) and logged to the console.
 * - `next dev`: on unless OTP_DEV_ECHO="0".
 * - `next start` (NODE_ENV=production): only when OTP_DEV_ECHO="1" explicitly — used for
 *   local prod builds and Playwright e2e. NEVER set OTP_DEV_ECHO in a real deployment.
 */
export function otpDevEcho(): boolean {
  if (isProd) return process.env.OTP_DEV_ECHO === "1";
  return process.env.OTP_DEV_ECHO !== "0";
}

export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
