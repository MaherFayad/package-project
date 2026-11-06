/**
 * Managed-marketplace guard (B-08): vendor-controlled public text (bio, portfolio captions, machine
 * and certificate fields) must not carry a way to reach the vendor directly. Detects phone numbers
 * (Western, Arabic-Indic and Persian digits, any separators), emails (also "name at host dot com"),
 * URLs and bare domains, @handles and messaging / social app names in Arabic and English.
 * Pure: used by the zod schemas (client + server) and to strip legacy text before it is shown.
 *
 * R4 hardening: the text is first folded to a canonical form so obfuscations match the same
 * patterns: Unicode compatibility forms (full-width and mathematical digits, full-width @),
 * invisible characters and tatweel removed, Cyrillic / Greek look-alike letters mapped to Latin,
 * number words ("zero one…", "صفر واحد…") turned into digits, letters spaced out one by one
 * ("w h a t s a p p") joined, letter O / l used as 0 / 1 inside digit runs, and spelled-out dots
 * ("dot", "(dot)", "دوت", "نقطة") before a domain ending. Phone numbers split by words
 * ("010 then 0123 then 4567") are caught when the digits form an Egyptian number.
 */

export type ContactKind = "PHONE" | "EMAIL" | "URL" | "HANDLE" | "MESSENGER";

// Endings that are rarely an English word glued after a missing space ("boxes.top" would be).
const TLDS = [
  "com", "net", "org", "eg", "io", "co", "info", "biz", "me", "shop", "store", "online", "site", "app", "link", "ly", "xyz",
  "page", "gl", "to", "ws", "tv", "ai", "dev", "pro", "tech", "cc", "uk", "de", "fr", "sa", "ae", "kw", "qa", "om", "bh", "jo",
  "ma", "tn", "mobi", "club", "studio", "agency", "digital", "company", "website", "email", "space", "vip", "cloud",
  "solutions", "services", "global", "eu", "ru", "cn", "tr", "ca", "au", "nl", "ch", "network", "blog", "wtf",
].join("|");

/** Arabic spellings of common domain endings ("نايل باك دوت كوم"). */
const AR_TLDS: [RegExp, string][] = [
  [/كوم/gu, "com"],
  [/نت/gu, "net"],
  [/اورج|أورج/gu, "org"],
];

