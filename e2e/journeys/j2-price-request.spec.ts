import { expect, test } from "@playwright/test";
import { cleanup, createUser, db, signInAs, signInPhone, SEEDED, track } from "../fixtures/factory";
import { ackCookies, localeOf, tFor, tr } from "./helpers";

/**
 * Journey 2 (docs/audit/journeys.md): the coffee brand asks for 5,000 boxes, above the 2,000-box
 * instant limit. The request must reach the buyer's account and the admin quote inbox with the
 * spec, quantity and note, and ops must be able to work the lead.
 *
 * The second half (admin prices the lead, the buyer accepts and pays) is R4-B-03, built this round
 * by the admin and checkout sessions; until it lands that test is marked fixme, not deleted, so the
 * gap stays visible in every run.
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

test.fixme("J2 · admin prices the 5,000-box lead, the buyer accepts and pays (R4-B-03, admin + checkout)", async () => {
  // Admin: "Send price" on the lead (printer, unit price ex-VAT, validity) → a Quote for the design and
  // quantity. Buyer: the link opens /checkout/[designId]?quote=<id>, skips the 2,000 cap for that quote,
  // shows the quoted total with VAT 14%, and pays by mock card; the order carries the quoted lines.
});
