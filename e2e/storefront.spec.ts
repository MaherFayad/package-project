import { expect, test, type Page } from "@playwright/test";

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

  await page.getByRole("link", { name: /Shoe box/ }).click();
  await expect(page).toHaveURL(/\/en\/boxes\/mailer-box\/330x200x120$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Custom printed mailer box 33×20×12 cm");
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
  await expect(page.getByTestId("vendor-card")).toHaveCount(6);
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
  await expect(page.locator("footer").getByRole("link", { name: "Returns for custom goods" })).toBeVisible();
});

test("account: sign in, withdraw marketing consent, request data deletion", async ({ page }) => {
  const suffix = String(Date.now() % 100_000_000).padStart(8, "0");
  await page.goto("/en/account");
  await expect(page).toHaveURL(/\/en\/login\?next=/, { timeout: 20_000 });
  await page.waitForLoadState("networkidle"); // let the form hydrate before typing
  await page.getByLabel("Mobile number").fill(`011${suffix}`);
  await page.getByRole("button", { name: "Send code" }).click();
  const banner = page.getByTestId("otp-dev-code");
  await expect(banner).toBeVisible();
  const code = (await banner.textContent())!.match(/\d{6}/)![0];
  await page.getByLabel("Verification code").fill(code);
  await page.getByLabel(/I agree to the Terms/).check();
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
