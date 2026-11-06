import { expect, test, type Page } from "@playwright/test";

/**
 * Spacing system (docs/design-refs/shopify-2026-reference.md, section 7; owner: foundation).
 * For every marketing page at 1440, 1024, 768 and 390 in ar and en, the kit primitives must land
 * on the measured tokens within ±2px:
 *   - Container (data-mk-container="default"): content box min(1260, viewport - 2 × gutter),
 *     gutter max(24px, (100vw - 1260px) / 2) desktop, 32 tablet, 16 phone.
 *   - Sheet bands (data-mk-band): padding by band type (md 64/56/40, lg 100/80/64, xl 128/96/80,
 *     hero top = header height); an overlapping sheet starts at section-y-lg (rule 3); a same-tone
 *     neighbour collapses to 0 top padding (rule 2).
 *   - SectionHead (data-mk-head): title → subtitle 16; head → content 40/32/32 (lg 80/64/48).
 *   - Grid / Bento (data-mk-grid): gap default 24/24/16, tight 16/16/12, bento 32/24/16.
 *   - Rule 4: no heading in <main> overlaps the block after it.
 * A page that does not conform yet is listed in NOT_YET with test.fixme, so its owner flips it on
 * (delete the entry) once the page uses the kit tokens.
 */

const WIDTHS = [1440, 1024, 768, 390] as const;
const PAGES = [
  "",
  "/start",
  "/why-elba",
  "/pricing",
  "/designer",
  "/boxes",
  "/catalog",
  "/vendors",
  // R6 restyle pages (owner: restyle session).
  "/boxes/mailer-box",
  "/boxes/mailer-box/250x180x80",
  "/catalog/bakery-box",
  "/bottles",
  "/vendors/nile-pack",
  "/legal/privacy",
  "/login",
] as const;

/** Pages that do not use the section-7 tokens yet (page owners: delete your entry once it passes). */
const NOT_YET = new Set<string>([
]);

type Bp = "desktop" | "tablet" | "phone";
const bp = (w: number): Bp => (w >= 1024 ? "desktop" : w >= 768 ? "tablet" : "phone");
const T = {
  sectionY: { desktop: 64, tablet: 56, phone: 40 },
  sectionYLg: { desktop: 100, tablet: 80, phone: 64 },
  sectionYXl: { desktop: 128, tablet: 96, phone: 80 },
  headerH: { desktop: 72, tablet: 64, phone: 64 },
  titleSub: { desktop: 16, tablet: 16, phone: 16 },
  headContent: { desktop: 40, tablet: 32, phone: 32 },
  headContentLg: { desktop: 80, tablet: 64, phone: 48 },
  gap: { desktop: 24, tablet: 24, phone: 16 },
  gapTight: { desktop: 16, tablet: 16, phone: 12 },
  gapBento: { desktop: 32, tablet: 24, phone: 16 },
} as const;
const gutter = (w: number) => (bp(w) === "desktop" ? Math.max(24, (w - 1260) / 2) : bp(w) === "tablet" ? 32 : 16);

interface Measured {
  containers: { left: number; width: number }[];
  bands: { label: string; type: string; overlap: boolean; collapsed: boolean; padNone: boolean; top: number; bottom: number }[];
  heads: { label: string; sub: number | null; content: number | null; lg: boolean }[];
  grids: { label: string; type: string; row: number; col: number; single: boolean }[];
  overlaps: string[];
}

async function measure(page: Page): Promise<Measured> {
  return page.evaluate(() => {
    const px = (v: string) => parseFloat(v) || 0;
    const label = (el: Element) => `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}[${(el.textContent ?? "").trim().slice(0, 30)}]`;
    const main = document.querySelector("main")!;
    const containers = Array.from(main.querySelectorAll<HTMLElement>('[data-mk-container="default"]'))
      .filter((el) => !el.parentElement?.closest("[data-mk-container]") && el.offsetParent !== null)
      .map((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return { left: r.left + px(cs.paddingLeft), width: r.width - px(cs.paddingLeft) - px(cs.paddingRight) };
      });
    const bands = Array.from(main.querySelectorAll<HTMLElement>("[data-mk-band]")).map((el) => {
      const cs = getComputedStyle(el);
      const prev = el.previousElementSibling as HTMLElement | null;
      return {
        label: label(el),
        type: el.dataset.mkBand!,
        overlap: el.dataset.overlap === "true",
        collapsed: !!prev && prev.hasAttribute("data-mk-band") && prev.dataset.tone === el.dataset.tone,
        padNone: el.dataset.pad === "none",
        top: px(cs.paddingTop),
        bottom: px(cs.paddingBottom),
      };
    });
    const heads = Array.from(main.querySelectorAll<HTMLElement>("[data-mk-head]")).map((el) => {
      const title = el.querySelector("h1, h2, h3, h4, p:not([data-mk-sub]):not(:first-child), p");
      const heading = el.querySelector("h1, h2, h3, h4") ?? title;
      const sub = el.querySelector("[data-mk-sub]");
      const content = el.parentElement?.querySelector(":scope > [data-mk-head-content]") as HTMLElement | null;
      const hb = el.getBoundingClientRect().bottom;
      return {
        label: label(el),
        sub: sub && heading ? sub.getBoundingClientRect().top - heading.getBoundingClientRect().bottom : null,
        content: content ? content.getBoundingClientRect().top - hb : null,
        lg: content?.dataset.mkHeadContent === "lg",
      };
    });
    const grids = Array.from(main.querySelectorAll<HTMLElement>("[data-mk-grid]")).map((el) => {
      const cs = getComputedStyle(el);
      return { label: label(el), type: el.dataset.mkGrid!, row: px(cs.rowGap), col: px(cs.columnGap), single: el.children.length < 2 };
    });
    const overlaps: string[] = [];
    for (const h of Array.from(main.querySelectorAll<HTMLElement>("h1, h2, h3"))) {
      if (!h.offsetParent) continue;
      let next = h.nextElementSibling as HTMLElement | null;
      while (next && (getComputedStyle(next).position === "absolute" || getComputedStyle(next).position === "fixed" || next.offsetHeight === 0)) next = next.nextElementSibling as HTMLElement | null;
      if (!next) continue;
      const gap = next.getBoundingClientRect().top - h.getBoundingClientRect().bottom;
      if (gap < -1) overlaps.push(`${label(h)} → ${label(next)}: ${Math.round(gap)}px`);
    }
    return { containers, bands, heads, grids, overlaps };
  });
}

