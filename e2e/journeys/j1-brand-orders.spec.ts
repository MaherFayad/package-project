import { expect, test } from "@playwright/test";
import { SEEDED, cleanup, db, signInAs, track, uniquePhone } from "../fixtures/factory";
import { formatMoney } from "../../src/lib/format";
import { ONE_PX_PNG, ackCookies, ageShipments, localeOf, logoPng, noSideScroll, rx, sendOtpIn, tFor, tr, vatOf } from "./helpers";

/**
 * Journey 1 (docs/audit/journeys.md): a new Cairo coffee brand lands on the home page, designs a
 * mailer on the 3D model (logo, text, colour, gold foil, white board), shares it, signs up with an
 * OTP, checks out with a company name and tax number, approves the proof, pays by mock card, the
 * printer makes it, ops pass QC and book the courier, the box is delivered and the buyer opens the
 * receipt. English on desktop, Arabic on the phone project. At every money surface the totals must
 * be the order's own numbers (VAT 14% of the ex-VAT subtotal), and the printer must see GOLD foil.
 */

test.afterAll(cleanup);

test("J1 · coffee brand: design → share → OTP → company checkout → pay → print → deliver → receipt", async ({ page, browser, baseURL }, info) => {
  test.setTimeout(300_000);
  const locale = localeOf(info);
  const t = tFor(locale);
  await ackCookies(page.context(), baseURL!);

  // 1. Home → "Start designing free" opens the mailer box in the 3D designer.
  await page.goto(`/${locale}`);
  await page.getByRole("link", { name: tr(locale, "Start designing free") }).first().click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/design`), { timeout: 30_000 });
  const stage = page.getByRole("application", { name: tr(locale, "3D preview of your box") });
  await expect(stage).toBeVisible({ timeout: 30_000 });
  await noSideScroll(page);

  // 2. Design: name, background colour, logo upload, text, gold foil on white board.
  // The phone toolbar has no name field (R5-JR-15, designer): name it on wider screens only.
  const nameField = page.getByLabel(tr(locale, "Design name"));
  const named = await nameField.isVisible();
  if (named) await nameField.fill("Bunn Coffee");
  const panel = page.getByRole("complementary", { name: tr(locale, "Designer panels") });
  await panel.getByRole("tab", { name: tr(locale, "Artwork") }).click();
  await panel.getByRole("button", { name: /#1f3d2b/ }).first().click();
  const chooser = page.waitForEvent("filechooser");
  await panel.getByRole("button", { name: tr(locale, "Add image") }).click();
  await (await chooser).setFiles({ name: "bunn-logo.png", mimeType: "image/png", buffer: await logoPng(page) });
  await expect(panel.getByRole("region", { name: /Selected item|العنصر المحدد/ })).toBeVisible({ timeout: 30_000 });
  await panel.getByRole("button", { name: tr(locale, "Add text") }).click();
  await panel.getByRole("textbox", { name: t("designer.layer.textValue"), exact: true }).fill("Bunn Coffee · Zamalek");
  await panel.getByRole("tab", { name: t("designer.tabs.box") }).click();
  await panel.getByRole("radio", { name: t("materials.E_FLUTE_WHITE") }).check();
  await panel.getByRole("checkbox", { name: rx(locale === "ar" ? "بصمة ذهبي" : "Gold foil") }).check();
  // Anonymous autosave puts the design id in the URL.
  await expect(page).toHaveURL(/[?&]d=[\w-]+/, { timeout: 30_000 });

  // 3. Share → the account gate (OTP) → the share link.
  // Phones fold Export / Share / Save into "More actions".
  const more = page.getByRole("button", { name: tr(locale, "More actions") });
  if (await more.isVisible()) {
    await more.click();
    await page.getByRole("menuitem", { name: t("designer.share.button") }).click();
  } else await page.getByRole("button", { name: t("designer.share.button") }).first().click();
  const gate = page.getByRole("dialog", { name: tr(locale, "Create your free account") });
  await expect(gate).toBeVisible();
  const phone = await uniquePhone("12");
  await gate.getByLabel(tr(locale, "Verification code")).fill(await sendOtpIn(gate, phone.local, locale));
  await gate.getByLabel(t("auth.acceptTerms")).check();
  await gate.getByRole("button", { name: tr(locale, "Verify and continue") }).click();
  const share = page.getByRole("dialog", { name: t("designer.share.heading") });
  const link = share.getByRole("textbox").first();
  await expect(link).toHaveValue(/\/s\/[\w-]+$/, { timeout: 30_000 });
  const shareUrl = await link.inputValue();
  const buyer = track(await db.user.findUniqueOrThrow({ where: { phone: phone.e164 } }));
  await page.keyboard.press("Escape");

  // The share page names the finish the buyer chose (R5-JR-02), not a generic "Hot foil".
  const viewer = await browser.newPage();
  await viewer.goto(shareUrl);
  if (named) await expect(viewer.getByRole("heading", { level: 1 })).toContainText("Bunn Coffee");
  await expect(viewer.getByText(locale === "ar" ? "بصمة ذهبي" : "Gold foil").first()).toBeVisible();
  await viewer.close();

  // 4. Instant price → "Order this box" → checkout.
  await page.getByTestId("price-badge").click();
  const price = page.getByRole("dialog", { name: t("designer.price.heading") });
  await expect(price.getByText(t("designer.price.total"))).toBeVisible({ timeout: 30_000 });
  await price.getByRole("button", { name: t("designer.order.button") }).click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/checkout/[\\w-]+$`), { timeout: 30_000 });
  await expect(page.getByTestId("vendor-offer").first()).toBeVisible({ timeout: 30_000 });
  const summary = page.getByRole("complementary").filter({ hasText: t("checkout.summary.title") });
  await summary.getByRole("button", { name: t("checkout.actions.continue") }).click();

  // 5. Delivery + company invoice (name and 9-digit tax number), proof approval.
  await page.getByLabel(t("checkout.address.name")).fill("Omar Bunn");
  await page.getByLabel(t("checkout.address.phone")).fill(phone.local);
  await page.getByLabel(t("checkout.address.governorate")).selectOption("Cairo");
  await page.getByLabel(t("checkout.address.city")).fill("Zamalek");
  await page.getByLabel(t("checkout.address.street")).fill("12 Brazil St");
  await page.getByLabel(t("buyer.company.toggle")).check();
  await page.getByLabel(t("buyer.company.name")).fill("Bunn Coffee LLC");
  await page.getByLabel(t("buyer.company.taxId")).fill("123456789");
  await summary.getByRole("button", { name: t("checkout.actions.continue") }).click();
  await expect(page.getByRole("tab", { name: t("checkout.proof.tab3d") })).toBeVisible({ timeout: 30_000 });
  await page.getByLabel(t("checkout.proof.approve")).check();
  await summary.getByRole("button", { name: t("checkout.actions.approveAndPay") }).click();

  // 6. Payment page: the amount due is the order's total; VAT is 14% of the ex-VAT subtotal.
  await expect(page).toHaveURL(new RegExp(`/${locale}/checkout/pay/`), { timeout: 30_000 });
  const orderId = page.url().split("/").pop()!;
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  expect(order.vatPiasters).toBe(vatOf(order.subtotalPiasters));
  expect(order.totalPiasters).toBe(order.subtotalPiasters + order.vatPiasters);
  const total = formatMoney(order.totalPiasters, locale);
  await expect(page.getByRole("main")).toContainText(total);
  expect(order.items[0]!.config).toMatchObject({ finishes: [expect.objectContaining({ code: "FOIL_GOLD" })] });
  await page.getByRole("button", { name: t("checkout.actions.continue") }).click();
  await page.getByLabel(t("payment.card.number")).fill("4242 4242 4242 4242");
  await page.getByLabel(t("payment.card.expiry")).fill("12/30");
  await page.getByLabel(t("payment.card.cvc")).fill("123");
  await page.getByRole("button", { name: rx(t("payment.pay", { amount: total })) }).click();

  // 7. Order tracking. Back must not return to the payment step (R5-JR-06).
  await expect(page).toHaveURL(new RegExp(`/${locale}/orders/${orderId}\\?paid=1`), { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText(order.number);
  await expect(page.getByRole("main")).toContainText(total);
  await page.goBack();
  await expect(page).not.toHaveURL(/\/checkout\/pay\//, { timeout: 15_000 });
  const billing = (await db.order.findUniqueOrThrow({ where: { id: orderId } })).billing as { company: { name: string; taxId: string } | null };
  expect(billing.company).toMatchObject({ name: "Bunn Coffee LLC", taxId: "123456789" });

  // 8. The printer sees GOLD foil, accepts, produces and uploads QC photos.
  const paid = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  expect(paid.status).toBe("PAID");
  const staff = await db.user.findFirstOrThrow({ where: { vendorId: paid.vendorId, role: "VENDOR" } });
  const vctx = await browser.newContext({ baseURL, locale: locale === "ar" ? "ar-EG" : "en-US" });
  await ackCookies(vctx, baseURL!);
  await signInAs(vctx, baseURL!, staff.id);
  const vp = await vctx.newPage();
  await vp.goto(`/${locale}/vendor/jobs/${order.number}`);
  await expect(vp.getByRole("heading", { level: 1, name: order.number })).toBeVisible({ timeout: 30_000 });
  await expect(vp.getByRole("main")).toContainText(locale === "ar" ? "بصمة ذهبي" : "Gold foil");
  await vp.getByRole("button", { name: t("vendorPortal.job.actions.accept") }).first().click();
  await vp.getByRole("dialog").getByRole("button", { name: t("vendorPortal.job.actions.accept") }).click();
  await vp.getByRole("button", { name: t("vendorPortal.job.actions.startProduction") }).first().click();
  await expect.poll(async () => (await db.order.findUniqueOrThrow({ where: { id: orderId } })).status, { timeout: 30_000 }).toBe("IN_PRODUCTION");
  const qc = vp.locator("#qc");
  const photos = qc.getByRole("list", { name: t("vendorPortal.job.qcTitle") });
  await qc.locator('input[type="file"]').setInputFiles({ name: "sheet.png", mimeType: "image/png", buffer: ONE_PX_PNG });
  await expect(photos.getByRole("listitem")).toHaveCount(1, { timeout: 30_000 });
  await qc.getByLabel(t("vendorPortal.job.qcKind")).selectOption("PACKED_BUNDLE");
  await qc.locator('input[type="file"]').setInputFiles({ name: "bundle.png", mimeType: "image/png", buffer: ONE_PX_PNG });
  await expect(photos.getByRole("listitem")).toHaveCount(2, { timeout: 30_000 });
  await qc.getByRole("button", { name: t("vendorPortal.job.actions.submitQc") }).click();
  await expect.poll(async () => (await db.order.findUniqueOrThrow({ where: { id: orderId } })).status, { timeout: 30_000 }).toBe("QC_PENDING");
  await vctx.close();

  // 9. Ops approve QC and book the courier; the admin order shows the same total and VAT.
  const admin = await db.user.findUniqueOrThrow({ where: { phone: SEEDED.admin } });
  const actx = await browser.newContext({ baseURL });
  await ackCookies(actx, baseURL!);
  await signInAs(actx, baseURL!, admin.id);
  const ap = await actx.newPage();
  await ap.goto(`/${locale}/admin/orders/${order.number}`);
  await expect(ap.getByRole("heading", { level: 1, name: order.number })).toBeVisible({ timeout: 30_000 });
  await expect(ap.getByRole("main")).toContainText(formatMoney(order.totalPiasters, locale, { alwaysDecimals: true }));
  await expect(ap.getByRole("main")).toContainText(formatMoney(order.vatPiasters, locale, { alwaysDecimals: true }));
  await ap.getByRole("button", { name: t("admin.order.qc.approve") }).click();
  await ap.getByRole("button", { name: t("admin.order.ship.action") }).click();
  await expect.poll(async () => (await db.order.findUniqueOrThrow({ where: { id: orderId } })).status, { timeout: 30_000 }).toBe("SHIPPED");
  await actx.close();

  // 10. The courier delivers (mock tracking runs on the shipment's age) and the buyer sees it.
  await ageShipments(orderId);
  await page.goto(`/${locale}/orders/${orderId}`);
  await expect.poll(async () => (await db.order.findUniqueOrThrow({ where: { id: orderId } })).status, { timeout: 30_000 }).toBe("DELIVERED");
  await page.reload();
  await expect(page.getByRole("main")).toContainText(locale === "ar" ? "بصمة ذهبي" : "Gold foil");

  // 11. Receipt: the company and tax number frozen on the order, the same totals and VAT.
  await page.goto(`/${locale}/orders/${orderId}/invoice`);
  const receipt = page.getByRole("main");
  await expect(receipt).toContainText("Bunn Coffee LLC", { timeout: 30_000 });
  await expect(receipt).toContainText("123-456-789");
  await expect(receipt).toContainText(formatMoney(order.totalPiasters, locale));
  await expect(receipt).toContainText(formatMoney(order.vatPiasters, locale));
  await noSideScroll(page);
  expect(buyer.id).toBe(order.buyerId);
});
