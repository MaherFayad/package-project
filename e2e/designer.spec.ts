import { expect, test, type Page } from "@playwright/test";

/**
 * Designer main flow (seeded DB): pick a product preset, design anonymously (autosaved to the
 * server under the anonymous cookie), pass the preflight, hit the soft gate from the price
 * badge, sign up with phone + OTP, see the instant price, share a read-only link and export a PNG.
 */

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

/** Desktop shows Export / Share / Save as buttons; phones fold them into the "More actions" menu. */
async function toolbarAction(page: Page, name: string, more = "More actions") {
  const button = page.getByRole("toolbar").getByRole("button", { name, exact: true });
  if (await button.isVisible()) return button.click();
  await page.getByRole("button", { name: more }).click();
  await page.getByRole("menuitem", { name }).click();
}

test("design a box, sign up at the price gate, share and export", async ({ page }) => {
  test.setTimeout(120_000);

  // 1. Picker → product preset.
  await page.goto("/en/design");
  await expect(page.getByRole("heading", { level: 1, name: "Design your box in 3D. Free." })).toBeVisible();
  await noHorizontalScroll(page);
  await page.getByRole("link", { name: /Mailer for a T-shirt/ }).click();
  await expect(page).toHaveURL(/\/en\/design\/mailer-box\?preset=tshirt/);

  // 2. Box panel shows the preset size; the 3D viewer is there and keyboard focusable.
  await expect(page.getByLabel("Length")).toHaveValue("300");
  await expect(page.getByRole("application", { name: "3D preview of your box" })).toBeVisible();
  await noHorizontalScroll(page);

  // 3. Artwork: background colour + text, edited with single-pointer controls (no dragging).
  await page.getByRole("tab", { name: "Artwork" }).click();
  await page.getByRole("button", { name: "Colour #1f3d2b" }).first().click();
  await page.getByRole("button", { name: "Add text" }).click();
  await expect(page.getByRole("group", { name: "Artwork editor for the Front panel" })).toBeVisible();
  await page.getByRole("button", { name: "Move right 1 mm" }).click();
  await page.getByRole("button", { name: "Undo" }).click();
  await page.getByRole("button", { name: "Redo" }).click();

  // 4. Text description of every panel + the print check.
  await page.getByRole("tab", { name: "Layers" }).click();
  await expect(page.getByRole("button", { name: /Text “Elba|Text “Your brand/ })).toBeVisible();
  await page.getByRole("tab", { name: /Check/ }).click();
  await expect(page.getByRole("tabpanel").getByText("Ready to print")).toBeVisible();

  // 5. Anonymous autosave to the server puts the design id in the URL.
  await expect(page).toHaveURL(/[?&]d=[\w-]+/, { timeout: 15_000 });

  // 6. Price badge → soft gate (phone + OTP, marketing consent unchecked) → instant price.
  await page.getByTestId("price-badge").click();
  const gate = page.getByRole("dialog", { name: "Create your free account" });
  await expect(gate).toBeVisible();
  const suffix = String(Date.now() % 100_000_000).padStart(8, "0");
  await gate.getByLabel("Mobile number").fill(`011${suffix}`);
  await gate.getByRole("button", { name: "Send code" }).click();
  const banner = gate.getByTestId("otp-dev-code");
  await expect(banner).toBeVisible({ timeout: 20_000 });
  const code = (await banner.textContent())!.match(/\d{6}/)![0];
  await gate.getByLabel("Verification code").fill(code);
  const marketing = gate.getByRole("checkbox", { name: /offers|marketing|WhatsApp/i });
  if (await marketing.count()) await expect(marketing.first()).not.toBeChecked();
  await gate.getByLabel(/I agree to the Terms/).check();
  await gate.getByRole("button", { name: "Verify and continue" }).click();

  const price = page.getByRole("dialog", { name: "Instant price" });
  await expect(price).toBeVisible({ timeout: 20_000 });
  await expect(price.getByText("Total with VAT")).toBeVisible({ timeout: 20_000 });
  await price.getByRole("button", { name: "Close" }).first().click();
  await expect(page.getByTestId("price-badge")).toHaveText(/500 boxes from .+ each, delivered in \d+ days/, { timeout: 20_000 });

  // 7. Share link → read-only page with "Order this box".
  await toolbarAction(page, "Share");
  const share = page.getByRole("dialog", { name: "Share link" });
  const link = share.getByLabel("Link");
  await expect(link).toHaveValue(/\/en\/s\/[\w-]+$/, { timeout: 20_000 });
  const shareUrl = await link.inputValue();
  await share.getByRole("button", { name: "Close" }).first().click();

  // 8. PNG export (standard size) downloads a file.
  await toolbarAction(page, "Export");
  const exp = page.getByRole("dialog", { name: "Download a mockup" });
  await expect(exp.getByText(/print-ready dieline PDF/)).toBeVisible();
  await exp.getByLabel(/Standard PNG/).check();
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 30_000 }), exp.getByRole("button", { name: "Download" }).click()]);
  expect(download.suggestedFilename()).toMatch(/\.png$/);

  await page.goto(new URL(shareUrl).pathname);
  await expect(page.getByText("Shared box design")).toBeVisible();
  await expect(page.getByRole("link", { name: "Order this box" })).toHaveAttribute("href", /\/en\/checkout\/[\w-]+/);
  await noHorizontalScroll(page);
});

test("Arabic editor is RTL, keeps the 3D view unmirrored and gates saving", async ({ page }) => {
  await page.goto("/ar/design/pizza-box?preset=pizza-30");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("application")).toHaveAttribute("dir", "ltr");
  await expect(page.getByLabel("الطول")).toHaveValue("310");
  await noHorizontalScroll(page);
  await toolbarAction(page, "حفظ", "إجراءات أخرى");
  await expect(page.getByRole("dialog", { name: "إنشاء حسابك المجاني" })).toBeVisible();
});

test("unknown structure is a 404", async ({ page }) => {
  const res = await page.goto("/en/design/no-such-box");
  expect(res?.status()).toBe(404);
});
