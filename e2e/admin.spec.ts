import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import path from "node:path";

/**
 * Admin main flow on seeded data (npm run db:seed): the admin (01000000001) opens the overview,
 * finds ELB-26301 in the "QC review" view, approves QC for dispatch, sees the action in the audit
 * log and previews a margin change on the pricing page without saving it. ELB-26301 is reset
 * first so the spec can run again without reseeding. Sign-in inserts a session row (same hashing
 * as src/lib/auth) to avoid the OTP rate limit on a shared seeded phone.
 */
const dbUrl = process.env.ELBA_DATABASE_URL ?? `file:${path.resolve(__dirname, "../prisma/dev.db")}`;
const db = new PrismaClient({ datasources: { db: { url: dbUrl } } });
const ORDER = "ELB-26301";

async function signIn(context: BrowserContext, baseURL: string, phone = "+201000000001") {
  const user = await db.user.findUniqueOrThrow({ where: { phone } });
  const token = randomBytes(32).toString("base64url");
  await db.session.create({ data: { tokenHash: createHash("sha256").update(token).digest("hex"), userId: user.id, expiresAt: new Date(Date.now() + 3600_000) } });
  await context.addCookies([{ name: "elba_session", value: token, url: baseURL }]);
}

async function resetQcOrder() {
  const order = await db.order.findUniqueOrThrow({ where: { number: ORDER } });
  await db.$transaction([
    db.productionEvent.deleteMany({ where: { orderId: order.id, type: { in: ["QC_APPROVED", "QC_REJECTED", "SHIPPED", "DELIVERED", "CANCELLED"] } } }),
    db.qcPhoto.updateMany({ where: { orderId: order.id }, data: { status: "PENDING", reviewNote: null, reviewedAt: null } }),
    db.auditLog.deleteMany({ where: { entityType: "ORDER", entityId: order.id } }),
    db.order.update({ where: { id: order.id }, data: { status: "QC_PENDING" } }),
  ]);
}

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test.afterAll(async () => {
  await db.$disconnect();
});

test.describe("admin", () => {
  test("non-admins are sent away from /admin", async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!, "+201000000002");
    await page.goto("/en/admin");
    await expect(page).not.toHaveURL(/\/admin/);
  });

  test("overview → QC review → approve for dispatch → audit log → pricing preview", async ({ page, context, baseURL }, info) => {
    test.skip(info.project.name !== "desktop", "mutating flow runs once (desktop)");
    test.setTimeout(120_000);
    await resetQcOrder();
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
    await page.getByRole("link", { name: ORDER }).click();
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
    await page.getByRole("button", { name: "Discard" }).click();
    await expect(margin).toHaveValue("25");
  });

  test("admin pages work at 360px and in Arabic", async ({ page, context, baseURL }, info) => {
    test.skip(info.project.name !== "mobile", "layout check runs on the 360px project");
    await signIn(context, baseURL!);
    for (const p of ["/ar/admin", "/ar/admin/orders", "/en/admin/vendors", "/en/admin/pricing", "/en/admin/disputes", "/ar/admin/payouts", "/en/admin/catalog"]) {
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
    const order = await db.order.findUniqueOrThrow({ where: { number: ORDER } });
    await db.payout.deleteMany({ where: { orderId: order.id } });
    await db.auditLog.deleteMany({ where: { entityType: "PAYOUT", summary: { startsWith: ORDER } } });
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
    await expect(page.getByText(/^Instant · vendors: \d+$/).first()).toBeVisible();
    await page.getByPlaceholder("Search name, code or standard").fill("FEFCO 0203");
    await expect(page.getByRole("link", { name: "Full overlap slotted container (FOL)" })).toBeVisible();
  });
});
