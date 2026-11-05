import { expect, test } from "@playwright/test";

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
  // Unique phone per run/project to avoid OTP rate limits.
  const suffix = String(Date.now() % 100_000_000).padStart(8, "0");
  await page.goto("/en/orders");
  await expect(page).toHaveURL(/\/en\/login\?next=/);
  await page.getByLabel("Mobile number").fill(`012${suffix}`);
  await page.getByRole("button", { name: "Send code" }).click();
  const banner = page.getByTestId("otp-dev-code");
  await expect(banner).toBeVisible();
  const code = (await banner.textContent())!.match(/\d{6}/)![0];
  await page.getByLabel("Verification code").fill(code);
  await page.getByLabel(/I agree to the Terms/).check();
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await expect(page).toHaveURL(/\/en\/orders$/);
});
