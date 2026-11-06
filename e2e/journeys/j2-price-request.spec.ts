import { expect, test } from "@playwright/test";
import { cleanup, createUser, db, deleteOrder, signInAs, signInPhone, SEEDED, track } from "../fixtures/factory";
import { formatMoney } from "../../src/lib/format";
import { ackCookies, localeOf, payByCard, tFor, tr, vatOf } from "./helpers";

/**
 * Journey 2 (docs/audit/journeys.md): the coffee brand asks for 5,000 boxes, above the 2,000-box
 * instant limit. The request must reach the buyer's account and the admin quote inbox with the
 * spec, quantity and note, and ops must be able to work the lead.
 *
 * The second test is R4-B-03 end to end from the buyer's own request: ops price it with "Send
 * price" (amounts typed the way each market types them; a decimal comma is refused), the buyer
 * accepts from the account, checks out with a company invoice and pays; the order and receipt
 * carry the quoted money (VAT 14%).
 */

test.afterAll(cleanup);

async function designAndOpenCheckout(page: import("@playwright/test").Page, locale: "ar" | "en"): Promise<string> {
  await page.goto(`/${locale}/design/mailer-box`);
  await expect(page.getByRole("application", { name: tr(locale, "3D preview of your box") })).toBeVisible({ timeout: 30_000 });
  const panel = page.getByRole("complementary", { name: tr(locale, "Designer panels") });
  await panel.getByRole("tab", { name: tr(locale, "Artwork") }).click();
  await panel.getByRole("button", { name: /#303030/ }).first().click();
  await expect(page).toHaveURL(/[?&]d=[\w-]+/, { timeout: 30_000 });
  const designId = new URL(page.url()).searchParams.get("d")!;
  await page.goto(`/${locale}/checkout/${designId}`);
  await expect(page.getByTestId("vendor-offer").first()).toBeVisible({ timeout: 30_000 });
  return designId;
}

test("J2 · 5,000 boxes: price request reaches the account and the admin inbox", async ({ page, browser, baseURL }, info) => {
  test.setTimeout(180_000);
  const locale = localeOf(info);
  const t = tFor(locale);
  await ackCookies(page.context(), baseURL!);
  const buyer = track(await createUser({ name: "Omar Bunn" }));
  await signInAs(page.context(), baseURL!, buyer.id);
  const designId = await designAndOpenCheckout(page, locale);

  await page.getByLabel(t("checkout.quantity.custom")).fill("5000");
  await page.getByRole("button", { name: t("checkout.quantity.apply") }).click();
  await page.getByLabel(t("buyer.quote.note")).fill("Matte black, delivery in two batches");
  await page.getByRole("button", { name: t("buyer.quote.send"), exact: true }).click();
  await expect(page.getByText(t("buyer.quote.sentTitle", { qty: 5000 }))).toBeVisible({ timeout: 30_000 });
  // No order and no payment for a price request; one request row with the quantity.
  expect(await db.order.count({ where: { buyerId: buyer.id } })).toBe(0);
  const lead = await db.quote.findFirstOrThrow({ where: { userId: buyer.id, designId } });
  expect(lead.status).toBe("REQUESTED");

  // The buyer's account lists it as waiting for a price.
  await page.goto(`/${locale}/account`);
  const requests = page.locator("#quote-requests");
  await expect(requests).toContainText(t("buyer.quote.statusOpen"), { timeout: 30_000 });
  await expect(requests).toContainText("5,000");

  // Ops see the lead with quantity, note and buyer, and mark it contacted.
  const actx = await browser.newContext({ baseURL });
  await ackCookies(actx, baseURL!);
  await signInPhone(actx, baseURL!, SEEDED.admin);
  const ap = await actx.newPage();
  await ap.goto(`/${locale}/admin/quotes`);
  await ap.getByPlaceholder(t("admin.quotes.search")).fill(buyer.phone);
  const row = ap.getByRole("row").filter({ hasText: buyer.phone });
  await expect(row).toContainText("5,000", { timeout: 30_000 });
  await expect(row).toContainText("Matte black, delivery in two batches");
  await row.getByRole("button", { name: t("admin.quotes.contacted") }).click();
  const reply = ap.getByRole("dialog");
  await reply.getByRole("textbox").fill("Called the buyer; checking two printers for 5,000 units");
  await reply.getByRole("button", { name: t("admin.quotes.contacted") }).click();
  await expect.poll(async () => db.auditLog.count({ where: { entityType: "QUOTE", entityId: lead.id, action: "QUOTE_CONTACTED" } }), { timeout: 30_000 }).toBe(1);
  await db.auditLog.deleteMany({ where: { entityType: "QUOTE", entityId: lead.id } });
  await db.quote.delete({ where: { id: lead.id } }).catch(() => undefined);
  await actx.close();
});

test("J2 · admin prices the 5,000-box request, the buyer accepts and pays (R4-B-03)", async ({ page, browser, baseURL }, info) => {
  test.setTimeout(240_000);
  const locale = localeOf(info);
  const t = tFor(locale);
  const ar = locale === "ar";
  await ackCookies(page.context(), baseURL!);
  const tag = Math.random().toString(36).replace(/[^a-z]/g, "").slice(0, 6);
  const buyer = track(await createUser({ name: `Bunn Coffee ${tag}` }));
  await signInAs(page.context(), baseURL!, buyer.id);

  // 1. The buyer asks for 5,000 boxes from checkout (above the 2,000-box instant limit).
  const designId = await designAndOpenCheckout(page, locale);
  await page.getByLabel(t("checkout.quantity.custom")).fill(ar ? "٥٬٠٠٠" : "5,000");
  await page.getByRole("button", { name: t("checkout.quantity.apply") }).click();
  await page.getByRole("button", { name: t("buyer.quote.send"), exact: true }).click();
  await expect(page.getByText(t("buyer.quote.sentTitle", { qty: 5000 }))).toBeVisible({ timeout: 30_000 });
  const lead = await db.quote.findFirstOrThrow({ where: { userId: buyer.id, designId } });
  let orderRef: { id: string; number: string } | null = null;
  try {
    // 2. Ops price it with "Send price". A decimal comma is refused (R6-AD-01), never read as thousands.
    const nile = await db.vendor.findUniqueOrThrow({ where: { slug: "nile-pack" } });
    const actx = await browser.newContext({ baseURL });
    await ackCookies(actx, baseURL!);
    await signInPhone(actx, baseURL!, SEEDED.admin);
    const ap = await actx.newPage();
    await ap.goto(`/${locale}/admin/quotes`);
    await ap.getByRole("button", { name: `${t("admin.quotes.price.send")}: ${buyer.name}` }).filter({ visible: true }).click();
    const dialog = ap.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: t("admin.quotes.price.title", { count: 5000 }) })).toBeVisible();
    await dialog.getByRole("combobox", { name: t("admin.quotes.price.vendor") }).selectOption(nile.id);
    await dialog.getByLabel(t("admin.quotes.price.unit")).fill("18,50");
    await dialog.getByLabel(t("admin.quotes.price.setup")).fill(ar ? "١٬٥٠٠" : "1,500");
    await dialog.getByLabel(t("admin.quotes.price.shipping")).fill(ar ? "١٢٠٠" : "1200");
    await dialog.getByLabel(t("admin.quotes.price.deliveryDays")).fill(ar ? "١٨" : "18");
    await dialog.getByLabel(t("admin.quotes.price.vendorCost")).fill(ar ? "٧٢٬٠٠٠" : "72,000");
    await dialog.getByRole("button", { name: t("admin.quotes.price.send") }).click();
    await expect(dialog.getByText(t("admin.errors.AMOUNT_INVALID")).first()).toBeVisible();
    expect((await db.quote.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe("REQUESTED");
    await dialog.getByLabel(t("admin.quotes.price.unit")).fill(ar ? "١٨٫٥٠" : "18.50");
    // 5,000 × 18.50 + 1,500 setup + 1,200 delivery = 95,200 ex-VAT; VAT 14% = 13,328; total 108,528.
    const subtotal = 9_520_000;
    const vat = vatOf(subtotal);
    const total = subtotal + vat;
    await expect(dialog.getByTestId("send-price-total")).toHaveText(formatMoney(total, locale, { alwaysDecimals: true }));
    await dialog.getByRole("button", { name: t("admin.quotes.price.send") }).click();
    const linkDialog = ap.getByRole("dialog", { name: t("admin.quotes.price.linkTitle") });
    await expect(linkDialog).toBeVisible({ timeout: 30_000 });
    await linkDialog.getByRole("button", { name: t("admin.common.done") }).click();
    const priced = await db.quote.findUniqueOrThrow({ where: { id: lead.id } });
    expect(priced).toMatchObject({ status: "PRICED", vendorId: nile.id, subtotalPiasters: subtotal, vatPiasters: vat, totalPiasters: total, vendorCostPiasters: 7_200_000, deliveryDays: 18 });
    await actx.close();

    // 3. The buyer opens it from the account, checks out with a company invoice and pays.
    await page.goto(`/${locale}/account#quote-requests`);
    const card = page.locator("#quote-requests");
    await expect(card).toContainText(t("buyer.quoted.statusPriced"), { timeout: 30_000 });
    await card.getByRole("link", { name: t("buyer.quoted.action") }).click();
    await expect(page.getByText(t("buyer.quoted.title", { qty: 5000 }))).toBeVisible({ timeout: 30_000 });
    const summary = page.getByRole("complementary").filter({ hasText: t("checkout.summary.title") });
    await expect(summary).toContainText(formatMoney(total, locale, { alwaysDecimals: true }));
    await summary.getByRole("button", { name: t("checkout.actions.continue") }).click();
    await page.getByLabel(t("checkout.address.name")).fill("Omar Bunn");
    await page.getByLabel(t("checkout.address.phone")).fill("010 1234 5678");
    const gov = page.getByLabel(t("checkout.address.governorate"));
    if (await gov.isEnabled()) await gov.selectOption("Cairo");
    await page.getByLabel(t("checkout.address.city")).fill("Zamalek");
    await page.getByLabel(t("checkout.address.street")).fill("12 Brazil St");
    await page.getByLabel(t("buyer.company.toggle")).check();
    await page.getByLabel(t("buyer.company.name")).fill("Bunn Coffee LLC");
    await page.getByLabel(t("buyer.company.taxId")).fill(ar ? "١٢٣٤٥٦٧٨٩" : "123456789");
    await summary.getByRole("button", { name: t("checkout.actions.continue") }).click();
    await page.getByLabel(t("checkout.proof.approve")).check();
    const asIs = page.getByLabel(/Print it as it is|اطبعها كما هي/);
    if (await asIs.count()) await asIs.check();
    await summary.getByRole("button", { name: t("checkout.actions.approveAndPay") }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/checkout/pay/`), { timeout: 30_000 });
    await expect(page.getByTestId("pay-total")).toContainText(formatMoney(total, locale, { alwaysDecimals: true }));
    await payByCard(page, locale);
    await expect.poll(async () => (await db.order.findFirst({ where: { buyerId: buyer.id, status: "PAID" } }))?.id ?? null, { timeout: 30_000 }).not.toBeNull();

    // 4. The order carries the quoted money; the receipt shows it with the frozen company.
    const order = await db.order.findFirstOrThrow({ where: { buyerId: buyer.id, status: "PAID" }, include: { items: true } });
    orderRef = { id: order.id, number: order.number };
    expect(order).toMatchObject({ quoteId: lead.id, vendorId: nile.id, subtotalPiasters: subtotal, vatPiasters: vat, totalPiasters: total, vendorCostPiasters: 7_200_000 });
    expect(order.items[0]!.quantity).toBe(5000);
    expect((order.billing as { company: { taxId: string } | null }).company).toMatchObject({ name: "Bunn Coffee LLC", taxId: "123456789" });
    expect((await db.quote.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe("ACCEPTED");
    await page.goto(`/${locale}/orders/${order.id}/invoice`);
    await expect(page.getByRole("main")).toContainText(formatMoney(total, locale, { alwaysDecimals: true }));
    await expect(page.getByRole("main")).toContainText("123-456-789");
  } finally {
    if (orderRef) await deleteOrder(orderRef.id, orderRef.number);
    await db.auditLog.deleteMany({ where: { entityType: "QUOTE", entityId: lead.id } });
    await db.quote.deleteMany({ where: { id: lead.id } });
  }
});
