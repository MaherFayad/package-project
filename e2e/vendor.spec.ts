import { expect, test, type Page } from "@playwright/test";
import { SEEDED, cleanup, cloneOrder, createUser, db, signInAs, signInPhone, track } from "./fixtures/factory";

/**
 * Vendor portal. Parallel-safe: the mutating flow clones ELB-26201 (Delta Cartons, paid, awaiting
 * acceptance) into its own order and signs in as a fresh Delta staff account, so no other worker
 * or spec touches that job (e2e/fixtures/factory.ts). Read-only checks use the seeded accounts.
 */
const TEMPLATE_JOB = "ELB-26201";
const OTHER_VENDOR_JOB = "ELB-26001"; // Nile Pack's order

// 1x1 PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

const signIn = signInPhone;

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test.afterAll(async () => {
  await cleanup();
});

test.describe("vendor portal", () => {
  test("accept a job, start production, upload QC photos and submit for QC", async ({ page, context, baseURL }, info) => {
    test.skip(info.project.name !== "desktop", "mutating flow runs once (desktop)");
    test.setTimeout(120_000);
    // Its own job and its own Delta Cartons staff account.
    const job = await cloneOrder(TEMPLATE_JOB, { status: "PAID", label: "V" });
    const JOB = job.number;
    const staff = track(await createUser({ role: "VENDOR", vendorId: job.vendorId, name: "E2E Delta staff" }));
    await signInAs(context, baseURL!, staff.id);

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
    // The tab switch is a client navigation that re-renders the list; a click that lands on the
    // outgoing list is lost, so click until the job page opens (assertion unchanged).
    await expect(async () => {
      if (!page.url().includes(`/vendor/jobs/${JOB}`)) await page.getByRole("link", { name: JOB }).click({ timeout: 5_000 });
      await expect(page).toHaveURL(new RegExp(`/en/vendor/jobs/${JOB}$`), { timeout: 5_000 });
    }).toPass({ timeout: 30_000 });
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
    // QC photos go to the ops QC review (QcPhoto PENDING), never into portfolio moderation (B-08):
    // no VendorPortfolioItem is created and the job can be submitted right away.
    const staged = await db.order.findUniqueOrThrow({ where: { number: JOB }, include: { qcPhotos: true } });
    expect(staged.qcPhotos.map((p) => p.status)).toEqual(["PENDING", "PENDING"]);
    expect(await db.vendorPortfolioItem.count({ where: { imageUrl: { in: staged.qcPhotos.map((p) => p.url) } } })).toBe(0);
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
    await signIn(context, baseURL!, SEEDED.deltaStaff);
    await page.goto(`/en/vendor/jobs/${OTHER_VENDOR_JOB}`);
    // Scoped to <main>: while the response streams, Next keeps a hidden copy of the chunk outside it.
    await expect(page.locator("main").getByText("This job does not exist or is not routed to you.")).toBeVisible();
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
    const owner = await ctx(SEEDED.nileStaff); // Nile Pack staff
    const up = await owner.request.post("/api/vendor/uploads", { multipart: { scope: "portfolio", file: { name: "job.png", mimeType: "image/png", buffer: PNG } } });
    expect(up.ok()).toBe(true);
    const { url, item } = (await up.json()) as { url: string; item: { id: string; status: string } };
    expect(item.status).toBe("PENDING");
    try {
      const anon = await ctx();
      const otherVendor = await ctx(SEEDED.deltaStaff);
      const buyer = await ctx(SEEDED.buyer);
      const admin = await ctx(SEEDED.admin);
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
    await signIn(context, baseURL!, SEEDED.buyer);
    await page.goto("/en/vendor");
    await expect(page).toHaveURL(/\/en\?denied=1$/);
    // …but can open the vendor application.
    await page.goto("/en/vendor/apply");
    await expect(page.getByRole("heading", { level: 1, name: "Become an Elba print vendor" })).toBeVisible();
  });

  test("Arabic portal is RTL and fits a phone screen", async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!, SEEDED.nileStaff);
    for (const p of ["/ar/vendor", "/ar/vendor/jobs", "/ar/vendor/jobs/ELB-26202", "/ar/vendor/profile", "/ar/vendor/rate-cards", "/ar/vendor/payouts"]) {
      await page.goto(p);
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      await expect(page.locator("main#main")).toHaveCount(1);
      await noHorizontalScroll(page);
    }
  });
});