const PATTERNS: [ContactKind, RegExp][] = [
  ["EMAIL", /[a-z0-9._%+-]+\s*@\s*[a-z0-9-]+(?:\s*\.\s*[a-z0-9-]+)*\s*\.\s*[a-z]{2,}\b/giu],
  // Spelled out: "sales at nilepack dot com", "sales (at) nilepack (dot) com". Needs "dot" so prose
  // like "we print at October. We serve…" never matches. (Folding turns most "dot"s into "." first.)
  ["EMAIL", /[a-z0-9._%+-]+\s*(?:\(\s*at\s*\)|\[\s*at\s*\]|\s+at\s+)\s*[a-z0-9-]+\s*(?:\(\s*dot\s*\)|\[\s*dot\s*\]|\s+dot\s+)\s*[a-z]{2,}\b/giu],
  // "sales at nilepack.com" (the folded form of "sales at nilepack dot com").
  ["EMAIL", new RegExp(`[a-z0-9._%+-]+\\s*(?:\\(\\s*at\\s*\\)|\\[\\s*at\\s*\\]|\\s+at\\s+)\\s*[a-z0-9-]+\\.(?:${TLDS})\\b`, "giu")],
  // Free webmail names next to anything: "nilepack on gmail", "جيميل".
  ["EMAIL", /\b(?:g\s*-?\s*mail|hotmail|yahoo|outlook\.com|icloud|proton\s*mail|live\.com)\b|جيميل|جي\s*ميل|هوتميل|ياهو/giu],
  // "email: nilepack", "ايميل nilepack" (an address with the domain left out).
  ["EMAIL", /(?:\be-?mail\s*[:\-]|ايميل|إيميل|الايميل|الإيميل)\s*[:\-]?\s*[a-z0-9._]{3,}/giu],
  ["URL", /\b(?:h[tx*]{2}ps?:\/\/|www\.)[^\s]*/giu],
  ["URL", new RegExp(`\\b[a-z0-9][a-z0-9-]*(?:\\.[a-z0-9-]+)*\\.(?:${TLDS})(?:\\.[a-z]{2})?(?:\\/[^\\s]*)?(?![a-z0-9])`, "giu")],
  // Map pins lead straight to the plant's phone: "Google Maps", "خرائط جوجل", "جوجل ماب", goo.gl links.
  ["URL", /google\s*maps?|maps\.app|خرائط\s*جوجل|جوجل\s*ماب/giu],
  ["HANDLE", /(?:^|[\s(،,:])@\s*[a-z0-9_.]{3,}/giu],
  // "IG: nilepack", "fb - nilepack", "X @nilepack", "tw: …", "yt: …"
  ["HANDLE", /(?:^|[\s(،,])(?:ig|fb|tw|yt|tt|x)(?:\s*[:@/]\s*|\s+[-–]\s*|\s*[-–]\s+)[a-z0-9_.]{3,}/giu],
  // R5: "ig nilepack", "fb nilepack" (no separator; "ig" / "fb" are not words in either language).
  ["HANDLE", /(?:^|[\s(،,:])(?:ig|fb)\s+[a-z0-9_.]{3,}/giu],
  // 8+ digits joined only by spaces, dashes, dots, underscores, brackets or a leading +. Commas and
  // slashes are left to hasSplitPhone (lists like "100, 500, 1000, 2000" are not phone numbers).
  ["PHONE", /\+?\d(?:[\s\-.()_~*]{0,4}\d){7,}/gu],
  // Short hotlines (16xxx, 19xxx) only next to a call word.
  ["PHONE", /(?:hotline|call|ring|الخط\s*الساخن|خط\s*ساخن|اتصل|كلمنا|رقم)\D{0,12}\b1[569]\d{3}\b/giu],
  [
    "MESSENGER",
    /(?:\bw\s*h?\s*a\s*t+\s*s+\s*-?\s*a?\s*p{1,2}|\bwhats\b|wtsp|wats\s*app|wa\.me|tele\s*g\s*r?a?m|tel[ie]?gr[ae]?m|telgram|t\.me|inst[a@4]\s*g\s*r\s*[a@4]\s*m|insta\b|face\s*-?\s*book|fb\.com|\bf\.\s*b\b|messenger|tik\s*tok|snap\s*chat|linked\s*in|viber|signal\s+(?:me|us)|\bimo\b|botim|skype|we\s*chat|twitter|tweet\s+us|youtube|you\s*tube|واتس\s*[اآ]ب|واتساب|واتس|وتساب|وتس|تليجرام|تلجرام|تيليجرام|تيلجرام|تلغرام|تيليغرام|انستجرام|انستغرام|إنستجرام|إنستغرام|انستقرام|إنستقرام|انستقرم|انستا|إنستا|تلقرام|تليقرام|فيسبوك|فيس\s*بوك|(?<![\u0600-\u06ff])فيس(?![\u0600-\u06ff])|ماسنجر|مسنجر|تيك\s*توك|سناب\s*شات|لينكد\s*إن|لينكدإن|لينكدان|فايبر|سيجنال|سكايب|ايمو|إيمو|بوتيم|تويتر|يوتيوب)/giu,
  ],
];

/** Egyptian phone shapes, used for digit groups split by words ("010 then 0123 then 4567"). */
const EG_PHONE = /^(?:(?:\+?20|0020)1[0125]\d{8}|01[0125]\d{8}|0(?:2|3)\d{7,8}|0(?:4|5|6|8|9)\d{7,8}|(?:\+?20|0020)(?:2|3)\d{8})$/;

/** Western digits for Arabic-Indic (٠-٩) and Persian (۰-۹) digits; Arabic comma/decimal kept as text. */
export function normaliseDigits(s: string): string {
  return s.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0));
}

/** Look-alike letters (Cyrillic, Greek) folded to Latin, so "nilepack.cоm" matches. */
const CONFUSABLES: Record<string, string> = {
  а: "a", е: "e", о: "o", р: "p", с: "c", у: "y", х: "x", і: "i", ј: "j", ѕ: "s", һ: "h", ԁ: "d", ӏ: "l", к: "k", м: "m", т: "t", в: "b", н: "h",
  α: "a", ο: "o", ρ: "p", ε: "e", ι: "i", κ: "k", ν: "v", τ: "t", υ: "u", χ: "x", μ: "m",
};

const EN_NUMBERS: Record<string, string> = { zero: "0", oh: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9" };
const AR_NUMBERS: [RegExp, string][] = [
  [/صفر/gu, "0"],
  [/واحد|وحده|واحده/gu, "1"],
  [/اثنين|اثنان|إثنين|اتنين|إتنين/gu, "2"],
  [/ثلاثة|ثلاثه|تلاتة|تلاته|ثلاث|تلات/gu, "3"],
  [/أربعة|اربعة|أربعه|اربعه|أربع|اربع/gu, "4"],
  [/خمسة|خمسه|خمس/gu, "5"],
  [/ستة|سته|ست/gu, "6"],
  [/سبعة|سبعه|سبع/gu, "7"],
  [/ثمانية|ثمانيه|تمانية|تمانيه|ثماني|تمان/gu, "8"],
  [/تسعة|تسعه|تسع/gu, "9"],
];

/**
 * Canonical form for matching. Keeps one output character per input character where it can, but
 * callers that need positions (stripContactDetails) work sentence by sentence, so lengths may change.
 */
export function canonicalText(text: string): string {
  let s = text.normalize("NFKC");
  // Invisible characters: zero-width, joiners, bidi controls, soft hyphen, word joiner, BOM; tatweel.
  s = s.replace(/[­؜​-‏‪-‮⁠-⁤⁦-⁩﻿ـ]/g, "");
  s = normaliseDigits(s).toLowerCase();
  s = s.replace(/[Ͱ-ϿЀ-ӿ]/g, (c) => CONFUSABLES[c] ?? c);
  // Number words to digits (whole words only), English then Arabic (with an optional "و" prefix).
  s = s.replace(/\b(zero|oh|one|two|three|four|five|six|seven|eight|nine)\b/g, (w) => EN_NUMBERS[w] ?? w);
  for (const [re, d] of AR_NUMBERS) s = s.replace(new RegExp(`(?<![\\u0600-\\u06ff])و?(?:${re.source})(?![\\u0600-\\u06ff])`, "gu"), d);
  // Letters spaced one by one ("w h a t s a p p", "و ا ت س"): join runs of 4+ single letters.
  s = s.replace(/(?<![\p{L}\p{N}])\p{L}(?:[\s.\-_*]{1,2}\p{L}(?![\p{L}\p{N}])){3,}/gu, (run) => run.replace(/[\s.\-_*]/g, ""));
  // Letter O / l / I standing for 0 / 1 inside a run that is mostly digits ("O1OO1234567").
  s = s.replace(/[0-9oil|]{7,}/g, (run) => ((run.match(/\d/g)?.length ?? 0) >= 5 ? run.replace(/o/g, "0").replace(/[il|]/g, "1") : run));
  // R5: bracketed dots "nilepack[.]com", "(.)", "{.}", "<.>".
  s = s.replace(/\s*[[({<]\s*\.\s*[\])}>]\s*/g, ".");
  // Spelled-out dots before a domain ending: "nilepack dot com", "nilepack (dot) com", "nilepack دوت كوم",
  // and a spaced dot "nilepack . com". A sentence end ("boxes. Co-packing") has no space before the dot.
  for (const [re, tld] of AR_TLDS) s = s.replace(new RegExp(`(دوت|نقطة|نقطه)\\s*(?:${re.source})`, "gu"), ` dot ${tld}`);
  s = s.replace(new RegExp(`\\s*(?:\\(\\s*dot\\s*\\)|\\[\\s*dot\\s*\\]|\\{\\s*dot\\s*\\}|\\bdot\\b|\\s\\.)\\s*(?=(?:${TLDS})\\b)`, "gu"), ".");
  return s;
}

/** Digit groups split by short words or punctuation that together form an Egyptian phone number. */
function hasSplitPhone(s: string): boolean {
  const chunks = [...s.matchAll(/\+?\d+/g)].map((m) => ({ d: m[0], start: m.index!, end: m.index! + m[0].length }));
  for (let i = 0; i < chunks.length; i++) {
    let joined = chunks[i]!.d;
    for (let j = i + 1; j < chunks.length && j < i + 6; j++) {
      const gap = s.slice(chunks[j - 1]!.end, chunks[j]!.start);
      // At most three short words between two groups.
      if (gap.length > 32 || gap.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length > 3) break;
      joined += chunks[j]!.d;
      if (EG_PHONE.test(joined.replace(/^\+/, ""))) return true;
    }
  }
  return false;
}

/** Kinds of contact detail found in `text` (empty = clean). */
export function findContactDetails(text: string | null | undefined): ContactKind[] {
  if (!text) return [];
  const s = canonicalText(text);
  const found = new Set<ContactKind>();
  for (const [kind, re] of PATTERNS) {
    re.lastIndex = 0;
    if (re.test(s)) found.add(kind);
  }
  if (!found.has("PHONE") && hasSplitPhone(s)) found.add("PHONE");
  return [...found];
}

export const hasContactDetails = (text: string | null | undefined) => findContactDetails(text).length > 0;

/**
 * Remove contact details before public display (defence in depth for text saved before the
 * filter existed). The whole sentence holding a contact detail goes, so no "Call us on ." remains.
 */
export function stripContactDetails(text: string): string {
  if (!hasContactDetails(text)) return text;
  // Sentence by sentence: ends are . ! ? ؟ followed by whitespace or the end, or a line break.
  const parts = text.split(/(?<=[.!?؟])(?=\s)|(?<=\n)/);
  const kept = parts.filter((p) => !hasContactDetails(p));
  // A detail split across sentences ("010. 0123. 4567") is caught only on the whole text: drop it all.
  if (kept.length === parts.length) return "";
  const out = kept.join("");
  if (hasContactDetails(out)) return "";
  return out.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
