/** Relative luminance of a #RRGGBB colour (WCAG 2.x). */
export function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return 1;
  const [r, g, b] = m.slice(1).map((h) => {
    const c = parseInt(h, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Dark ink (#303030) or white, whichever reads better on `background`. */
export function contrastingInk(background: string): string {
  return contrastRatio("#303030", background) >= contrastRatio("#ffffff", background) ? "#303030" : "#ffffff";
}

/**
 * R11-02: a colour code as people type or paste it: spaces trimmed, Arabic-Indic (٠-٩) and
 * Persian (۰-۹) digits from an Arabic keyboard read as 0-9, "#" optional, the short "#rgb" form
 * expanded. Returns "#rrggbb" in lower case, or null when it is not a colour.
 */
export function normalizeHex(input: string): string | null {
  const s = input
    .trim()
    .replace(/\s+/g, "")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/^#?/, "");
  if (/^[0-9a-f]{3}$/i.test(s)) return `#${s.split("").map((c) => c + c).join("")}`.toLowerCase();
  if (/^[0-9a-f]{6}$/i.test(s)) return `#${s}`.toLowerCase();
  return null;
}
