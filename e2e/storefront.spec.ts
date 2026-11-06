import { expect, test, type Page } from "@playwright/test";
import { sendOtp, uniquePhone } from "./fixtures/factory";

/** Storefront main flows on seeded data (owner: storefront). */

test.beforeEach(async ({ context, baseURL }) => {
  // Acknowledge the cookie notice so it never covers controls in the tests.
  await context.addCookies([{ name: "elba_cookie_ack", value: "1", url: baseURL! }]);
});

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test("home → catalogue → structure → SEO size page with price table and JSON-LD", async ({ page }) => {
  await page.goto("/en");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("See them in 3D");
  await expect(page.getByRole("button", { name: /Pause rotation|Rotate the box/ })).toBeVisible();
  await noHorizontalScroll(page);

  await page.getByRole("link", { name: "Browse box styles" }).click();
  await expect(page).toHaveURL(/\/en\/catalog$/, { timeout: 20_000 });
  // Worldwide catalogue (e2e/catalogue.spec.ts): find the mailer by code, open its model page.
  await page.getByTestId("catalogue-search").fill("FEFCO 0427");
  await page.locator('[data-model="FEFCO_0427"]').click();
  await page.getByRole("link", { name: "Sizes and prices: Mailer box" }).click();
  await expect(page).toHaveURL(/\/en\/boxes\/mailer-box$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Mailer box" })).toBeVisible();
  await expect(page.getByRole("table")).toContainText("2,000");

  // A click that lands while the page is still hydrating can be lost: retry it.
  await page.waitForLoadState("networkidle");
  await expect(async () => {
    if (!/330x200x120$/.test(page.url())) await page.getByRole("link", { name: /Shoe box/ }).first().click();
    await expect(page).toHaveURL(/\/en\/boxes\/mailer-box\/330x200x120$/, { timeout: 5_000 });
  }).toPass({ timeout: 30_000 });
  // CR-62: the visible H1 uses millimetres like the body (bidi isolates around the numbers);
  // the <title> keeps the "33×20×12 cm" search form.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^Custom printed mailer box \u2066?330 × 200 × 120\u2069? mm$/);
  await expect(page).toHaveTitle(/Custom printed mailer box 33×20×12 cm/);
  const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
  expect(JSON.parse(ld!)[0]).toMatchObject({ "@type": "Product", offers: { priceCurrency: "EGP" } });
  const cta = page.getByRole("link", { name: "Design it free" }).first();
  await expect(cta).toHaveAttribute("href", /\/en\/design\?structure=FEFCO_0427&L=330&W=200&H=120/);
  await noHorizontalScroll(page);
});

test("Arabic SEO title and RTL", async ({ page }) => {
  await page.goto("/ar/boxes/pizza-box/310x310x40");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page).toHaveTitle(/علبة بيتزا مطبوعة 31×31×4 سم/);
});

