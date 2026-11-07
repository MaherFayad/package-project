import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * /[locale]/designer, the 3D designer product page (R6, docs/audit/r6-designer-page.md).
 * Runs in both projects (desktop 1280 and phone 360), Arabic and English: hydration without
 * console errors, no three.js on first paint, CTAs into the box chooser and box pages (R2-04),
 * reduced motion, axe (WCAG 2.2 AA), sitemap entry.
 */

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const LOCALES = ["ar", "en"] as const;
const H1 = { ar: "معاينة علبتك قبل الطباعة", en: "Preview your box before printing" };
const CTA = { ar: "معرفة سعر علبتك", en: "Get your box price" };

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: "elba_cookie_ack", value: "1", url: baseURL! }]);
});

/** Collect console errors and page errors (React hydration mismatches are console errors). */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

/** Scroll the whole page so every reveal and content-visibility section renders. */
async function scrollThrough(page: Page) {
  await page.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.7);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
}

for (const locale of LOCALES) {
  test.describe(`designer page (${locale})`, () => {
    test("renders, hydrates cleanly and keeps three.js off first paint", async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto(`/${locale}/designer`);
      await page.waitForLoadState("networkidle");
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(H1[locale]);
      // Seven sections, in order: hero, box types, two bento groups, trust, start, FAQ (R2-04).
      for (const id of ["dp-hero-title", "dp-wall-title", "dp-make-title", "dp-share-title", "dp-trust-title", "dp-start-title", "dp-faq-title"]) {
        await expect(page.locator(`#${id}`)).toHaveCount(1);
      }
      // three.js registers window.__THREE__ when it loads; it must not on first paint.
      expect(await page.evaluate(() => "__THREE__" in window)).toBe(false);
      expect(await page.locator("canvas").count()).toBe(0);
      await scrollThrough(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      // FAQ: 9 native disclosures + FAQPage JSON-LD.
      await expect(page.locator("details")).toHaveCount(9);
      const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
      expect(ld.some((s) => s.includes('"FAQPage"'))).toBe(true);
      // Sells printed boxes: no board grades or a localhost share link (R2-04).
      await expect(page.locator("main")).not.toContainText(/SBS|PETG|localhost/);
      expect(errors).toEqual([]);
    });

    test("hero CTA goes to the box chooser and a box type to its price page", async ({ page }) => {
      await page.goto(`/${locale}/designer`);
      await page.waitForLoadState("networkidle");
      const cta = page.getByRole("link", { name: CTA[locale] }).first();
      await expect(cta).toHaveAttribute("href", `/${locale}/boxes`);
      // A box type card (the first real one, not the loop copy) opens its box page with the price.
      const card = page.locator(`#dp-styles li:not([aria-hidden]) a[href^="/${locale}/boxes/"]`).first();
      expect(await card.getAttribute("href")).toMatch(new RegExp(`^/${locale}/boxes/[a-z0-9-]+$`));
    });

    test("axe: no WCAG 2.2 AA violations", async ({ page }) => {
      await page.goto(`/${locale}/designer`);
      await page.waitForLoadState("networkidle");
      await scrollThrough(page);
      // Freeze the drifting strips so axe measures settled colours.
      await page.addStyleTag({ content: "*,*::before,*::after{animation-play-state:paused!important;transition:none!important}" });
      const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
    });
  });
}

