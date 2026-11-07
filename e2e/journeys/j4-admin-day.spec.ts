import { expect, test, type Browser } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { SEEDED, cleanup, cloneOrder, createUser, db, deleteOrder, signInAs, signInPhone, track } from "../fixtures/factory";
import { formatMoney } from "../../src/lib/format";
import { ackCookies, localeOf, tFor, tr } from "./helpers";

/**
 * Journey 4 (docs/audit/journeys.md): a day in ops. A buyer reports a print defect and ops order a
 * reprint (only from printers that can make the job, R5-JR-08; the reprint keeps the model and the
 * configured finishes, R5-JR-02); a paid order is refunded; a vendor advance is raised, approved
 * and paid; a portfolio photo is moderated; a checkout setting is changed and reaches checkout;
 * the KPI overview renders with no broken numbers. Every case uses its own cloned orders.
 */

test.afterAll(cleanup);

async function adminPage(browser: Browser, baseURL: string) {
  const ctx = await browser.newContext({ baseURL });
  await ackCookies(ctx, baseURL);
  await signInPhone(ctx, baseURL, SEEDED.admin);
  return { ctx, page: await ctx.newPage() };
}

test("J4 · dispute → reprint by a capable printer, free for the buyer", async ({ page, browser, baseURL }, info) => {
  test.setTimeout(150_000);
  const locale = localeOf(info);
  const t = tFor(locale);
  await ackCookies(page.context(), baseURL!);
  const buyer = track(await createUser());
  const order = await cloneOrder("ELB-26203", { status: "DELIVERED", buyerId: buyer.id, label: "X", withQcPhotos: true });
  await db.order.update({ where: { id: order.id }, data: { deliveredAt: new Date() } });
  await signInAs(page.context(), baseURL!, buyer.id);

  // The buyer reports the defect from the order page.
  await page.goto(`/${locale}/orders/${order.id}`);
  await page.getByRole("button", { name: t("orders.dispute.title") }).click();
  await page.getByLabel(t("orders.dispute.reason")).selectOption("PRINT_DEFECT");
  await page.getByLabel(t("orders.dispute.description")).fill("Gold foil is smudged on 40 boxes of the first bundle.");
  await page.getByRole("button", { name: t("orders.dispute.submit") }).click();
  const dispute = await expect.poll(async () => db.dispute.findFirst({ where: { orderId: order.id } }), { timeout: 30_000 }).not.toBeNull().then(() => db.dispute.findFirstOrThrow({ where: { orderId: order.id } }));

  // Ops: reprint. The vendor list holds only printers that make this style and board.
  const { ctx, page: ap } = await adminPage(browser, baseURL!);
  await ap.goto(`/${locale}/admin/disputes/${dispute.id}`);
  await ap.getByRole("radio", { name: t("admin.disputes.detail.decisions.REPRINT") }).check();
  const options = await ap.getByLabel(t("admin.disputes.detail.reprintVendor")).locator("option").allInnerTexts();
  const labelPrinter = await db.vendor.findUniqueOrThrow({ where: { slug: "cairo-label-flex" } });
  expect(options.join("|")).not.toContain(locale === "ar" ? labelPrinter.nameAr : labelPrinter.nameEn);
  await ap.getByLabel(t("admin.disputes.detail.note")).fill("Reprint the smudged boxes");
  await ap.getByRole("button", { name: t("admin.disputes.detail.submit") }).click();
  await expect.poll(async () => (await db.dispute.findUniqueOrThrow({ where: { id: dispute.id } })).status, { timeout: 30_000 }).toBe("RESOLVED_REPRINT");
  const reprint = await db.order.findFirstOrThrow({ where: { notes: { startsWith: `REPRINT_OF:${order.number}` } }, include: { items: true } });
  const original = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true } });
  try {
    expect(reprint.totalPiasters).toBe(0);
    expect(reprint.status).toBe("PAID");
    expect(reprint.items[0]!.modelCode).toBe(original.items[0]!.modelCode);
    expect(reprint.items[0]!.config).toEqual(original.items[0]!.config);
    // The buyer sees the reprint in the dispute card.
    await page.reload();
    // R5-JR-16: the buyer sees the outcome and can track the free reprint.
    await expect(page.getByRole("main")).toContainText(t("orders.dispute.status.RESOLVED_REPRINT"));
    await expect(page.getByRole("link", { name: t("orders.dispute.reprintLink", { number: reprint.number }) })).toBeVisible();
  } finally {
    await deleteOrder(reprint.id, reprint.number);
    await ctx.close();
  }
});

