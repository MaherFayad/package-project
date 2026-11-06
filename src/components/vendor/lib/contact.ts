/**
 * Managed-marketplace guard (B-08): vendor-controlled public text (bio, portfolio captions, machine
 * and certificate fields) must not carry a way to reach the vendor directly. Detects phone numbers
 * (Western, Arabic-Indic and Persian digits, any separators), emails (also "name at host dot com"),
 * URLs and bare domains, @handles and messaging / social app names in Arabic and English.
 * Pure: used by the zod schemas (client + server) and to strip legacy text before it is shown.
 */

export type ContactKind = "PHONE" | "EMAIL" | "URL" | "HANDLE" | "MESSENGER";

const TLDS = "com|net|org|eg|io|co|info|biz|me|shop|store|online|site|app|link|ly|xyz|page|gl|to|ws|tv|ai";

const PATTERNS: [ContactKind, RegExp][] = [
  ["EMAIL", /[a-z0-9._%+-]+\s*@\s*[a-z0-9-]+(?:\s*\.\s*[a-z0-9-]+)*\s*\.\s*[a-z]{2,}\b/giu],
  // Spelled out: "sales at nilepack dot com", "sales (at) nilepack (dot) com". Needs "dot" so prose
  // like "we print at October. We serve…" never matches.
  ["EMAIL", /[a-z0-9._%+-]+\s*(?:\(\s*at\s*\)|\[\s*at\s*\]|\s+at\s+)\s*[a-z0-9-]+\s*(?:\(\s*dot\s*\)|\[\s*dot\s*\]|\s+dot\s+)\s*[a-z]{2,}\b/giu],
  ["URL", /\b(?:https?:\/\/|www\.)[^\s]+/giu],
  ["URL", new RegExp(`\\b[a-z0-9][a-z0-9-]*(?:\\.[a-z0-9-]+)*\\.(?:${TLDS})(?:\\.[a-z]{2})?(?:\\/[^\\s]*)?(?![a-z0-9])`, "giu")],
  ["HANDLE", /(?:^|[\s(،,:])@[a-z0-9_.]{3,}/giu],
  // 8+ digits joined only by spaces, dashes, dots, slashes-free brackets or a leading +.
  ["PHONE", /\+?\d(?:[\s\-.() ]{0,3}\d){7,}/gu],
  [
    "MESSENGER",
    /(?:whats\s*-?\s*app|wa\.me|telegram|t\.me|instagram|insta\b|facebook|fb\.com|messenger|tik\s*tok|snap\s*chat|linkedin|viber|signal\s+(?:me|us)|واتس\s*اب|واتساب|واتس|وتساب|تليجرام|تلجرام|تيليجرام|انستجرام|انستغرام|إنستجرام|انستا|فيسبوك|فيس\s*بوك|ماسنجر|تيك\s*توك|سناب\s*شات|لينكد\s*إن|لينكدإن|فايبر)/giu,
  ],
];

/** Western digits for Arabic-Indic (٠-٩) and Persian (۰-۹) digits; Arabic comma/decimal kept as text. */
export function normaliseDigits(s: string): string {
  return s.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0));
}

/** Kinds of contact detail found in `text` (empty = clean). */
export function findContactDetails(text: string | null | undefined): ContactKind[] {
  if (!text) return [];
  const s = normaliseDigits(text);
  const found = new Set<ContactKind>();
  for (const [kind, re] of PATTERNS) {
    re.lastIndex = 0;
    if (re.test(s)) found.add(kind);
  }
  return [...found];
}

export const hasContactDetails = (text: string | null | undefined) => findContactDetails(text).length > 0;

/**
 * Remove contact details before public display (defence in depth for text saved before the
 * filter existed). The whole sentence holding a contact detail goes, so no "Call us on ." remains.
 */
export function stripContactDetails(text: string): string {
  if (!hasContactDetails(text)) return text;
  // Digit-normalised copy has the same length (one char per digit), so indexes line up.
  const norm = normaliseDigits(text);
  const spans: [number, number][] = [];
  for (const [, re] of PATTERNS) {
    re.lastIndex = 0;
    for (const m of norm.matchAll(re)) spans.push([m.index!, m.index! + m[0].length]);
  }
  // Sentence ends: . ! ? ؟ or a line break, followed by whitespace or the end.
  const ends: number[] = [];
  for (const m of text.matchAll(/[.!?؟](?=\s|$)|\n/g)) ends.push(m.index!);
  const expanded = spans.map(([a, b]) => {
    const before = ends.filter((e) => e < a);
    const start = before.length ? before[before.length - 1]! + 1 : 0;
    const end = ends.find((e) => e >= b - 1 && e >= a);
    return [start, end === undefined ? text.length : end + 1] as [number, number];
  });
  expanded.sort((x, y) => x[0] - y[0]);
  let out = "";
  let at = 0;
  for (const [a, b] of expanded) {
    if (b <= at) continue;
    out += text.slice(at, Math.max(at, a));
    at = Math.max(at, b);
  }
  out += text.slice(at);
  return out.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
