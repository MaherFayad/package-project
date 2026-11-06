import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import path from "node:path";

/**
 * Vendor portal main flow on seeded data (npm run db:seed):
 * Delta Cartons (01000000011) gets job ELB-26201 (paid, awaiting acceptance). The test resets that
 * job first, so it can run again without reseeding. Sign-in is done by inserting a session row
 * (same hashing as src/lib/auth) to avoid the OTP rate limit on a shared seeded phone.
 */
const dbUrl = process.env.ELBA_DATABASE_URL ?? `file:${path.resolve(__dirname, "../prisma/dev.db")}`;
const db = new PrismaClient({ datasources: { db: { url: dbUrl } } });
const JOB = "ELB-26201";
const OTHER_VENDOR_JOB = "ELB-26001"; // Nile Pack's order

// 1x1 PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

async function signIn(context: BrowserContext, baseURL: string, phone: string) {
  const user = await db.user.findUniqueOrThrow({ where: { phone } });
  const token = randomBytes(32).toString("base64url");
  await db.session.create({ data: { tokenHash: createHash("sha256").update(token).digest("hex"), userId: user.id, expiresAt: new Date(Date.now() + 3600_000) } });
  await context.addCookies([{ name: "elba_session", value: token, url: baseURL }]);
}

async function resetJob() {
  const order = await db.order.findUniqueOrThrow({ where: { number: JOB } });
  await db.$transaction([
    db.productionEvent.deleteMany({ where: { orderId: order.id, type: { notIn: ["ORDER_PLACED", "PROOF_APPROVED", "PAYMENT_CONFIRMED"] } } }),
    db.qcPhoto.deleteMany({ where: { orderId: order.id } }),
    db.payout.deleteMany({ where: { orderId: order.id } }),
    db.order.update({ where: { id: order.id }, data: { status: "PAID" } }),
  ]);
}

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test.afterAll(async () => {
  await db.$disconnect();
});

