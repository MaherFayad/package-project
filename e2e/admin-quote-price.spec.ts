import { expect, test } from "@playwright/test";
import { SEEDED, cleanup, createUser, db, deleteOrder, signInAs, signInPhone, track } from "./fixtures/factory";

/**
 * R4-B-03 end to end (admin half + checkout half): a buyer's 5,000-box price request is priced
 * in /admin/quotes with "Send price" (printer, ex-VAT lines, delivery days, printer buy price), the
 * buyer opens the link, pays (mock) and the order carries the quoted totals and buy price. Then a
 * catalogue request without a design is priced: a design is made in the buyer's account and the
 * link points at it. Parallel-safe: fresh buyers and their own rows (e2e/fixtures/factory.ts).
 */
test.afterAll(cleanup);

test("admin sends a price for a lead; the buyer pays it; the order has the quoted totals", async ({ page, browser, baseURL }, info) => {
  test.skip(info.project.name !== "desktop", "one mutating run is enough");
  test.setTimeout(180_000);
  const tag = Math.random().toString(36).replace(/[^a-z]/g, "").slice(0, 6);
  const buyer = track(await createUser({ name: `E2E Priced ${tag}` }));
  const material = await db.material.findUniqueOrThrow({ where: { code: "E_FLUTE_KRAFT" } });
  const design = await db.design.create({
    data: {
      ownerId: buyer.id,
      name: "E2E priced run",
      structureCode: "FEFCO_0427",
      dims: { L: 250, W: 180, H: 80 },
      materialId: material.id,
      finishCode: "NONE",
      printSides: "OUTSIDE",
      artwork: { outside: { background: "#f4e9d8", layers: [] }, inside: { background: null, layers: [] } },
    },
  });
  const quote = await db.quote.create({
    data: { userId: buyer.id, designId: design.id, lines: [{ kind: "PRODUCT", quantity: 5000 }], subtotalPiasters: 0, vatPiasters: 0, totalPiasters: 0, validUntil: new Date(Date.now() + 72 * 3_600_000), status: "REQUESTED" },
  });
  await db.auditLog.create({
    data: { actorId: buyer.id, action: "QUOTE_REQUEST", entityType: "QUOTE", entityId: quote.id, after: { designId: design.id, quantity: 5000, governorate: "GIZA", phone: buyer.phone, spec: { name: "E2E priced run", structureCode: "FEFCO_0427", dims: { L: 250, W: 180, H: 80 }, materialCode: "E_FLUTE_KRAFT" } } },
  });
  const vendor = await db.vendor.findFirstOrThrow({ where: { status: "ACTIVE" }, orderBy: { nameEn: "asc" } });
  let orderRef: { id: string; number: string } | null = null;
  try {
    // Admin: Send price.
    const adminCtx = await browser.newContext({ baseURL });
    await signInPhone(adminCtx, baseURL!, SEEDED.admin);
    const admin = await adminCtx.newPage();
    await admin.goto("/en/admin/quotes");
    await expect(admin.getByRole("heading", { level: 1, name: "Quote requests" })).toBeVisible({ timeout: 30_000 });
    await admin.getByRole("button", { name: `Send price: E2E Priced ${tag}` }).filter({ visible: true }).click();
    const dialog = admin.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Send a price for 5,000 boxes" })).toBeVisible();
    await dialog.getByRole("combobox", { name: "Printer" }).selectOption(vendor.id);
    await dialog.getByLabel("Price per box ex-VAT (EGP)").fill("18");
    await dialog.getByLabel("Setup ex-VAT (EGP)").fill("1500");
    await dialog.getByLabel("Delivery ex-VAT (EGP)").fill("1200");
    await dialog.getByLabel("Production and delivery (days)").fill("18");
    // The buy price is required: sending without it shows the reason on the field and saves nothing.
    await dialog.getByRole("button", { name: "Send price" }).click();
    await expect(dialog.getByText("Enter the buy price agreed with this vendor.")).toBeVisible();
    await expect(dialog.getByLabel(/^Printer buy price/)).toBeFocused();
    expect((await db.quote.findUniqueOrThrow({ where: { id: quote.id } })).status).toBe("REQUESTED");
    // At a loss the margin line warns before sending.
    await dialog.getByLabel(/^Printer buy price/).fill("95000");
    await expect(dialog.getByText("Sold at a loss.")).toBeVisible();
    await dialog.getByLabel(/^Printer buy price/).fill("72000");
    await expect(dialog.getByTestId("send-price-total")).toHaveText("EGP 105,678.00");
    await expect(dialog.getByText(/Margin: EGP 19,500\.00 \(21\.3% of goods\)/)).toBeVisible();
    await dialog.getByRole("button", { name: "Send price" }).click();
    const linkDialog = admin.getByRole("dialog", { name: "Link for the buyer" });
    await expect(linkDialog).toBeVisible({ timeout: 30_000 });
    const link = (await linkDialog.locator("bdi").innerText()).trim();
    expect(link).toContain(`/checkout/${design.id}?quote=${quote.id}`);

    const priced = await db.quote.findUniqueOrThrow({ where: { id: quote.id } });
    expect(priced).toMatchObject({ status: "PRICED", vendorId: vendor.id, subtotalPiasters: 9_270_000, vatPiasters: 1_297_800, shippingPiasters: 120_000, totalPiasters: 10_567_800, deliveryDays: 18, vendorCostPiasters: 7_200_000 });
    expect(priced.pricedAt).not.toBeNull();
    expect((priced.lines as { kind: string }[]).map((l) => l.kind)).toEqual(["PRODUCT", "SETUP", "SHIPPING"]);
    expect(await db.auditLog.count({ where: { entityId: quote.id, action: "QUOTE_PRICED" } })).toBe(1);
    await linkDialog.getByRole("button", { name: "Done" }).click();
    // The lead moves to the "Priced" view with its countdown.
    await admin.getByRole("tab", { name: /^Priced/ }).click();
    const row = admin.getByRole("row").filter({ hasText: `E2E Priced ${tag}` });
    await expect(row.getByText(/Price sent · expires in \d+ h/).filter({ visible: true })).toBeVisible();
    await adminCtx.close();

    // Buyer: open the link, pay (mock).
    await signInAs(page.context(), baseURL!, buyer.id);
    await page.goto(new URL(link).pathname + new URL(link).search);
    await expect(page.getByText("Your price for 5,000 boxes")).toBeVisible({ timeout: 30_000 });
    const summary = page.getByRole("complementary").filter({ hasText: "Summary" });
    await expect(summary).toContainText("EGP 105,678.00");
    await summary.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("Full name").fill("Mona Adel");
    await page.getByLabel("City or district").fill("Dokki");
    await page.getByLabel("Street address").fill("12 Tahrir St");
    await summary.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("I approve this proof for printing").check();
    const override = page.getByLabel(/Print it as it is/);
    if (await override.count()) await override.check();
    await summary.getByRole("button", { name: "Approve proof and pay" }).click();
    await expect(page).toHaveURL(/\/en\/checkout\/pay\//, { timeout: 30_000 });
    await expect(page.getByTestId("pay-total")).toContainText("EGP 105,678.00");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("Card number").fill("4242 4242 4242 4242");
    await page.getByLabel("Expiry (MM/YY)").fill("12/30");
    await page.getByLabel("Security code").fill("123");
    await page.getByRole("button", { name: /^Pay / }).click();
    await expect.poll(async () => (await db.order.findFirst({ where: { buyerId: buyer.id }, select: { status: true } }))?.status, { timeout: 30_000 }).toBe("PAID");

    const order = await db.order.findFirstOrThrow({ where: { buyerId: buyer.id }, include: { items: true } });
    orderRef = { id: order.id, number: order.number };
    expect(order).toMatchObject({ quoteId: quote.id, vendorId: vendor.id, subtotalPiasters: 9_270_000, vatPiasters: 1_297_800, totalPiasters: 10_567_800, vendorCostPiasters: 7_200_000 });
    expect(order.items[0]!.quantity).toBe(5000);
    expect((await db.quote.findUniqueOrThrow({ where: { id: quote.id } })).status).toBe("ACCEPTED");
  } finally {
    if (orderRef) await deleteOrder(orderRef.id, orderRef.number);
    await db.auditLog.deleteMany({ where: { entityId: quote.id } });
    await db.quote.deleteMany({ where: { id: quote.id } });
    await db.design.deleteMany({ where: { id: design.id } }).catch(() => undefined);
  }
});

test("a catalogue request without a design gets one from the requested model when priced", async ({ browser, baseURL }, info) => {
  test.skip(info.project.name !== "desktop", "one mutating run is enough");
  test.setTimeout(120_000);
  const tag = Math.random().toString(36).replace(/[^a-z]/g, "").slice(0, 6);
  const buyer = track(await createUser({ name: `E2E Catalogue ${tag}` }));
  const quote = await db.quote.create({
    data: {
      userId: buyer.id,
      lines: [{ type: "CATALOGUE_REQUEST", modelCode: "LIQUID_ASEPTIC_BRICK", name: { ar: "علبة عصير", en: "Aseptic brick" }, presetId: null, dims: null, quantity: 20000, notes: "" }],
      subtotalPiasters: 0,
      vatPiasters: 0,
      totalPiasters: 0,
      validUntil: new Date(Date.now() + 14 * 24 * 3_600_000),
      status: "REQUESTED",
    },
  });
  await db.auditLog.create({ data: { actorId: buyer.id, action: "QUOTE_REQUEST", entityType: "QUOTE", entityId: quote.id, summary: "20,000 x LIQUID_ASEPTIC_BRICK · catalogue", after: { designId: null, quantity: 20000, governorate: null, phone: buyer.phone, spec: { name: "Aseptic brick", modelCode: "LIQUID_ASEPTIC_BRICK", presetId: null, dims: null } } } });
  const vendor = await db.vendor.findFirstOrThrow({ where: { status: "ACTIVE" }, orderBy: { nameEn: "asc" } });
  try {
    const ctx = await browser.newContext({ baseURL });
    await signInPhone(ctx, baseURL!, SEEDED.admin);
    const admin = await ctx.newPage();
    await admin.goto("/en/admin/quotes");
    await admin.getByRole("button", { name: `Send price: E2E Catalogue ${tag}` }).filter({ visible: true }).click();
    const dialog = admin.getByRole("dialog");
    await expect(dialog.getByText(/Catalogue request without a design/)).toBeVisible();
    await dialog.getByRole("combobox", { name: "Printer" }).selectOption(vendor.id);
    await dialog.getByLabel("Price per box ex-VAT (EGP)").fill("4.50");
    await dialog.getByLabel("Delivery ex-VAT (EGP)").fill("2000");
    await dialog.getByLabel("Production and delivery (days)").fill("25");
    await dialog.getByLabel(/^Printer buy price/).fill("70000");
    await dialog.getByRole("button", { name: "Send price" }).click();
    await expect(admin.getByRole("dialog", { name: "Link for the buyer" })).toBeVisible({ timeout: 30_000 });
    const q = await db.quote.findUniqueOrThrow({ where: { id: quote.id } });
    expect(q.status).toBe("PRICED");
    expect(q.designId).not.toBeNull();
    const d = await db.design.findUniqueOrThrow({ where: { id: q.designId! } });
    expect(d).toMatchObject({ ownerId: buyer.id, modelCode: "LIQUID_ASEPTIC_BRICK" });
    await expect(admin.getByRole("dialog", { name: "Link for the buyer" }).locator("bdi")).toContainText(`/checkout/${q.designId}?quote=${quote.id}`);
    await admin.getByRole("dialog", { name: "Link for the buyer" }).getByRole("button", { name: "Done" }).click();

    // Close works on a priced lead and withdraws the buyer's link (validUntil ends now).
    await admin.getByRole("tab", { name: /^Priced/ }).click();
    await admin.getByRole("button", { name: `Close: E2E Catalogue ${tag}` }).filter({ visible: true }).click();
    await admin.getByRole("dialog").getByLabel("Outcome").fill("Buyer chose another supplier");
    await admin.getByRole("dialog").getByRole("button", { name: "Close request" }).click();
    await expect.poll(async () => db.auditLog.count({ where: { entityId: quote.id, action: "QUOTE_CLOSED" } }), { timeout: 15_000 }).toBe(1);
    expect((await db.quote.findUniqueOrThrow({ where: { id: quote.id } })).validUntil.getTime()).toBeLessThanOrEqual(Date.now());
    await ctx.close();
  } finally {
    const q = await db.quote.findUnique({ where: { id: quote.id } });
    await db.auditLog.deleteMany({ where: { entityId: quote.id } });
    await db.quote.deleteMany({ where: { id: quote.id } });
    if (q?.designId) await db.design.deleteMany({ where: { id: q.designId } });
  }
});