test("J4 · refund a paid order: payment refunded, order closed", async ({ browser, baseURL }, info) => {
  test.setTimeout(120_000);
  const locale = localeOf(info);
  const t = tFor(locale);
  const order = await cloneOrder("ELB-26202", { status: "PAID", label: "F" });
  const { ctx, page: ap } = await adminPage(browser, baseURL!);
  await ap.goto(`/${locale}/admin/orders/${order.number}`);
  await ap.getByRole("button", { name: t("admin.order.refund.button") }).click();
  const dialog = ap.getByRole("dialog");
  const row = await db.order.findUniqueOrThrow({ where: { id: order.id } });
  await expect(dialog).toContainText(formatMoney(row.totalPiasters, locale, { alwaysDecimals: true }));
  await dialog.getByLabel(t("admin.common.reason")).fill("Buyer cancelled before production");
  await dialog.getByRole("button", { name: t("admin.order.refund.button") }).click();
  await expect.poll(async () => (await db.order.findUniqueOrThrow({ where: { id: order.id } })).status, { timeout: 30_000 }).toBe("REFUNDED");
  const payments = await db.payment.findMany({ where: { orderId: order.id } });
  expect(payments.every((p) => p.status === "REFUNDED")).toBe(true);
  await ctx.close();
});

test("J4 · payouts: raise, approve and pay a vendor advance (40% of the buy price)", async ({ browser, baseURL }, info) => {
  test.setTimeout(120_000);
  const locale = localeOf(info);
  const t = tFor(locale);
  const order = await cloneOrder("ELB-26201", { status: "ACCEPTED", label: "Y" });
  const { ctx, page: ap } = await adminPage(browser, baseURL!);
  await ap.goto(`/${locale}/admin/orders/${order.number}`);
  const kind = t("admin.payouts.kinds.ADVANCE");
  for (const step of ["RAISE", "APPROVE"] as const) {
    await ap.getByRole("button", { name: `${t(`admin.payouts.steps.${step}`)}: ${order.number}, ${kind}` }).click();
    await expect.poll(async () => (await db.payout.findFirst({ where: { orderId: order.id, kind: "ADVANCE" } }))?.status ?? null, { timeout: 30_000 }).toBe(step === "RAISE" ? "PENDING" : "APPROVED");
  }
  await ap.getByRole("button", { name: `${t("admin.payouts.steps.PAY")}: ${order.number}, ${kind}` }).click();
  await ap.getByRole("dialog").getByRole("button", { name: t("admin.payouts.steps.PAY") }).click();
  await expect.poll(async () => (await db.payout.findFirst({ where: { orderId: order.id, kind: "ADVANCE" } }))?.status ?? null, { timeout: 30_000 }).toBe("PAID");
  const payout = await db.payout.findFirstOrThrow({ where: { orderId: order.id, kind: "ADVANCE" } });
  const cost = (await db.order.findUniqueOrThrow({ where: { id: order.id } })).vendorCostPiasters;
  expect(payout.amountPiasters).toBe(Math.round(cost * 0.4));
  await ctx.close();
});

test("J4 · moderation: a pending portfolio photo is approved and goes public", async ({ browser, baseURL }, info) => {
  const locale = localeOf(info);
  const t = tFor(locale);
  const delta = await db.vendor.findUniqueOrThrow({ where: { slug: "delta-cartons" } });
  const caption = `Kraft mailer run ${randomBytes(3).toString("hex")}`;
  const item = await db.vendorPortfolioItem.create({ data: { vendorId: delta.id, imageUrl: "/seed/portfolio/nile-1.svg", captionAr: caption, captionEn: caption, status: "PENDING", sortOrder: 99 } });
  try {
    const { ctx, page: ap } = await adminPage(browser, baseURL!);
    await ap.goto(`/${locale}/admin/moderation`);
    await ap.getByRole("button", { name: `${t("admin.moderation.approve")}: ${caption}` }).click();
    await expect.poll(async () => (await db.vendorPortfolioItem.findUniqueOrThrow({ where: { id: item.id } })).status, { timeout: 30_000 }).toBe("APPROVED");
    await ctx.close();
  } finally {
    await db.vendorPortfolioItem.delete({ where: { id: item.id } }).catch(() => undefined);
  }
});