const near = (a: number, b: number) => Math.abs(a - b) <= 2;

function problems(m: Measured, w: number): string[] {
  const b = bp(w);
  const out: string[] = [];
  // A page passes only if it is built from the kit: no kit bands or containers = not conformant.
  if (!m.bands.length) out.push("no kit bands (<Sheet>) on the page");
  if (!m.containers.length) out.push("no kit <Container> on the page");
  const content = Math.min(1260, w - 2 * gutter(w));
  for (const c of m.containers) {
    if (!near(c.width, content) || !near(c.left, (w - content) / 2)) out.push(`container: ${Math.round(c.width)}px at x=${Math.round(c.left)}, want ${Math.round(content)}px at x=${Math.round((w - content) / 2)}`);
  }
  for (const band of m.bands) {
    if (band.padNone) continue;
    const y = band.type === "lg" ? T.sectionYLg[b] : band.type === "xl" ? T.sectionYXl[b] : band.type === "hero" ? T.sectionYLg[b] : T.sectionY[b];
    const top = band.type === "hero" ? T.headerH[b] : band.collapsed ? 0 : band.overlap ? (band.type === "xl" ? T.sectionYXl[b] : T.sectionYLg[b]) : y;
    if (!near(band.top, top) || !near(band.bottom, y)) out.push(`band ${band.type} ${band.label}: ${band.top}/${band.bottom}, want ${top}/${y}`);
  }
  for (const h of m.heads) {
    if (h.sub !== null && !near(h.sub, T.titleSub[b])) out.push(`head ${h.label}: title→sub ${Math.round(h.sub)}, want ${T.titleSub[b]}`);
    const want = h.lg ? T.headContentLg[b] : T.headContent[b];
    if (h.content !== null && !near(h.content, want)) out.push(`head ${h.label}: head→content ${Math.round(h.content)}, want ${want}`);
  }
  for (const g of m.grids) {
    const want = g.type === "tight" ? T.gapTight[b] : g.type === "bento" ? T.gapBento[b] : T.gap[b];
    if (!near(g.row, want) || (!g.single && !near(g.col, want))) out.push(`grid ${g.type} ${g.label}: ${g.row}/${g.col}, want ${want}`);
  }
  for (const o of m.overlaps) out.push(`negative gap (rule 4): ${o}`);
  return out;
}

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: "elba_cookie_ack", value: "1", url: baseURL! }]);
});

for (const path of PAGES) {
  for (const locale of ["ar", "en"] as const) {
    test(`spacing system: /${locale}${path}`, async ({ page }, info) => {
      test.skip(info.project.name !== "desktop", "widths are set per step; one project is enough");
      test.fixme(NOT_YET.has(path), `${path || "/"} does not use the section-7 spacing tokens yet`);
      test.setTimeout(120_000);
      await page.setViewportSize({ width: 1440, height: 900 });
      const res = await page.goto(`/${locale}${path}`);
      expect(res?.status(), `/${locale}${path}`).toBe(200);
      await page.waitForLoadState("networkidle");
      const all: string[] = [];
      for (const w of WIDTHS) {
        await page.setViewportSize({ width: w, height: w > 800 ? 900 : 844 });
        await page.waitForTimeout(150);
        for (const p of problems(await measure(page), w)) all.push(`${w}px: ${p}`);
      }
      expect(all).toEqual([]);
    });
  }
}

test("spacing system: the kit gallery conforms (foundation)", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "widths are set per step");
  test.setTimeout(120_000);
  await page.goto("/en/dev/kit");
  await page.waitForLoadState("networkidle");
  const all: string[] = [];
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(150);
    for (const p of problems(await measure(page), w)) all.push(`${w}px: ${p}`);
  }
  expect(all).toEqual([]);
});
