import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { SEEDED, db, sendOtp, signInAs, uniquePhone, verifyNewAccount } from "./fixtures/factory";

/**
 * End-to-end journey across every area (seeded DB):
 * home → free designer (anonymous) → instant price (no account, R1-01) → "Order this box" → soft gate (phone + OTP)
 * → checkout → proof approval → mock card payment → order tracking;
 * the assigned vendor accepts the job → production → QC photos;
 * admin approves QC → books the courier → buyer sees the order shipped.
 * Vendor and admin sign in by inserting a session row (same hashing as src/lib/auth).
 */

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

const sessionFor = (context: BrowserContext, baseURL: string, userId: string) => signInAs(context, baseURL, userId);

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

// The journey creates its own buyer (unique phone) and its own order through the app.

test("home → design → gate → price → checkout → pay → vendor → QC → shipped → admin", async ({ page, browser, baseURL }, info) => {
  test.skip(info.project.name !== "desktop", "mutating end-to-end flow runs once (desktop)");
  test.setTimeout(240_000);
  await page.context().addCookies([{ name: "elba_cookie_ack", value: "1", url: baseURL! }]);

  // 1. Home → "Get your box price" opens the /boxes chooser (R1-04); "Order this box" on the mailer opens the editor.
  await page.goto("/en");
  await page.getByRole("main").getByRole("link", { name: "Get your box price" }).first().click();
  await expect(page).toHaveURL(/\/en\/boxes$/, { timeout: 30_000 });
  await page.getByRole("main").getByRole("link", { name: "Order this box: Mailer box" }).click();
  await expect(page).toHaveURL(/\/en\/design\/mailer-box/, { timeout: 30_000 });
  await expect(page.getByRole("application", { name: "3D preview of your box" })).toBeVisible({ timeout: 30_000 });

  // 2. Anonymous design in the Basics panel (the default): one print colour + a name, autosaved.
  // The Basics panel shows one rail section at a time (Logo, Colours, Size, More); phones open it as a sheet.
  const basics = page.getByTestId("simple-panel");
  await page.getByRole("tab", { name: "Colours", exact: true }).click();
  await basics.getByRole("button", { name: "Colour #1f3d2b" }).first().click();
  await page.getByRole("tab", { name: "Logo", exact: true }).click();
  await basics.getByRole("button", { name: "Add a name or text" }).click();
  await expect(page).toHaveURL(/[?&]d=[\w-]+/, { timeout: 20_000 });

  // 3. Price badge → instant price with no account (R1-01) → "Order this box" → soft gate.
  await page.getByTestId("price-badge").click();
  const price = page.getByRole("dialog", { name: "Instant price" });
  await expect(price.getByText("Total with VAT")).toBeVisible({ timeout: 30_000 });
  await price.getByRole("button", { name: "Order this box" }).click();
  const gate = page.getByRole("dialog", { name: "Your mobile number to continue" });
  await expect(gate).toBeVisible();
  const phone = (await uniquePhone("12")).local;
  await verifyNewAccount(gate, await sendOtp(gate, phone));

  // 4. Checkout → address → proof approval → mock card payment.
  await expect(page).toHaveURL(/\/en\/checkout\/[\w-]+$/, { timeout: 30_000 });
  await expect(page.getByTestId("checkout-total")).toBeVisible({ timeout: 30_000 });
  const summary = page.getByRole("complementary").filter({ hasText: "Your order" });
  await summary.getByRole("button", { name: "Continue to address" }).click();
  await page.getByLabel("Full name").fill("Journey Buyer");
  await page.getByLabel("Mobile number").fill("010 1234 5678");
  await page.getByLabel("Governorate").selectOption("Cairo");
  await page.getByLabel("City or district").fill("Nasr City");
  await page.getByLabel("Street address").fill("5 Abbas El Akkad St");
  await expect(page.getByRole("tab", { name: "3D proof" })).toBeVisible({ timeout: 30_000 });
  await page.getByLabel("I checked the design. Print it as it is.").check();
  await summary.getByRole("button", { name: "Continue to payment" }).click();
  await expect(page).toHaveURL(/\/en\/checkout\/pay\//, { timeout: 30_000 });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Card number").fill("4242 4242 4242 4242");
  await page.getByLabel("Expiry (MM/YY)").fill("12/30");
  await page.getByLabel("Security code").fill("123");
  await page.getByRole("button", { name: /^Pay / }).click();

  // 5. Order tracking for the buyer.
  await expect(page).toHaveURL(/\/en\/orders\/[^/?]+\?paid=1/, { timeout: 30_000 });
  const orderUrl = page.url().split("?")[0]!;
  const orderId = orderUrl.split("/").pop()!;
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  expect(order.status).toBe("PAID");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(order.number);

  // 6. The assigned vendor accepts, produces and uploads QC photos.
  const vendorUser = await db.user.findFirstOrThrow({ where: { vendorId: order.vendorId, role: "VENDOR" } });
  const vendorCtx = await browser.newContext({ baseURL });
  await vendorCtx.addCookies([{ name: "elba_cookie_ack", value: "1", url: baseURL! }]);
  await sessionFor(vendorCtx, baseURL!, vendorUser.id);
  const vp = await vendorCtx.newPage();
  await vp.goto(`/en/vendor/jobs/${order.number}`);
  await expect(vp.getByRole("heading", { level: 1, name: order.number })).toBeVisible({ timeout: 30_000 });
  await vp.getByRole("button", { name: "Accept job" }).first().click();
  await vp.getByRole("dialog").getByRole("button", { name: "Accept job" }).click();
  await expect(vp.getByText("Accepted by vendor").first()).toBeVisible({ timeout: 30_000 });
  await vp.getByRole("button", { name: "Start production" }).first().click();
  await expect(vp.getByText("In production").first()).toBeVisible({ timeout: 30_000 });
  const qc = vp.locator("#qc");
  // Scope to the uploaded-photo list: the required-photos checklist in the same card names both kinds
  // too, so an unscoped list-item match passed before the upload finished (race under load).
  const photos = qc.getByRole("list", { name: "Quality check photos" });
  await qc.locator('input[type="file"]').setInputFiles({ name: "sheet.png", mimeType: "image/png", buffer: PNG });
  await expect(photos.getByRole("listitem").filter({ hasText: "First printed sheet" })).toBeVisible({ timeout: 30_000 });
  await qc.getByLabel("Photo type").selectOption("PACKED_BUNDLE");
  await qc.locator('input[type="file"]').setInputFiles({ name: "bundle.png", mimeType: "image/png", buffer: PNG });
  await expect(photos.getByRole("listitem").filter({ hasText: "Packed bundle" })).toBeVisible({ timeout: 30_000 });
  const submitQc = qc.getByRole("button", { name: "Submit for quality check" });
  await expect(submitQc).toBeEnabled({ timeout: 30_000 });
  await submitQc.click();
  await expect(vp.getByText("Quality check in progress")).toBeVisible({ timeout: 30_000 });
  await vendorCtx.close();

  // 7. Admin approves QC and books the courier.
  const admin = await db.user.findUniqueOrThrow({ where: { phone: SEEDED.admin } });
  const adminCtx = await browser.newContext({ baseURL });
  await adminCtx.addCookies([{ name: "elba_cookie_ack", value: "1", url: baseURL! }]);
  await sessionFor(adminCtx, baseURL!, admin.id);
  const ap = await adminCtx.newPage();
  await ap.goto(`/en/admin/orders/${order.number}`);
  await expect(ap.getByRole("heading", { level: 1, name: order.number })).toBeVisible({ timeout: 30_000 });
  await ap.getByRole("button", { name: "Approve for dispatch" }).click();
  await ap.getByRole("dialog").getByRole("button", { name: "Approve for dispatch" }).click();
  await expect(ap.getByRole("button", { name: "Book courier pickup" })).toBeVisible({ timeout: 30_000 });
  await ap.getByRole("button", { name: "Book courier pickup" }).click();
  await ap.getByRole("dialog").getByRole("button", { name: "Book courier pickup" }).click();
  await expect(ap.getByRole("button", { name: "Book courier pickup" })).toHaveCount(0, { timeout: 30_000 });
  await expect.poll(async () => (await db.order.findUniqueOrThrow({ where: { id: orderId } })).status, { timeout: 30_000 }).toMatch(/SHIPPED|DELIVERED/);

  // The admin index lists the order; the audit log has the dispatch.
  await ap.goto(`/en/admin/orders?q=${order.number}`);
  await expect(ap.getByRole("link", { name: order.number })).toBeVisible({ timeout: 30_000 });
  await ap.goto("/en/admin/audit");
  await expect(ap.getByRole("row").filter({ hasText: order.number }).filter({ hasText: "Courier booked" }).first()).toBeVisible({ timeout: 30_000 });
  await adminCtx.close();

  // 8. Buyer sees the shipment with a tracking number.
  await page.goto(orderUrl);
  const progress = page.getByRole("group", { name: "Progress" });
  await expect(progress).toBeVisible();
  const shipment = await db.shipment.findFirstOrThrow({ where: { orderId } });
  await expect(page.getByText(shipment.trackingNumber!).first()).toBeVisible({ timeout: 30_000 });
  await noHorizontalScroll(page);
});
