import { expect, test } from "@playwright/test";
import { cleanup, createUser, db, deleteOrder, signInAs, track } from "./fixtures/factory";

/**
 * R4-B-03 (checkout half): the team prices a price request (simulated here the way the admin
 * "Send price" form stores it: status PRICED, lines, totals, vendor, delivery days, printer cost),
 * the buyer opens the link from the account, pays, and the quote becomes ACCEPTED. 5,000 boxes,
 * so the 2,000-box instant cap is bypassed only through that quote. The link works once and only
 * for its own buyer.
 */
test.afterAll(cleanup);

test("a team-priced request above 2,000 boxes is accepted and paid once", async ({ page, browser, baseURL }, info) => {
  test.skip(info.project.name !== "desktop", "one checkout is enough");
  test.setTimeout(150_000);
  const buyer = track(await createUser({ name: "E2E quote buyer" }));
  const other = track(await createUser({ name: "E2E quote other" }));
  const material = await db.material.findUniqueOrThrow({ where: { code: "E_FLUTE_KRAFT" } });
  const design = await db.design.create({
    data: {
      ownerId: buyer.id,
      name: "E2E big run",
      structureCode: "FEFCO_0427",
      dims: { L: 250, W: 180, H: 80 },
      materialId: material.id,
      finishCode: "NONE",
      printSides: "OUTSIDE",
      artwork: { outside: { background: "#f4e9d8", layers: [] }, inside: { background: null, layers: [] } },
    },
  });
  const vendor = await db.vendor.findFirstOrThrow({ where: { status: "ACTIVE" } });
  const lines = [
    { kind: "PRODUCT", labelKey: "pricing.line.product", quantity: 5000, unitPiasters: 1800, totalPiasters: 9_000_000 },
    { kind: "SETUP", labelKey: "pricing.line.setup", quantity: 1, unitPiasters: 150_000, totalPiasters: 150_000 },
    { kind: "SHIPPING", labelKey: "pricing.line.shipping", quantity: 1, unitPiasters: 120_000, totalPiasters: 120_000 },
  ];
  const subtotal = 9_270_000;
  const vat = Math.round(subtotal * 0.14);
  const quote = await db.quote.create({
    data: {
      userId: buyer.id,
      designId: design.id,
      vendorId: vendor.id,
      lines,
      subtotalPiasters: subtotal,
      vatPiasters: vat,
      shippingPiasters: 120_000,
      totalPiasters: subtotal + vat,
      validUntil: new Date(Date.now() + 48 * 3_600_000),
      status: "PRICED",
      pricedAt: new Date(),
      deliveryDays: 18,
      vendorCostPiasters: 7_500_000,
    },
  });
  await db.auditLog.create({ data: { actorId: buyer.id, action: "QUOTE_REQUEST", entityType: "QUOTE", entityId: quote.id, summary: "e2e", after: { governorate: "GIZA" } } });

  // Another account cannot use it.
  const ctx = await browser.newContext({ baseURL });
  await signInAs(ctx, baseURL!, other.id);
  const o = await ctx.newPage();
  await o.goto(`/en/checkout/${design.id}?quote=${quote.id}`);
  await expect(o.getByText("Design not found")).toBeVisible();
  await ctx.close();

  // The buyer: account card -> checkout at the sent price.
  await signInAs(page.context(), baseURL!, buyer.id);
  await page.goto("/en/account#quote-requests");
  const card = page.locator("#quote-requests");
  await expect(card).toContainText("Price ready");
  await card.getByRole("link", { name: "Review price and pay" }).click();
  await expect(page).toHaveURL(new RegExp(`/en/checkout/${design.id}\\?quote=${quote.id}$`));
  await expect(page.getByText("Your price for 5,000 boxes")).toBeVisible();
  await expect(page.getByRole("radio", { name: /^500 boxes/ })).toHaveCount(0);
  const summary = page.getByRole("complementary").filter({ hasText: "Your order" });
  await expect(summary).toContainText("EGP 105,678.00");
  await summary.getByRole("button", { name: "Continue to address" }).click();

  // Address and approval on one step.
  await page.getByLabel("Full name").fill("Mona Adel");
  await expect(page.getByLabel("Governorate")).toBeDisabled();
  await expect(page.getByLabel("Governorate")).toHaveValue("Giza");
  await page.getByLabel("City or district").fill("Dokki");
  await page.getByLabel("Street address").fill("12 Tahrir St");
  await page.getByLabel("I checked the design. Print it as it is.").check();
  const override = page.locator("#preflight-override");
  if (await override.count()) await override.check();
  await summary.getByRole("button", { name: "Continue to payment" }).click();
  await expect(page).toHaveURL(/\/en\/checkout\/pay\//, { timeout: 30_000 });
  await expect(page.getByTestId("pay-total")).toContainText("EGP 105,678.00");

  const order = await db.order.findFirstOrThrow({ where: { buyerId: buyer.id }, include: { items: true } });
  expect(order).toMatchObject({ quoteId: quote.id, vendorId: vendor.id, totalPiasters: subtotal + vat, vendorCostPiasters: 7_500_000 });
  expect(order.items[0].quantity).toBe(5000);
  expect((await db.quote.findUniqueOrThrow({ where: { id: quote.id } })).status).toBe("ACCEPTED");

  // The link is used: opening it again offers today's prices, not the sent one.
  await page.goto(`/en/checkout/${design.id}?quote=${quote.id}`);
  await expect(page.getByText("This price is no longer available")).toBeVisible();
  await expect(page.getByText("Your price for 5,000 boxes")).toHaveCount(0);

  await deleteOrder(order.id, order.number);
  await db.auditLog.deleteMany({ where: { entityId: quote.id } });
  await db.quote.deleteMany({ where: { id: quote.id } });
});