test.describe("vendor portal, round 4", () => {
  test("special gluing: a listed model gets an instant price from the printer that lists it", async ({ page, context, baseURL }, info) => {
    test.skip(info.project.name !== "desktop", "mutates Nile Pack's capabilities (desktop only, restored after)");
    test.setTimeout(90_000);
    const vendor = await db.vendor.findUniqueOrThrow({ where: { slug: "nile-pack" } });
    const before = vendor.capabilities;
    try {
      const staff = track(await createUser({ role: "VENDOR", vendorId: vendor.id, name: "E2E Nile staff" }));
      await signInAs(context, baseURL!, staff.id);
      const quote = () =>
        page.request.post("/api/quote", {
          data: { structureCode: "FEFCO_0201", model: { code: "FEFCO_0711" }, dims: { L: 300, W: 200, H: 150 }, materialCode: "E_FLUTE_KRAFT", quantity: 500, colours: 1, printSides: "OUTSIDE" },
        });
      const q0 = await (await quote()).json();
      expect(q0.offers?.some((o: { vendorId: string }) => o.vendorId === vendor.id) ?? false).toBe(false);

      await page.goto("/en/vendor/profile");
      const card = page.locator("#special-gluing");
      await expect(card.getByRole("heading", { name: "Special gluing models" })).toBeVisible();
      // A model whose base style is off cannot be ticked.
      await expect(card.getByRole("checkbox", { name: "Tuck top, crash-lock (auto) bottom" })).toBeDisabled();
      const box = card.getByRole("checkbox", { name: "Auto-bottom shipping case" });
      await box.uncheck();
      await box.check();
      await page.locator("#vendor-profile-form button[type=submit]").click();
      await expect(page.getByText("Saved").first()).toBeVisible();
      await expect.poll(async () => ((await db.vendor.findUniqueOrThrow({ where: { id: vendor.id } })).capabilities as { models?: string[] }).models ?? []).toContain("FEFCO_0711");

      const q1 = await (await quote()).json();
      expect(q1.mode).toBe("instant");
      expect(q1.offers.some((o: { vendorId: string }) => o.vendorId === vendor.id)).toBe(true);
    } finally {
      await db.vendor.update({ where: { id: vendor.id }, data: { capabilities: before as object } });
    }
  });

  test("vendor notes and unreviewed QC photos never reach the buyer", async ({ page, context, baseURL, browser }, info) => {
    test.skip(info.project.name !== "desktop", "mutating flow runs once (desktop)");
    test.setTimeout(90_000);
    const job = await cloneOrder(TEMPLATE_JOB, { status: "IN_PRODUCTION", label: "N" });
    const staff = track(await createUser({ role: "VENDOR", vendorId: job.vendorId, name: "E2E Delta staff" }));
    await signInAs(context, baseURL!, staff.id);
    await page.goto(`/en/vendor/jobs/${job.number}`);
    await page.getByLabel("Note to the Elba team").fill("Call me on 01001234567 NOTE-R4");
    await page.getByRole("button", { name: "Post" }).click();
    await expect(page.getByText("NOTE-R4")).toBeVisible();
    const up = await (await page.request.post("/api/vendor/uploads", { multipart: { scope: "qc", orderId: job.id, kind: "OTHER", file: { name: "x.png", mimeType: "image/png", buffer: PNG } } })).json();
    expect(up.ok).toBe(true);

    const order = await db.order.findUniqueOrThrow({ where: { id: job.id } });
    const buyerCtx = await browser.newContext();
    try {
      await signInAs(buyerCtx, baseURL!, order.buyerId);
      const buyer = await buyerCtx.newPage();
      await buyer.goto(`/en/orders/${job.number}`);
      await expect(buyer.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await buyer.content()).not.toContain("NOTE-R4");
      expect(await buyer.content()).not.toContain(up.url);
      expect((await buyer.request.get(up.url)).status()).toBe(404);
      await db.qcPhoto.updateMany({ where: { url: up.url }, data: { status: "APPROVED" } });
      expect((await buyer.request.get(up.url)).status()).toBe(200);
    } finally {
      await buyerCtx.close();
    }
  });
});

test.describe("vendor portal, round 5", () => {
  test("bio changes wait for Elba's review; contact details in a bio are blocked", async ({ page, context, baseURL }, info) => {
    test.skip(info.project.name !== "desktop", "mutates Nile Pack's bio (desktop only, restored after)");
    test.setTimeout(90_000);
    const vendor = await db.vendor.findUniqueOrThrow({ where: { slug: "nile-pack" } });
    try {
      const staff = track(await createUser({ role: "VENDOR", vendorId: vendor.id, name: "E2E Nile staff" }));
      await signInAs(context, baseURL!, staff.id);
      await page.goto("/en/vendor/profile");
      const en = page.getByLabel("Bio in English");
      await en.fill(`${vendor.bioEn} Sales: 010 1234 / 5678. Follow us on انستقرام nilepack. Or nilepack[.]com`);
      await page.locator("#vendor-profile-form button[type=submit]").click();
      await expect(en).toHaveAttribute("aria-invalid", "true");

      await en.fill(`${vendor.bioEn} BIO-R5`);
      await page.locator("#vendor-profile-form button[type=submit]").click();
      await expect(page.getByText("Your bio changes were sent for review.")).toBeVisible();
      await expect(page.getByText("Your bio changes are waiting for review.")).toBeVisible();
      // R7: the home page says so too, and links to the profile.
      await page.goto("/en/vendor");
      await expect(page.getByText("Your bio changes are waiting for review.")).toBeVisible();
      await expect(page.getByRole("link", { name: "View profile" })).toHaveAttribute("href", "/en/vendor/profile");
      const v = await db.vendor.findUniqueOrThrow({ where: { id: vendor.id } });
      expect(v.bioReviewStatus).toBe("PENDING");
      expect(v.bioEn).toBe(vendor.bioEn);
      await page.goto(`/en/vendors/${vendor.slug}`);
      expect(await page.content()).not.toContain("BIO-R5");
    } finally {
      await db.vendor.update({ where: { id: vendor.id }, data: { bioAr: vendor.bioAr, bioEn: vendor.bioEn, bioArPending: null, bioEnPending: null, bioReviewStatus: null, bioReviewNote: null, bioSubmittedAt: null } });
    }
  });
});
