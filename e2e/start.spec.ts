import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * /[locale]/start, the "start designing free" landing (docs/audit/r6-start.md). Runs on both
 * projects (desktop 1280 and mobile 360) in Arabic and English: every section renders with real
 * content, every CTA on the page opens the designer, the site's "Start designing free" opens this
 * page, reduced motion gives a static page with the same content, hydration is clean, axe is 0.
 */

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const COPY = {
  ar: { h1: "ابدأ اليوم", h2s: ["اختر علبتك", "اجعل علبتك تلمع", "اعرف السعر، وادفع بطريقتك", "علامات تجارية بانتظار علبتها", "ابدأ، ثم توسع", "جاهز لتصميم علبتك؟"], sample: "نموذج", start: "بدء التصميم مجانا", header: "البدء مجانا" },
  en: { h1: "start today", h2s: ["Choose your box", "Make your packaging shine", "See the price, pay your way", "Brands waiting for their box", "Start, then grow", "Ready to design your box?"], sample: "Sample", start: "Start designing free", header: "Start free" },
} as const;

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  return errors;
}

test.beforeEach(async ({ page, baseURL }) => {
  await page.context().addCookies([{ name: "elba_cookie_ack", value: "1", url: baseURL! }]);
});

for (const locale of ["ar", "en"] as const) {
  const c = COPY[locale];

  test(`start ${locale}: sections, CTA targets, clean hydration`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`/${locale}/start`);
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(new RegExp(c.h1.replace(" ", "\\s+"), "i"));
    for (const h of c.h2s) await expect(page.getByRole("heading", { level: 2, name: h })).toBeVisible();

    // Real engine prices in the checkout preview, and the fan says every card is a sample.
    await expect(page.getByRole("table")).toContainText(locale === "ar" ? "500 علبة" : "500 boxes");
    const fan = page.getByRole("list", { name: locale === "ar" ? "تصميمات نموذجية" : "Sample designs" });
    const cards = fan.getByRole("listitem");
    const n = await cards.count();
    expect(n).toBeGreaterThanOrEqual(5);
    for (let i = 0; i < n - 1; i++) await expect(cards.nth(i)).toContainText(c.sample);

    // Every link in the page body is a designer CTA.
    const hrefs = await page.locator("main a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
    expect(hrefs.length).toBeGreaterThanOrEqual(4);
    for (const h of hrefs) expect(h).toMatch(new RegExp(`^/${locale}/design(\\?|$)`));

    // Header CTA (visitor) points here.
    await expect(page.getByRole("banner").getByRole("link", { name: c.header }).first()).toHaveAttribute("href", `/${locale}/start`);

    // Closing phone form: an empty submit goes straight to the designer.
    await page.getByRole("main").getByRole("button", { name: c.start }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/design`), { timeout: 30_000 });
    expect(errors.filter((e) => !/Download the React DevTools/.test(e))).toEqual([]);
  });

  test(`start ${locale}: phone form rejects a bad number without putting it in the URL`, async ({ page }) => {
    await page.goto(`/${locale}/start`);
    const form = page.locator("main form");
    await form.getByRole("textbox").fill("12345");
    await form.getByRole("button").click();
    await expect(form.getByRole("alert")).toBeVisible();
    await form.getByRole("textbox").fill("01012345678");
    await form.getByRole("button").click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/login\\?next=`));
    expect(page.url()).not.toContain("01012345678");
  });

  test(`start ${locale}: axe 0 and no horizontal scroll`, async ({ page }) => {
    await page.goto(`/${locale}/start`);
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 30));
      }
      window.scrollTo(0, 0);
    });
    const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test(`start ${locale}: reduced motion is static with the same content`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/${locale}/start`);
    for (const h of c.h2s) await expect(page.getByRole("heading", { level: 2, name: h })).toBeVisible();
    // The pinned run collapses and the designer card shows at full size, with no scroll-driven transform.
    const card = page.getByRole("img", { name: locale === "ar" ? /^محرر علبة:/ : /^The Elba designer/ });
    await card.scrollIntoViewIfNeeded();
    const t = await card.evaluate((img) => getComputedStyle(img.parentElement!).transform);
    expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(t);
    const pinStyle = await card.evaluate((img) => getComputedStyle(img.parentElement!.parentElement!).position);
    expect(pinStyle).not.toBe("sticky");
  });
}

test("site CTA: the header's start pill opens /start", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("banner").getByRole("link", { name: "Start free" }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/en\/start$/);
});
