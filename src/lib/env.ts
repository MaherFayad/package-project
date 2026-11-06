/** Server env access with dev-safe defaults. Server-only. */
export const isProd = process.env.NODE_ENV === "production";

/** Values shipped in .env.example / docs: never acceptable as a production secret. */
const KNOWN_PLACEHOLDER_SECRETS = new Set(["dev-only-change-me-please-32-chars-min", "dev-only-insecure-session-secret"]);

/**
 * Problems with a SESSION_SECRET for the given mode (pure, unit-tested). Production needs 32+
 * characters that are not a published placeholder (OWASP ASVS 4.0.3 V2.9.1 / V6.4.1 / V14.1.3).
 */
export function sessionSecretProblem(secret: string | undefined, prod: boolean, localProdBuild = false): string | null {
  if (!secret) return "SESSION_SECRET is not set";
  if (prod && secret.length < 32) return "SESSION_SECRET must be at least 32 characters in production";
  if (!prod && secret.length < 16) return "SESSION_SECRET is shorter than 16 characters";
  // Local `next start` runs and e2e (marked by OTP_DEV_ECHO=1, which must never be set in a
  // deployment) may keep the .env.example value; a real deployment may not.
  if (prod && !localProdBuild && KNOWN_PLACEHOLDER_SECRETS.has(secret)) return "SESSION_SECRET is the published example value";
  return null;
}

export function sessionSecret(): string {
  const s = process.env.SESSION_SECRET;
  const problem = sessionSecretProblem(s, isProd, process.env.OTP_DEV_ECHO === "1");
  if (problem) {
    if (isProd) throw new Error(problem);
    return "dev-only-insecure-session-secret";
  }
  return s!;
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

/** Production per-IP OTP limits (requests per hour, verifications per 10 minutes). */
export const OTP_IP_LIMITS = { requestPerHour: 20, verifyPer10Min: 30 } as const;

/**
 * Per-IP OTP limits. The e2e suite signs in many fresh phones from 127.0.0.1 (and back-to-back
 * runs can reuse one server), which would trip the per-IP limits although every phone is unique.
 * They are relaxed ONLY when both test markers are set: `ELBA_E2E=1` (set by playwright.config's
 * webServer) AND the OTP dev echo is on (dev server, or `OTP_DEV_ECHO=1` on a local `next start`;
 * that flag already puts codes in API responses and must never be set in a deployment). A real
 * deployment has neither, so the production limits always apply there. Per-phone limits and the
 * lockout are never relaxed. Pure (env passed in) and unit-tested.
 */
export function otpIpLimits(env: Record<string, string | undefined> = process.env): { requestPerHour: number; verifyPer10Min: number } {
  const prod = env.NODE_ENV === "production";
  const devEcho = prod ? env.OTP_DEV_ECHO === "1" : env.OTP_DEV_ECHO !== "0";
  if (env.ELBA_E2E === "1" && devEcho) return { requestPerHour: 5_000, verifyPer10Min: 5_000 };
  return { ...OTP_IP_LIMITS };
}
