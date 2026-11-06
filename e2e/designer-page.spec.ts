import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * /[locale]/designer, the 3D designer product page (R6, docs/audit/r6-designer-page.md).
 * Runs in both projects (desktop 1280 and phone 360), Arabic and English: hydration without
 * console errors, no three.js on first paint, links into the editor, the prompt bar's search
 * hand-off to the picker, reduced motion, axe (WCAG 2.2 AA), sitemap entry.
 */

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const LOCALES = ["ar", "en"] as const;
const H1 = { ar: "مصمم العلب ثلاثي الأبعاد من علبة", en: "Elba 3D packaging designer" };
const CTA = { ar: "ابدأ التصميم مجانا", en: "Start designing free" };
const PROMPT = { ar: "ماذا تريد أن تغلف؟", en: "What are you packing?" };

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
      // Nine sections, in order: hero, prompt, styles, two bento groups, trust, materials, start, FAQ.
      for (const id of ["dp-hero-title", "dp-prompt-title", "dp-wall-title", "dp-make-title", "dp-share-title", "dp-trust-title", "dp-mat-title", "dp-start-title", "dp-faq-title"]) {
        await expect(page.locator(`#${id}`)).toHaveCount(1);
      }
      // three.js registers window.__THREE__ when it loads; it must not on first paint.
      expect(await page.evaluate(() => "__THREE__" in window)).toBe(false);
      expect(await page.locator("canvas").count()).toBe(0);
      await scrollThrough(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      // FAQ: 10 native disclosures + FAQPage JSON-LD.
      await expect(page.locator("details")).toHaveCount(10);
      const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
      expect(ld.some((s) => s.includes('"FAQPage"'))).toBe(true);
      expect(errors).toEqual([]);
    });

    test("hero CTA and a box style open the editor", async ({ page }) => {
      await page.goto(`/${locale}/designer`);
      await page.waitForLoadState("networkidle");
      const cta = page.getByRole("link", { name: CTA[locale] }).first();
      await expect(cta).toHaveAttribute("href", `/${locale}/design?structure=FEFCO_0427`);
      // Stop the drifting strip first (its own pause button): a moving card never settles for a click.
      await page.getByRole("button", { name: locale === "ar" ? "إيقاف شريط أنماط العلب" : "Pause the box styles strip" }).click();
      // A style card (the first real one, not the loop copy).
      const card = page.locator(`#dp-styles li:not([aria-hidden]) a[href*="/${locale}/design?structure="]`).first();
      const href = await card.getAttribute("href");
      expect(href).toMatch(new RegExp(`^/${locale}/design\\?structure=[A-Z0-9_]+$`));
      await expect(async () => {
        if (!/\/design\/[a-z0-9-]+/.test(page.url())) await card.click();
        await expect(page).toHaveURL(new RegExp(`/${locale}/design/[a-z0-9-]+`), { timeout: 10_000 });
      }).toPass({ timeout: 45_000 });
    });

    test("prompt bar hands the words to the picker search", async ({ page }) => {
      await page.goto(`/${locale}/designer`);
      await page.waitForLoadState("networkidle");
      const word = locale === "ar" ? "بيتزا" : "pizza";
      const input = page.getByRole("searchbox", { name: PROMPT[locale] });
      await input.fill(word);
      await input.press("Enter");
      await expect(page).toHaveURL(new RegExp(`/${locale}/design\\?q=`), { timeout: 20_000 });
      const search = page.getByRole("searchbox").first();
      await expect(search).toHaveValue(word);
      // The picker lists matching models, each a link into the editor.
      await expect(page.locator(`a[href^="/${locale}/design/"]`).first()).toBeVisible();
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
  await expect(page.getByRole("button", { name: "إيقاف شريط أنماط العلب" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "أنماط العلب", exact: true })).toHaveAttribute("tabindex", "0");
  expect(errors).toEqual([]);
  await context.close();
});

test("pause controls stop the moving strips (WCAG 2.2.2)", async ({ page }) => {
  await page.goto("/en/designer");
  await page.waitForLoadState("networkidle");
  const pause = page.getByRole("button", { name: "Pause the box styles strip" });
  await pause.scrollIntoViewIfNeeded();
  await pause.click();
  await expect(page.getByRole("button", { name: "Play the box styles strip" })).toBeVisible();
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
