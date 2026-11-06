/**
 * Clean a person's or company's display name before it is stored (security R5-SEC-11).
 *
 * Names are typed by buyers (sign-up, profile) and printed back to admins, vendors (first name),
 * on order receipts and tax invoices, and later into ETA e-invoice submissions and WhatsApp
 * templates. Before this, `"Ahmed ‮FEDCBA‬\u0000\u0007"` was stored as is: the bidi override
 * makes text render reversed (display spoofing in admin tables, e.g. an "Admin" or "Elba" look-alike),
 * and NUL / BEL / other control characters break PDFs, logs and the ETA JSON. Arabic and Latin
 * letters, digits, punctuation and the normal joiners (ZWJ/ZWNJ for Arabic shaping) are kept; only
 * C0/C1 controls, bidi embeddings, overrides and isolates and the BOM are removed. OWASP ASVS 4.0.3
 * V5.1.4 (structured data), V5.2.2 (sanitise untrusted text); Unicode TR #36 (bidi spoofing).
 */
const STRIP = /[\u0000-\u001f\u007f-\u009f‪-‮⁦-⁩‎‏؜﻿]/g;

export function cleanDisplayName(raw: string): string {
  return raw.normalize("NFC").replace(STRIP, "").replace(/\s+/g, " ").trim();
}
