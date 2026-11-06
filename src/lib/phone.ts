/** Arabic-Indic (٠-٩) and Extended Arabic-Indic (۰-۹) digits -> ASCII 0-9. Other characters untouched. */
export function toWesternDigits(input: string): string {
  return input
    .replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (c) => String(c.charCodeAt(0) - 0x06f0));
}

/**
 * Egyptian mobile numbers. Accepts "01012345678", "+201012345678", "201012345678",
 * "1012345678", with spaces/dashes, and Arabic-Indic digits. Returns E.164 or null.
 * Valid prefixes: 010, 011, 012, 015.
 */
export function normalizeEgyptPhone(input: string): string | null {
  const ascii = toWesternDigits(input)
    // Bidi controls pasted from RTL text (LRM/RLM, embeddings, isolates) and separators.
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/[\s\-().]/g, "");
  let digits = ascii.replace(/^\+/, "");
  if (digits.startsWith("0020")) digits = digits.slice(4);
  else if (digits.startsWith("20")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (!/^1[0125]\d{8}$/.test(digits)) return null;
  return `+20${digits}`;
}

/** "+201012345678" -> "010 1234 5678" (display). */
export function formatEgyptPhone(e164: string): string {
  const local = e164.startsWith("+20") ? `0${e164.slice(3)}` : e164;
  return local.replace(/^(\d{3})(\d{4})(\d{4})$/, "$1 $2 $3");
}