test("reduced motion: content visible, loops stopped, no pause buttons for still strips", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ reducedMotion: "reduce", baseURL });
  await context.addCookies([{ name: "elba_cookie_ack", value: "1", url: baseURL! }]);
  const page = await context.newPage();
  const errors = watchErrors(page);
  await page.goto("/ar/designer");
  await page.waitForLoadState("networkidle");
  await scrollThrough(page);
  const state = await page.evaluate(() => {
    const anim = (sel: string) => Array.from(document.querySelectorAll(sel)).map((el) => getComputedStyle(el).animationName);
    const hidden = Array.from(document.querySelectorAll("[data-reveal]")).filter((el) => Number(getComputedStyle(el).opacity) < 0.99).length;
    return { tracks: anim('[class*="marqueeTrack"]'), floats: anim('[class*="float"]'), hidden };
  });
  expect(state.tracks.length).toBeGreaterThan(0);
  expect(state.tracks.every((a) => a === "none")).toBe(true);
  expect(state.floats.every((a) => a === "none")).toBe(true);
  expect(state.hidden).toBe(0);
  // The strips are still, so their pause buttons are gone; the strip stays keyboard-scrollable.
  await expect(page.getByRole("button", { name: "إيقاف شريط أنواع العلب" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "أنواع العلب", exact: true })).toHaveAttribute("tabindex", "0");
  expect(errors).toEqual([]);
  await context.close();
});

test("pause controls stop the moving strips (WCAG 2.2.2)", async ({ page }) => {
  await page.goto("/en/designer");
  await page.waitForLoadState("networkidle");
  const pause = page.getByRole("button", { name: "Pause the box types strip" });
  await pause.scrollIntoViewIfNeeded();
  await pause.click();
  await expect(page.getByRole("button", { name: "Play the box types strip" })).toBeVisible();
  const playState = await page.locator('#dp-styles [class*="marqueeTrack"]').evaluate((el) => getComputedStyle(el).animationPlayState);
  expect(playState).toBe("paused");
});

test("Turn in 3D loads the live box on request", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "software WebGL is slow on the emulated phone; the phone path is the same button");
  await page.goto("/en/designer");
  await page.waitForLoadState("networkidle");
  expect(await page.evaluate(() => "__THREE__" in window)).toBe(false);
  await page.getByRole("button", { name: "Turn in 3D" }).click();
  await expect.poll(() => page.evaluate(() => "__THREE__" in window), { timeout: 30_000 }).toBe(true);
  await expect(page.locator("canvas").first()).toBeAttached({ timeout: 30_000 });
});

test("sitemap lists the designer page in both languages", async ({ request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  expect(xml).toMatch(/\/ar\/designer</);
  expect(xml).toMatch(/\/en\/designer</);
});

test("hero: no floating mockup covers the Turn in 3D / pause controls at phone widths (R6-AX-19, WCAG 2.4.11)", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "widths are set per step");
  for (const locale of LOCALES) {
    await page.goto(`/${locale}/designer`);
    await page.waitForLoadState("networkidle");
    for (const w of [320, 360, 390, 480, 768, 1024, 1440]) {
      await page.setViewportSize({ width: w, height: 800 });
      await page.waitForTimeout(100);
      const hits = await page.evaluate(() => {
        const controls = Array.from(document.querySelectorAll('[class*="boxControls"] button')).map((e) => e.getBoundingClientRect());
        const floats = Array.from(document.querySelectorAll<HTMLElement>('[class*="designer-page_float_"]')).filter((e) => getComputedStyle(e).display !== "none");
        const out: string[] = [];
        for (const c of controls)
          for (const f of floats) {
            const r = f.getBoundingClientRect();
            if (c.left < r.right && c.right > r.left && c.top < r.bottom && c.bottom > r.top) out.push(f.className);
          }
        return out;
      });
      expect(hits, `${locale} ${w}px`).toEqual([]);
    }
  }
});

test("page height is stable: nothing grows after scrolling or keyboard focus (layout stability, WCAG 2.4.11)", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "widths are set per step");
  test.setTimeout(180_000);
  for (const locale of LOCALES) {
    for (const w of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width: w, height: w < 800 ? 844 : 900 });
      await page.goto(`/${locale}/designer`);
      await page.waitForLoadState("networkidle");
      const before = await page.evaluate(() => document.documentElement.scrollHeight);
      await scrollThrough(page);
      for (let i = 0; i < 40; i++) await page.keyboard.press("Tab");
      const after = await page.evaluate(() => document.documentElement.scrollHeight);
      expect(Math.abs(after - before), `${locale} ${w}px: ${before} -> ${after}`).toBeLessThanOrEqual(2);
    }
  }
});
