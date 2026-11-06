import type { ConsentKind } from "@/types";

export interface SignInConsentInput {
  isNew: boolean;
  acceptTerms: boolean;
  /** The marketing box as sent by the form (undefined = not sent). */
  marketingConsent: boolean | undefined;
  /** The user's stored marketing consent (false for a new user). */
  currentMarketing: boolean;
  /** textVersion of the user's latest granted TERMS consent, or null. */
  acceptedTermsVersion: string | null;
  /** CONSENT_TEXT_VERSION of the wording on the form now. */
  textVersion: string;
}

export interface SignInConsentPlan {
  /** Consent rows to append to the PDPL log. */
  rows: { kind: ConsentKind; granted: boolean }[];
  /** New value for User.marketingConsent, or null to leave it unchanged. */
  marketing: boolean | null;
}

/**
 * What a sign-in may record (Egypt PDPL, Law 151/2020: consent must be explicit, specific and
 * provable; withdrawal must be a deliberate act).
 *
 * - New account: TERMS + PRIVACY (ticked), plus MARKETING with whatever the separate box says.
 * - Returning user: a ticked marketing box records a grant if they had not consented; an
 *   unticked box changes NOTHING (it is unticked by default, so it is not a withdrawal).
 *   Withdrawal lives on the account page.
 * - Returning user who ticks terms while their last acceptance was of an older wording:
 *   record TERMS + PRIVACY for the current version.
 */
export function consentRowsForSignIn(i: SignInConsentInput): SignInConsentPlan {
  const rows: SignInConsentPlan["rows"] = [];
  let marketing: boolean | null = null;
  if (i.isNew) {
    rows.push({ kind: "TERMS", granted: true }, { kind: "PRIVACY", granted: true });
    marketing = i.marketingConsent === true;
    rows.push({ kind: "MARKETING", granted: marketing });
    return { rows, marketing };
  }
  if (i.acceptTerms && i.acceptedTermsVersion !== i.textVersion) {
    rows.push({ kind: "TERMS", granted: true }, { kind: "PRIVACY", granted: true });
  }
  if (i.marketingConsent === true && !i.currentMarketing) {
    marketing = true;
    rows.push({ kind: "MARKETING", granted: true });
  }
  return { rows, marketing };
}

/**
 * Whether a user's CURRENT consent of one kind is a grant: the latest row of that kind decides
 * (the PDPL log is append-only, so a later withdrawal row overrides an earlier grant). No row at
 * all means no consent. Used by the B-23 WhatsApp follow-up job for MARKETING.
 */
export function currentConsentGranted(rows: readonly { kind: string; granted: boolean; createdAt: Date }[], kind: ConsentKind): boolean {
  let latest: { granted: boolean; createdAt: Date } | null = null;
  for (const r of rows) {
    if (r.kind !== kind) continue;
    if (!latest || r.createdAt.getTime() >= latest.createdAt.getTime()) latest = r;
  }
  return latest?.granted === true;
}