test.describe("vendor portal", () => {
  test("accept a job, start production, upload QC photos and submit for QC", async ({ page, context, baseURL }, info) => {
    test.skip(info.project.name !== "desktop", "mutating flow runs once (desktop)");
    test.setTimeout(120_000);
    await resetJob();
    await signIn(context, baseURL!, "+201000000011");

    // Dashboard shows the waiting job.
    await page.goto("/en/vendor");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Welcome");
    await expect(page.getByTestId("metric-awaiting")).not.toHaveText("0");
    await expect(page.getByRole("navigation", { name: "Vendor portal navigation" })).toBeVisible();

    // Jobs index: filter to "Awaiting answer" and open the job.
    await page.getByRole("link", { name: "Jobs", exact: false }).first().click();
    await expect(page).toHaveURL(/\/en\/vendor\/jobs/);
    await page.getByRole("tab", { name: /Awaiting answer/ }).click();
    await expect(page).toHaveURL(/view=awaiting/);
    await page.getByRole("link", { name: JOB }).click();
    await expect(page.getByRole("heading", { level: 1, name: JOB })).toBeVisible();

    // Production files: the dieline is available, the print PDF is locked before acceptance.
    const dieline = await page.request.get(await page.getByRole("link", { name: "Dieline (SVG)" }).getAttribute("href").then((h) => h!));
    expect(dieline.status()).toBe(200);
    expect(await dieline.text()).toContain("<svg");

    // Accept (confirmation modal).
    await page.getByRole("button", { name: "Accept job" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Accept job");
    await dialog.getByRole("button", { name: "Accept job" }).click();
    await expect(page.getByText("Accepted by vendor").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Print-ready PDF" })).toBeVisible();
    const pdf = await page.request.get((await page.getByRole("link", { name: "Print-ready PDF" }).getAttribute("href"))!);
    expect(pdf.status()).toBe(200);
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

    // Start production.
    await page.getByRole("button", { name: "Start production" }).first().click();
    await expect(page.getByText("In production").first()).toBeVisible();

    // QC photos: first printed sheet, then packed bundle (file picker = keyboard/single-pointer path).
    const qc = page.locator("#qc");
    const submit = qc.getByRole("button", { name: "Submit for quality check" });
    await expect(submit).toBeDisabled();
    await qc.locator('input[type="file"]').setInputFiles({ name: "sheet.png", mimeType: "image/png", buffer: PNG });
    // Scope to the uploaded-photo list: the required-photos checklist also names both kinds.
    const photos = qc.getByRole("list", { name: "Quality check photos" });
    await expect(photos.getByRole("listitem").filter({ hasText: "First printed sheet" })).toBeVisible();
    await qc.getByLabel("Photo type").selectOption("PACKED_BUNDLE");
    await qc.locator('input[type="file"]').setInputFiles({ name: "bundle.png", mimeType: "image/png", buffer: PNG });
    await expect(photos.getByRole("listitem").filter({ hasText: "Packed bundle" })).toBeVisible();
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page.getByText("Quality check in progress")).toBeVisible();

    // Note to ops appears in the timeline.
    await page.getByLabel("Note to the Elba team").fill("Board arrives tomorrow morning.");
    await page.getByRole("button", { name: "Post" }).click();
    await expect(page.getByText("Board arrives tomorrow morning.")).toBeVisible();

    const order = await db.order.findUniqueOrThrow({ where: { number: JOB }, include: { payouts: true, qcPhotos: true } });
    expect(order.status).toBe("QC_PENDING");
    expect(order.qcPhotos).toHaveLength(2);
    expect(order.payouts.find((p) => p.kind === "ADVANCE")?.status).toBe("PENDING");
  });

  test("a vendor cannot see another vendor's job or its files", async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!, "+201000000011");
    await page.goto(`/en/vendor/jobs/${OTHER_VENDOR_JOB}`);
    await expect(page.getByText("This job does not exist or is not routed to you.")).toBeVisible();
    const other = await db.order.findUniqueOrThrow({ where: { number: OTHER_VENDOR_JOB } });
    expect((await page.request.get(`/api/vendor/jobs/${other.id}/dieline`)).status()).toBe(404);
    expect((await page.request.get(`/api/vendor/jobs/${other.id}/print-pdf`)).status()).toBe(404);
  });

  test("portfolio photos under review are private until Elba approves them (B-08)", async ({ browser, baseURL }, info) => {
    test.skip(info.project.name !== "desktop", "mutating flow runs once (desktop)");
    const ctx = async (phone?: string) => {
      const c = await browser.newContext({ baseURL });
      if (phone) await signIn(c, baseURL!, phone);
      return c;
    };
    const owner = await ctx("+201000000010"); // Nile Pack staff
    const up = await owner.request.post("/api/vendor/uploads", { multipart: { scope: "portfolio", file: { name: "job.png", mimeType: "image/png", buffer: PNG } } });
    expect(up.ok()).toBe(true);
    const { url, item } = (await up.json()) as { url: string; item: { id: string; status: string } };
    expect(item.status).toBe("PENDING");
    try {
      const anon = await ctx();
      const otherVendor = await ctx("+201000000011");
      const buyer = await ctx("+201000000002");
      const admin = await ctx("+201000000001");
      for (const c of [anon, otherVendor, buyer]) expect((await c.request.get(url)).status()).toBe(404);
      const own = await owner.request.get(url);
      expect(own.status()).toBe(200);
      expect(own.headers()["cache-control"]).toContain("no-store");
      expect((await admin.request.get(url)).status()).toBe(200);
      // Not on the public profile while pending.
      expect(await (await anon.request.get("/en/vendors/nile-pack")).text()).not.toContain(url);

      await db.vendorPortfolioItem.update({ where: { id: item.id }, data: { status: "APPROVED" } });
      const pub = await anon.request.get(url);
      expect(pub.status()).toBe(200);
      expect(pub.headers()["cache-control"]).toBe("public, max-age=3600");

      await db.vendorPortfolioItem.update({ where: { id: item.id }, data: { status: "REJECTED" } });
      expect((await anon.request.get(url)).status()).toBe(404);
      for (const c of [anon, otherVendor, buyer, admin]) await c.close();
    } finally {
      await db.vendorPortfolioItem.delete({ where: { id: item.id } }).catch(() => null);
      await owner.close();
    }
  });

  test("buyers are kept out of the portal", async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!, "+201000000002");
    await page.goto("/en/vendor");
    await expect(page).toHaveURL(/\/en\?denied=1$/);
    // …but can open the vendor application.
    await page.goto("/en/vendor/apply");
    await expect(page.getByRole("heading", { level: 1, name: "Become an Elba print vendor" })).toBeVisible();
  });

  test("Arabic portal is RTL and fits a phone screen", async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!, "+201000000010");
    for (const p of ["/ar/vendor", "/ar/vendor/jobs", "/ar/vendor/jobs/ELB-26202", "/ar/vendor/profile", "/ar/vendor/rate-cards", "/ar/vendor/payouts"]) {
      await page.goto(p);
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      await expect(page.locator("main#main")).toHaveCount(1);
      await noHorizontalScroll(page);
    }
  });
});