test("vendor directory filters and vendor profile lightbox", async ({ page }) => {
  await page.goto("/en/vendors");
  await page.waitForLoadState("networkidle");
  // Every seeded active vendor is listed. Not an exact total: the printer-onboarding journey
  // (e2e/journeys/j3) approves its own vendor while this runs in parallel (--workers=2).
  for (const name of ["Nile Pack Printing & Packaging", "Delta Cartons", "Obour Box Works", "Alex Print House", "Damietta Modern Packaging", "Cairo Label & Flex"]) {
    await expect(page.getByTestId("vendor-card").filter({ hasText: name })).toHaveCount(1);
  }
  await page.getByLabel("City").selectOption("ALEXANDRIA");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/city=ALEXANDRIA/, { timeout: 20_000 });
  await expect(page.getByTestId("vendor-card")).toHaveCount(1);
  await expect(page.getByTestId("vendor-card")).toContainText("Alex Print House");

  // The filter form is a plain GET (full page load); a click that lands while React is still
  // hydrating can be swallowed, so retry until the profile route is reached.
  await expect(async () => {
    if (!/\/vendors\/alex-print-house/.test(page.url())) await page.getByRole("link", { name: "View profile: Alex Print House" }).click();
    await expect(page).toHaveURL(/\/en\/vendors\/alex-print-house/, { timeout: 3000 });
  }).toPass({ timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Alex Print House" })).toBeVisible();
  await expect(page.getByText("Food-contact safe")).toBeVisible();
  await page.waitForLoadState("networkidle"); // gallery is a client island
  // No direct contact details on a managed marketplace.
  await expect(page.locator('a[href^="tel:"], a[href^="mailto:"], a[href*="wa.me"]')).toHaveCount(0);

  await page.getByRole("button", { name: /Open image 1 of 3/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Image 1 of 3");
  await dialog.getByRole("button", { name: "Next image" }).click();
  await expect(dialog).toContainText("Image 2 of 3");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await expect(page.getByRole("link", { name: "Design a box with this printer" })).toHaveAttribute("href", /vendor=alex-print-house/);
  await noHorizontalScroll(page);
});

test("legal pages are marked for lawyer review", async ({ page }) => {
  for (const doc of ["privacy", "terms", "returns", "cookies"]) {
    await page.goto(`/en/legal/${doc}`);
    await expect(page.getByText(/Draft for lawyer review/)).toBeVisible();
  }
  // R6 footer lists it twice (link column and the legal row); either copy must be a visible link.
  await expect(page.locator("footer").getByRole("link", { name: "Returns for custom goods" }).first()).toBeVisible();
});

test("account: sign in, withdraw marketing consent, request data deletion", async ({ page }) => {
  const phone = (await uniquePhone("11")).local;
  await page.goto("/en/account");
  await expect(page).toHaveURL(/\/en\/login\?next=/, { timeout: 20_000 });
  await page.waitForLoadState("networkidle"); // let the form hydrate before typing
  const code = await sendOtp(page, phone);
  await page.getByLabel("Verification code").fill(code);
  await page.getByLabel(/I agree to the terms/i).check();
  await page.getByLabel(/Send me offers/).check();
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await expect(page).toHaveURL(/\/en\/account$/, { timeout: 30_000 });
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("heading", { name: "No saved designs yet" })).toBeVisible();
  await expect(page.getByText("Subscribed", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Withdraw consent" }).click();
  await expect(page.getByText("Not subscribed", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Request deletion" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Request deletion" }).click();
  await expect(page.getByText(/Deletion requested on/)).toBeVisible();

  const res = await page.request.get("/en/account/export");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.format).toBe("elba-personal-data-export");
  expect(body.consents.some((c: { kind: string; granted: boolean }) => c.kind === "MARKETING" && !c.granted)).toBe(true);
  await noHorizontalScroll(page);
});

test("sitemap and robots", async ({ request }) => {
  const sm = await (await request.get("/sitemap.xml")).text();
  expect(sm).toContain("/ar/boxes/mailer-box/250x180x80");
  expect(sm).toContain("/en/vendors/nile-pack");
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Sitemap:");
  expect(robots).toContain("Disallow: /*/account");
});

/** React hydration failures (#418 text/HTML mismatch, #419, #423 recoverable root error, #425 text) and their dev wording. */
const HYDRATION = /Minified React error #(418|419|423|425)|Hydration failed|hydrat(ed|ion) .*(mismatch|didn't match)|server rendered (HTML|text) didn't match/i;

test("marketing pages hydrate without errors on a slow phone (R4-MK-09, ar + en)", async ({ page, browserName }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`${page.url()}: ${String(e)}`));
  page.on("console", (m) => {
    if (m.type() === "error" && HYDRATION.test(m.text())) errors.push(`${page.url()}: ${m.text()}`);
  });
  // The race showed on 2 to 4 of 12 loads at 4x CPU before the <main> Suspense boundary; a slow
  // CPU and network make hydration start while segment payloads are still pending.
  if (browserName === "chromium") {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    // Slow 4G as in perf-pages.mjs: hydration then starts while segment chunks are still loading.
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true }); // every load is a first visit
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 562.5, downloadThroughput: (1.47 * 1024 * 1024) / 8, uploadThroughput: (0.68 * 1024 * 1024) / 8 });
  }
  const paths = ["", "/boxes", "/bottles", "/vendors", "/vendors/obour-box-works", "/boxes/mailer-box", "/boxes/mailer-box/250x180x80", "/legal/privacy"];
  for (const locale of ["ar", "en"]) {
    for (const p of paths) {
      await page.goto(`/${locale}${p}`);
      await expect(page.locator("main#main h1").first()).toBeVisible();
      // Hydrated: RevealScope's effect runs only after the shell has hydrated and committed.
      await page.waitForFunction(() => document.documentElement.dataset.motion === "on" || matchMedia("(prefers-reduced-motion: reduce)").matches, null, { timeout: 30_000 });
      await page.waitForTimeout(300); // late boundaries
    }
  }
  expect(errors, errors.join("\n")).toEqual([]);
});

test("unknown marketing URLs answer a real 404 with the marketing chrome (R4-MK-09)", async ({ page }) => {
  for (const url of ["/en/vendors/no-such-printer", "/ar/boxes/no-such-box", "/en/boxes/mailer-box/1x1x1", "/ar/legal/no-such-doc", "/en/no/such/page"]) {
    const res = await page.goto(url);
    expect(res?.status(), url).toBe(404);
    await expect(page.locator("header").first()).toBeVisible();
    await expect(page.locator("#not-found-title")).toBeVisible();
    await expect(page).toHaveTitle(/Page not found|الصفحة غير موجودة/);
  }
});
