import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { SEEDED, cleanup, cloneOrder, createUser, db, signInPhone, track } from "./fixtures/factory";

/**
 * Admin flows. Parallel-safe: the QC review and the payout test each clone ELB-26301 (QC pending,
 * with its photos) into their own order, and the quote-lead test uses a fresh buyer, so no two
 * tests or workers share a row (e2e/fixtures/factory.ts). The admin signs in through a session row.
 */
const TEMPLATE_QC = "ELB-26301";

async function signIn(context: BrowserContext, baseURL: string, phone: string = SEEDED.admin) {
  await signInPhone(context, baseURL, phone);
}

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test.afterAll(async () => {
  await cleanup();
});

test.describe("admin", () => {
  test("non-admins are sent away from /admin", async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!, SEEDED.buyer);
    await page.goto("/en/admin");
    await expect(page).not.toHaveURL(/\/admin/);
  });

  test("overview → QC review → approve for dispatch → audit log → pricing preview", async ({ page, context, baseURL }, info) => {
    test.skip(info.project.name !== "desktop", "mutating flow runs once (desktop)");
    test.setTimeout(120_000);
    const ORDER = (await cloneOrder(TEMPLATE_QC, { status: "QC_PENDING", withQcPhotos: true, label: "Q" })).number;
    await signIn(context, baseURL!);

    await page.goto("/en/admin");
    await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("table", { name: "Free tool funnel by step" })).toBeVisible({ timeout: 30_000 });
    const nav = page.getByRole("navigation", { name: "Admin navigation" });
    await expect(nav).toBeVisible();

    await nav.getByRole("link", { name: /Orders/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Orders" })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("tab", { name: /QC review/ }).click();
    await expect(page).toHaveURL(/view=qc/, { timeout: 30_000 });
    // The "QC review" tab is a client navigation that re-renders the table; a click that lands on
    // the outgoing table is lost, so click until the order page opens (assertion unchanged).
    await expect(async () => {
      if (!page.url().includes(`/admin/orders/${ORDER}`)) await page.getByRole("link", { name: ORDER }).click({ timeout: 5_000 });
      await expect(page).toHaveURL(new RegExp(`/en/admin/orders/${ORDER}$`), { timeout: 5_000 });
    }).toPass({ timeout: 60_000 });
    await expect(page.getByRole("heading", { level: 1, name: ORDER })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Quality check").first()).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: "Approve for dispatch" }).click();
    await expect(page.getByRole("status").getByText("QC approved. The job is ready to ship.")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Ready to ship").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Approve for dispatch" })).toHaveCount(0);

    await nav.getByRole("link", { name: "Audit log" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Audit log" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("row").filter({ hasText: ORDER }).filter({ hasText: "QC approved" }).first()).toBeVisible({ timeout: 30_000 });

    await nav.getByRole("link", { name: "Pricing" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Pricing" })).toBeVisible({ timeout: 30_000 });
    const margin = page.getByLabel("Platform margin (%)");
    await margin.fill("30");
    await page.getByRole("button", { name: "Preview changes" }).click();
    await expect(page.getByText(/sample prices change/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("table", { name: "Current and proposed unit prices" })).toBeVisible({ timeout: 30_000 });
    // Contextual save bar appears while dirty; discard leaves settings untouched.
    // exact: the checkout settings card has its own "Discard checkout settings changes" button.
    await page.getByRole("button", { name: "Discard", exact: true }).click();
    await expect(margin).toHaveValue("25");
  });

  test("admin pages work at 360px and in Arabic", async ({ page, context, baseURL }, info) => {
    test.skip(info.project.name !== "mobile", "layout check runs on the 360px project");
    await signIn(context, baseURL!);
    for (const p of ["/ar/admin", "/ar/admin/orders", "/en/admin/vendors", "/en/admin/pricing", "/en/admin/disputes", "/ar/admin/payouts", "/en/admin/catalog", "/ar/admin/moderation", "/ar/admin/quotes"]) {
      await page.goto(p);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
      await noHorizontalScroll(page);
    }
    await page.goto("/ar/admin");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1, name: "نظرة عامة" })).toBeVisible({ timeout: 30_000 });
  });

  test("vendor payout: raise → approve → mark paid, audited", async ({ page, context, baseURL }, info) => {
    test.skip(info.project.name !== "desktop", "mutating flow runs once, on desktop");
    const order = await cloneOrder(TEMPLATE_QC, { status: "QC_PENDING", label: "P" });
    const ORDER = order.number;
    await signIn(context, baseURL!);
    await page.goto("/en/admin/payouts");
    await expect(page.getByRole("heading", { level: 1, name: "Payouts" })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: `Raise: ${ORDER}, Advance 40%` }).click();
    await page.getByRole("button", { name: `Approve: ${ORDER}, Advance 40%` }).click();
    await page.getByRole("button", { name: `Mark paid: ${ORDER}, Advance 40%` }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Mark paid" }).click();
    await expect(dialog).toBeHidden();
    await expect.poll(async () => (await db.payout.findFirst({ where: { orderId: order.id, kind: "ADVANCE" } }))?.status, { timeout: 15_000 }).toBe("PAID");
    expect(await db.auditLog.count({ where: { entityType: "PAYOUT", summary: { startsWith: ORDER } } })).toBe(3);
  });

  test("catalogue lists library models with availability in Egypt", async ({ page, context, baseURL }, info) => {
    test.skip(info.project.name !== "desktop", "runs on desktop");
    await signIn(context, baseURL!);
    await page.goto("/en/admin/catalog");
    await expect(page.getByRole("tab", { name: "Models" })).toHaveAttribute("aria-selected", "true", { timeout: 30_000 });
    await expect(page.getByRole("link", { name: "Shipping box", exact: true })).toBeVisible();
    await expect(page.getByText(/^Instant · vendors: \d+$/).filter({ visible: true }).first()).toBeVisible();
    await page.getByPlaceholder("Search name, code or standard").fill("FEFCO 0203");
    await expect(page.getByRole("link", { name: "Full overlap slotted container (FOL)" })).toBeVisible();
  });

  test("moderation: a pending portfolio photo is approved and goes public", async ({ page, context, baseURL }, info) => {
    test.skip(info.project.name !== "desktop", "mutating flow runs once, on desktop");
    const vendor = await db.vendor.findUniqueOrThrow({ where: { slug: "nile-pack" } });
    // No digits: a long number would (rightly) be flagged as a phone number and block approval.
    const caption = `E2E moderation ${Math.random().toString(36).replace(/[^a-z]/g, "").slice(0, 8)}`;
    const item = await db.vendorPortfolioItem.create({ data: { vendorId: vendor.id, imageUrl: "/seed/portfolio/alex-print-house-1.svg", captionAr: caption, captionEn: caption, status: "PENDING" } });
    try {
      await signIn(context, baseURL!);
      await page.goto("/en/admin/moderation");
      await expect(page.getByRole("heading", { level: 1, name: "Moderation" })).toBeVisible({ timeout: 30_000 });
      await page.getByRole("button", { name: `Approve: ${caption}` }).click();
      await expect.poll(async () => (await db.vendorPortfolioItem.findUnique({ where: { id: item.id } }))?.status, { timeout: 15_000 }).toBe("APPROVED");
    } finally {
      await db.vendorPortfolioItem.delete({ where: { id: item.id } }).catch(() => {});
      await db.auditLog.deleteMany({ where: { summary: { contains: item.id } } });
    }
  });

  test("quote leads: an open request is marked contacted, audited", async ({ page, context, baseURL }, info) => {
    test.skip(info.project.name !== "desktop", "mutating flow runs once, on desktop");
    const buyer = track(await createUser({ name: "E2E Lead" }));
    const q = await db.quote.create({
      data: { userId: buyer.id, lines: [{ kind: "PRODUCT", quantity: 6500 }], subtotalPiasters: 0, vatPiasters: 0, totalPiasters: 0, validUntil: new Date(Date.now() + 72 * 3_600_000), status: "REQUESTED" },
    });
    await db.auditLog.create({ data: { actorId: buyer.id, actorPhone: buyer.phone, action: "QUOTE_REQUEST", entityType: "QUOTE", entityId: q.id, after: { quantity: 6500, governorate: "GIZA", phone: buyer.phone, spec: { name: "E2E mailer", structureCode: "FEFCO_0427", dims: { L: 250, W: 180, H: 80 }, materialCode: "E_FLUTE_KRAFT" } } } });
    try {
      await signIn(context, baseURL!);
      await page.goto("/en/admin/quotes");
      await expect(page.getByRole("heading", { level: 1, name: "Quote requests" })).toBeVisible({ timeout: 30_000 });
      const row = page.getByRole("row").filter({ hasText: "6,500" });
      await expect(row.getByText(/Reply in \d+ h/).filter({ visible: true })).toBeVisible();
      await row.getByRole("button", { name: /^Mark contacted:/ }).click();
      await page.getByRole("dialog").getByLabel("What you told the buyer").fill("Price and lead time sent on WhatsApp");
      await page.getByRole("dialog").getByRole("button", { name: "Mark contacted" }).click();
      await expect.poll(async () => db.auditLog.count({ where: { entityId: q.id, action: "QUOTE_CONTACTED" } }), { timeout: 15_000 }).toBe(1);
    } finally {
      await db.auditLog.deleteMany({ where: { entityId: q.id } });
      await db.quote.delete({ where: { id: q.id } }).catch(() => {});
    }
  });
});

