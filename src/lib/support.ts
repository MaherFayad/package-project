import { formatEgyptPhone, normalizeEgyptPhone } from "@/lib/phone";

/** Buyer help line: links for WhatsApp and a phone call, or null when none is configured. */
export interface SupportContact {
  /** "tel:+2010…" */
  tel: string;
  /** "https://wa.me/2010…" */
  whatsapp: string;
  /** "010 1234 5678" */
  display: string;
}

/**
 * The help line shown in checkout, payment and the order page (simplicity audit SIM-04).
 * Set `ELBA_SUPPORT_PHONE` to an Egyptian mobile number (any common format). Read on the server
 * and passed down as a prop; without it the help box falls back to "reply to our messages".
 */
export function supportContact(raw: string | undefined = process.env.ELBA_SUPPORT_PHONE): SupportContact | null {
  const e164 = raw ? normalizeEgyptPhone(raw) : null;
  if (!e164) return null;
  return { tel: `tel:${e164}`, whatsapp: `https://wa.me/${e164.replace(/^\+/, "")}`, display: formatEgyptPhone(e164) };
}
