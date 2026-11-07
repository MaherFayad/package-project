import { expect, test } from "@playwright/test";
import { cleanup, createUser, sendOtp, track, uniquePhone, verifyNewAccount } from "./fixtures/factory";

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
  await verifyNewAccount(page, code);
  await expect(page).toHaveURL(/\/en\/orders$/);
});

test("a returning buyer signs in with the code only: no name or terms tick, one press (SIM-12, R3-03)", async ({ page }) => {
  const user = track(await createUser({ name: "Returning e2e" }));
  await page.goto("/en/orders");
  await expect(page).toHaveURL(/\/en\/login\?next=/);
  const code = await sendOtp(page, `0${user.phone.slice(3)}`);
  await page.getByLabel("Verification code").fill(code);
  await expect(page.getByLabel(/I agree to the terms/i)).toHaveCount(0);
  // R3-03: the same form for every number (the phone's status is never revealed): terms by continuing, optional offers box unticked.
  await expect(page.getByTestId("otp-terms")).toBeVisible();
  await expect(page.getByLabel(/Send me offers/)).not.toBeChecked();
  await expect(page.getByRole("textbox", { name: /^Name/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await expect(page).toHaveURL(/\/en\/orders$/);
  await cleanup();
});