test("J4 · settings: the sample credit window set by ops reaches checkout", async ({ page, browser, baseURL }, info) => {
  test.setTimeout(300_000);
  const locale = localeOf(info);
  const t = tFor(locale);
  // The checkout setting is global: a row with a unique key is a mutex across workers, so the two
  // projects never interleave their change-and-restore.
  const LOCK = "e2e-lock:checkout-setting";
  await expect(async () => {
    // A lock left by a killed run expires after 3 minutes (the test holds it for well under one).
    await db.platformSetting.deleteMany({ where: { key: LOCK, updatedAt: { lt: new Date(Date.now() - 180_000) } } });
    await db.platformSetting.create({ data: { key: LOCK, value: { at: Date.now() } } });
  }).toPass({ timeout: 200_000, intervals: [500] });
  const before = await db.platformSetting.findUnique({ where: { key: "checkout" } });
  const { ctx, page: ap } = await adminPage(browser, baseURL!);
  const days = info.project.name === "mobile" ? 59 : 61;
  try {
    await ap.goto(`/${locale}/admin/pricing`);
    const form = ap.getByRole("form", { name: t("admin.pricing.checkout.title") });
    await form.getByLabel(t("admin.pricing.checkout.sampleDays")).fill(String(days));
    await form.getByRole("button", { name: t("admin.pricing.checkout.save") }).click();
    await expect(ap.getByText(t("admin.pricing.checkout.saved")).first()).toBeVisible({ timeout: 30_000 });

    await ackCookies(page.context(), baseURL!);
    const buyer = track(await createUser());
    await signInAs(page.context(), baseURL!, buyer.id);
    await page.goto(`/${locale}/design/mailer-box`);
    await expect(page.getByRole("application", { name: tr(locale, "3D preview of your box") })).toBeVisible({ timeout: 30_000 });
    const panel = page.getByRole("complementary", { name: tr(locale, "Designer panels") });
    await panel.getByRole("tab", { name: tr(locale, "Artwork") }).click();
    await panel.getByRole("button", { name: /#c8964f/ }).first().click();
    await expect(page).toHaveURL(/[?&]d=[\w-]+/, { timeout: 30_000 });
    const designId = new URL(page.url()).searchParams.get("d")!;
    await page.goto(`/${locale}/checkout/${designId}`);
    // Another worker may save its own value in between; ours or theirs, the page shows the stored one.
    await expect(page.getByText(t("buyer.sample.help", { days }))).toBeVisible({ timeout: 30_000 });
    await db.design.delete({ where: { id: designId } }).catch(() => undefined);
  } finally {
    if (before) await db.platformSetting.update({ where: { key: "checkout" }, data: { value: before.value as object } });
    else await db.platformSetting.deleteMany({ where: { key: "checkout" } });
    await db.platformSetting.deleteMany({ where: { key: LOCK } });
    await ctx.close();
  }
});

test("J4 · KPI overview renders with real numbers (no NaN, no undefined)", async ({ browser, baseURL }, info) => {
  const locale = localeOf(info);
  const t = tFor(locale);
  const { ctx, page: ap } = await adminPage(browser, baseURL!);
  await ap.goto(`/${locale}/admin`);
  await expect(ap.getByRole("heading", { level: 1, name: t("admin.overview.title") })).toBeVisible({ timeout: 30_000 });
  const text = await ap.getByRole("main").innerText();
  expect(text).not.toMatch(/NaN|undefined|Infinity/);
  await expect(ap.getByRole("main")).toContainText(locale === "ar" ? "ج.م" : "EGP");
  await ctx.close();
});
