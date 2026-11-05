/**
 * Egyptian mobile numbers. Accepts "01012345678", "+201012345678", "201012345678",
 * "1012345678", with spaces/dashes, and Arabic-Indic digits. Returns E.164 or null.
 * Valid prefixes: 010, 011, 012, 015.
 */
export function normalizeEgyptPhone(input: string): string | null {
  const ascii = input
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
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
