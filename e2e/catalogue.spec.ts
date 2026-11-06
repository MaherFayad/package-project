import fs from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Public catalogue (/[locale]/catalog) and model pages: Egypt filter on by default, Worldwide
 * adds rare formats, search by Arabic / English name and FEFCO / ECMA code, family and
 * sub-family chips, keyboard walk through the windowed grid, the commerce path on the model
 * page (designer + instant price, or request a quote), RTL, no horizontal scroll, axe (WCAG 2.2 AA).
 */

const SHOTS = path.resolve("docs/screenshots/audit/catalogue");
fs.mkdirSync(SHOTS, { recursive: true });

async function dismissCookies(page: Page) {
  const ok = page.getByRole("button", { name: /^(OK|موافق)$/ });
  if (await ok.count()) await ok.first().click();
}

async function count(page: Page) {
  const text = (await page.getByTestId("catalogue-count").innerText()).replace(/[^\d٠-٩]/g, "");
  return Number(text.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))));
}

test("catalogue: Egypt by default, Worldwide, search by code and name, families", async ({ page }, info) => {
  await page.goto("/en/catalog");
  await dismissCookies(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Every packaging type");
  await expect(page.getByTestId("scope-egypt")).toHaveAttribute("aria-pressed", "true");
  const egypt = await count(page);
  await page.getByTestId("scope-world").click();
  await expect.poll(() => count(page)).toBeGreaterThan(egypt);
  expect(await count(page)).toBeGreaterThanOrEqual(400);

  await page.getByTestId("catalogue-search").fill("FEFCO 0427");
  await expect(page.locator('[data-model="FEFCO_0427"]')).toBeVisible();
  await page.getByTestId("catalogue-search").fill("A60.20");
  await expect(page.locator('[data-model="ECMA_TUCK_CRASH_LOCK"]')).toBeVisible();
  await page.getByTestId("catalogue-search").fill("كوب");
  await expect(page.locator('[data-model="FS_CUP_DOUBLE"]')).toBeVisible();
  await page.getByTestId("catalogue-search").fill("");

  await page.locator('[data-family="food-service"]').click();
  await expect(page.locator('[data-model="FS_PULP_EGG_6"]')).toBeVisible();
  await expect(page.locator('[data-model="FEFCO_0201"]')).toHaveCount(0);
  await page.getByRole("button", { name: /Molded pulp/ }).click();
  await expect.poll(() => count(page)).toBe(6);
  expect(page.url()).toContain("family=food-service");

  // every thumbnail on screen is a real render (decoded, not broken)
  const broken = await page.locator('[data-testid="catalogue-grid"] img').evaluateAll((imgs) => (imgs as HTMLImageElement[]).filter((i) => i.complete && i.naturalWidth === 0).length);
  expect(broken).toBe(0);
  if (info.project.name === "desktop") await page.screenshot({ path: path.join(SHOTS, "after-en-1440-filtered.png") });
});

test("catalogue: windowed grid renders a window, keyboard reaches every model", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "keyboard walk on desktop");
  await page.goto("/en/catalog?scope=world");
  await dismissCookies(page);
  const total = await count(page);
  const rendered = await page.locator('[data-testid="catalogue-grid"] > li').count();
  expect(rendered).toBeLessThan(total);
  const first = page.locator('[data-testid="catalogue-grid"] > li a').first();
  await first.focus();
  for (let i = 0; i < 60; i++) await page.keyboard.press("Tab");
  const pos = await page.evaluate(() => document.activeElement?.closest("li")?.getAttribute("aria-posinset"));
  expect(Number(pos)).toBe(61);
});

test("catalogue: Arabic RTL, no horizontal scroll, axe clean", async ({ page }, info) => {
  await page.goto("/ar/catalog");
  await dismissCookies(page);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("كل أنواع العبوات");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).include("main").analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  await page.screenshot({ path: path.join(SHOTS, `after-ar-${info.project.name}.png`) });
});

test("model page: designer + instant price for a printed box", async ({ page }) => {
  await page.goto("/en/catalog/FEFCO_0427");
  await dismissCookies(page);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByTestId("price-path")).toHaveAttribute("data-mode", "instant");
  await expect(page.getByRole("link", { name: "Design it free" })).toHaveAttribute("href", /\/en\/design\//);
  await expect(page.getByTestId("catalogue-stage")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
});

test("model page: quote path for a format no printer prices yet", async ({ page }, info) => {
  await page.goto("/ar/catalog/FS_CUP_DOUBLE");
  await dismissCookies(page);
  await expect(page.getByTestId("price-path")).toHaveAttribute("data-mode", "quote");
  await expect(page.getByText("تصميم مجاني وتسعير بعرض سعر")).toBeVisible();
  await expect(page.getByRole("link", { name: "سجل الدخول لطلب عرض سعر" })).toHaveAttribute("href", /login\?next=/);
  await expect(page.getByTestId("catalogue-stage")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).include("main").analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  if (info.project.name === "desktop") await page.screenshot({ path: path.join(SHOTS, "after-ar-1440-quote.png") });
});

test("quote request: signed-in buyer sends a request", async ({ page, request }, info) => {
  test.skip(info.project.name !== "desktop", "once");
  const phone = "+201000000002";
  const otp = await request.post("/api/auth/request-otp", { data: { phone } });
  const { devCode } = await otp.json();
  const v = await request.post("/api/auth/verify-otp", { data: { phone, code: devCode, locale: "en", acceptTerms: true } });
  expect(v.ok()).toBe(true);
  const cookies = (await request.storageState()).cookies;
  await page.context().addCookies(cookies);
  await page.goto("/en/catalog/FS_PULP_EGG_6");
  await dismissCookies(page);
  await page.getByLabel("Quantity").fill("50");
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText("Enter a quantity from 100")).toBeVisible();
  await page.getByLabel("Quantity").fill("5000");
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Request sent" })).toBeVisible();
});
