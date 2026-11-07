import { expect, test } from "@playwright/test";
import { sendOtp, uniquePhone } from "./fixtures/factory";

test("root redirects to Arabic RTL", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/ar$/);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
});

test("no horizontal scroll on home", async ({ page }) => {
  await page.goto("/ar");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("phone + OTP sign-in (dev banner) reaches protected orders page", async ({ page }) => {
  // Unique per test and worker (OTP limits are per phone): e2e/fixtures/factory.ts.
  const phone = (await uniquePhone("12")).local;
  await page.goto("/en/orders");
  await expect(page).toHaveURL(/\/en\/login\?next=/);
  const code = await sendOtp(page, phone);
  await page.getByLabel("Verification code").fill(code);
  await page.getByLabel(/I agree to the terms/i).check();
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await expect(page).toHaveURL(/\/en\/orders$/);
});