test.describe("admin routing (round 4)", () => {
  test.afterAll(async () => {
    await cleanup();
  });

  test("reassigning an accepted job cancels the old vendor's unpaid advance (R4-01)", async ({ page, context, baseURL }, info) => {
    test.skip(info.project.name !== "desktop", "mutating flow runs once (desktop)");
    test.setTimeout(120_000);
    const order = await cloneOrder("ELB-26201", { status: "ACCEPTED", label: "R" });
    const oldAdvance = await db.payout.create({ data: { vendorId: order.vendorId, orderId: order.id, kind: "ADVANCE", amountPiasters: 180_000, status: "PENDING" } });
    await signIn(context, baseURL!);
    await page.goto(`/en/admin/orders/${order.number}`);
    await page.getByRole("button", { name: "Change vendor" }).last().click();
    const select = page.getByLabel("New vendor");
    const target = await select.locator("option").evaluateAll((os) => (os as HTMLOptionElement[]).find((o) => o.value && !o.textContent!.includes("No rate card"))?.value ?? "");
    expect(target).not.toBe("");
    await select.selectOption(target);
    await page.getByLabel("Reason").fill("Vendor out of B-flute stock this week");
    await page.getByRole("button", { name: "Reassign" }).click();
    await expect.poll(async () => (await db.order.findUnique({ where: { id: order.id } }))?.vendorId, { timeout: 30_000 }).toBe(target);
    const after = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { payouts: true } });
    expect(after.status).toBe("PAID");
    expect(after.payouts.find((p) => p.id === oldAdvance.id)).toBeUndefined();
    const audit = await db.auditLog.findFirstOrThrow({ where: { action: "ORDER_REASSIGN", entityId: order.id } });
    expect(JSON.stringify(audit.before)).toContain(oldAdvance.id);
  });
});
