import { describe, expect, it } from "vitest";
import { ar } from "@/i18n/ar";
import { homeCopy } from "@/components/marketing/home/copy";
import { startCopy } from "@/components/marketing/start/copy";
import { whyCopy } from "@/components/marketing/why/copy";
import { designerPageCopy } from "@/components/marketing/designer-page/copy";

/**
 * Owner rule: Arabic button and link labels are noun forms («بدء التصميم مجانا», «طلب عرض سعر»,
 * «تسجيل الدخول»), never imperatives («ابدأ», «اطلب», «سجل»). The hero's «ابدأ التصميم مجانا» broke
 * journey J1 on mobile (the e2e looks the CTA up by its noun-form name).
 *
 * Scope: every marketing page's Arabic copy (the shared dictionaries the public site reads and
 * each page's copy.ts). A string counts as a button / link label when its key names one
 * (primary, cta, submit, start, link, button, more, …) or it sits under an object or array that
 * holds labels (cta, ctas, actions, buttons, links). Its first word must not be an imperative.
 */

// Not listed: «تصفح» and «حمل», spelled exactly like their nouns (تصفُّح, حَمْل) without diacritics.
const IMPERATIVES = ["ابدأ", "ابدا", "اطلب", "سجل", "صمم", "اختر", "اكتشف", "تواصل", "احصل", "جرب", "اعرف", "أضف", "اضف", "شاهد", "استكشف", "ارفع", "ادخل", "انضم", "اتصل", "شارك"];
// Attached pronouns: «جربه الآن», «صممها».
const IMPERATIVE = new RegExp(`^(?:[وف])?(?:${IMPERATIVES.join("|")})(?:ه|ها|هم|ني)?$`);

const LABEL_KEY = /^(primary|secondary|tertiary|cta|ctaLabel|submit|start|startFree|newDesign|login|signIn|signup|button|btn|link|more|action|open|try|browse|apply|join|order|quote|viewAll|seeAll|learnMore|getStarted)$|(Cta|Link|Button|Btn|Action|Submit|Primary|Secondary|Start)$/;
const LABEL_PARENT = /^(cta|ctas|actions|buttons|links|pills)$/i;
/** Prose under a label group (cta.body, cta.title) is not a label. */
const TEXT_KEY = /^(body|title|lead|text|note|hint|fine|alt|desc|description|meta|caption|eyebrow|sub)$/i;

type Hit = { source: string; key: string; value: string };

function labels(source: string, tree: unknown, path: string[] = [], out: Hit[] = []): Hit[] {
  if (typeof tree === "string") {
    const last = path[path.length - 1] ?? "";
    const parent = path.slice(0, -1).some((p) => LABEL_PARENT.test(p));
    if (LABEL_KEY.test(last) || (parent && !TEXT_KEY.test(last))) out.push({ source, key: path.join("."), value: tree });
    return out;
  }
  if (Array.isArray(tree)) tree.forEach((v, i) => labels(source, v, [...path, String(i)], out));
  else if (tree && typeof tree === "object") for (const [k, v] of Object.entries(tree)) labels(source, v, [...path, k], out);
  return out;
}

const firstWord = (s: string) => s.trim().split(/\s+/)[0]?.replace(/[«»"'.,:،؛!؟]/g, "") ?? "";

const SOURCES: [string, unknown][] = [
  ["dict.mk", ar.mk],
  ["dict.marketing", ar.marketing],
  ["dict.store", ar.store],
  ["dict.nav", ar.nav],
  ["home/copy.ts", homeCopy("ar")],
  ["start/copy.ts", startCopy("ar")],
  ["why/copy.ts", whyCopy("ar")],
  ["designer-page/copy.ts", designerPageCopy("ar")],
];

/**
 * Imperative labels in copy the foundation does not own, left for their page owners (they delete
 * the entry when they fix the string; the test fails if an entry no longer matches, so the list
 * cannot go stale). Key: `${source}:${key}`.
 */
const PENDING = new Set<string>([
]);

const all = SOURCES.flatMap(([source, tree]) => labels(source, tree));
const offenders = all.filter((h) => IMPERATIVE.test(firstWord(h.value)));

describe("Arabic button and link labels are noun forms", () => {
  it("finds labels to check in every source", () => {
    for (const [source] of SOURCES) expect(all.filter((h) => h.source === source).length, source).toBeGreaterThan(0);
  });

  it("detects the imperative forms (self-test)", () => {
    for (const s of ["ابدأ التصميم مجانا", "اطلب عرض سعر", "سجل الآن", "جربه الآن", "واكتشف المزيد", "تواصل معنا"]) expect(IMPERATIVE.test(firstWord(s)), s).toBe(true);
    for (const s of ["بدء التصميم مجانا", "طلب عرض سعر", "تسجيل الدخول", "التواصل معنا", "تجربة المصمم", "اختيار العلبة"]) expect(IMPERATIVE.test(firstWord(s)), s).toBe(false);
  });

  it("no button or link label starts with an imperative", () => {
    const bad = offenders.filter((h) => !PENDING.has(`${h.source}:${h.key}`)).map((h) => `${h.source}:${h.key}: ${h.value}`);
    expect(bad).toEqual([]);
  });

  it("every PENDING entry is still a real offender (remove it once fixed)", () => {
    const live = new Set(offenders.map((h) => `${h.source}:${h.key}`));
    expect([...PENDING].filter((k) => !live.has(k))).toEqual([]);
  });
});
