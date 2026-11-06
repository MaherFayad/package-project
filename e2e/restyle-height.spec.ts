import { expect, test, type Page } from "@playwright/test";

/**
 * R6 restyle pages: the document height must not grow after a full scroll and keyboard focus
 * (layout stability; focused controls must not jump, WCAG 2.4.11). Same check as the designer
 * page's height test, here with 60 Tabs and five widths. content-visibility: auto with a fixed
 * contain-intrinsic-size grew /catalog by up to 11,500px before R6 dropped it.
 */
const PAGES = ["/catalog", "/boxes", "/boxes/mailer-box", "/boxes/mailer-box/250x180x80", "/catalog/bakery-box", "/bottles", "/vendors", "/vendors/nile-pack", "/legal/privacy", "/login"] as const;
const WIDTHS = [320, 390, 768, 1024, 1440] as const;

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

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: "elba_cookie_ack", value: "1", url: baseURL! }]);
});

for (const path of PAGES) {
  for (const locale of ["ar", "en"] as const) {
    test(`page height is stable after scroll and 60 Tabs: /${locale}${path}`, async ({ page }, info) => {
      test.skip(info.project.name !== "desktop", "widths are set per step");
      test.setTimeout(180_000);
      for (const w of WIDTHS) {
        await page.setViewportSize({ width: w, height: w < 800 ? 844 : 900 });
        await page.goto(`/${locale}${path}`);
        await page.waitForLoadState("networkidle");
        const before = await page.evaluate(() => document.documentElement.scrollHeight);
        await scrollThrough(page);
        for (let i = 0; i < 60; i++) await page.keyboard.press("Tab");
        const after = await page.evaluate(() => document.documentElement.scrollHeight);
        expect(Math.abs(after - before), `/${locale}${path} at ${w}px: ${before} -> ${after}`).toBeLessThanOrEqual(2);
      }
    });
  }
}
