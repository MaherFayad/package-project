import { expect, test } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { SEEDED, cleanup, cloneOrder, createUser, db, signInAs, track } from "../fixtures/factory";
import { formatMoney } from "../../src/lib/format";
import { ONE_PX_PNG, ackCookies, localeOf, noSideScroll, tFor } from "./helpers";

/**
 * Journey 3 (docs/audit/journeys.md): a printer applies to join, ops verify and approve it, the
 * printer reviews its starter rate card and switches it on (R5-JR-01: before this round nothing
 * created a rate card, so an approved printer could never get a job), then receives a paid job,
 * accepts it, uploads QC photos, ops approve and book the courier, and the 40% advance is approved
 * and paid. The public profile of a printer with no reviews says "New", not 0.0 / 0% (R5-JR-05).
 */

const vendors: string[] = [];
test.afterAll(async () => {
  await cleanup();
  for (const id of vendors.splice(0)) {
    await db.vendorPortfolioItem.deleteMany({ where: { vendorId: id } }).catch(() => undefined);
    await db.vendorApplication.deleteMany({ where: { vendorId: id } }).catch(() => undefined);
    await db.user.updateMany({ where: { vendorId: id }, data: { vendorId: null } }).catch(() => undefined);
    await db.vendor.deleteMany({ where: { id } }).catch(() => undefined);
  }
});

test("J3 · printer: apply → approved → rate card on → job → QC → shipped → advance paid", async ({ page, browser, baseURL }, info) => {
  test.setTimeout(240_000);
  const locale = localeOf(info);
  const t = tFor(locale);
  await ackCookies(page.context(), baseURL!);
  const tag = randomBytes(3).toString("hex");
  const applicant = track(await createUser({ name: "Hany" }));
  await signInAs(page.context(), baseURL!, applicant.id);

  // 1. Application with papers and a sample photo (PDPL consent).
  await page.goto(`/${locale}/vendor/apply`);
  await page.getByLabel(t("vendorPortal.apply.nameAr")).fill(`مطبعة الهرم ${tag}`);
  await page.getByLabel(t("vendorPortal.apply.nameEn")).fill(`Haram Print ${tag}`);
  await page.getByLabel(t("vendorPortal.apply.legalName")).fill(`Haram Print ${tag} LLC`);
  await page.getByLabel(t("vendorPortal.apply.commercialRegisterNo")).fill("123456");
  await page.getByLabel(t("vendorPortal.apply.taxCardNo")).fill("987654321");
  await page.getByLabel(t("vendorPortal.apply.factoryAddress")).fill("Industrial zone 3, plot 12");
  await page.getByLabel(t("vendorPortal.apply.factoryCity")).selectOption("GIZA");
  await page.getByLabel(t("vendorPortal.apply.contactName")).fill("Hany");
  await page.getByRole("checkbox", { name: t("structures.FEFCO_0427") }).check();
  for (const kind of ["COMMERCIAL_REGISTER", "TAX_CARD", "SAMPLE"] as const) {
    const zone = page.getByRole("group", { name: t(`vendorPortal.apply.docKinds.${kind}`) });
    await zone.locator('input[type="file"]').setInputFiles({ name: `${kind.toLowerCase()}.png`, mimeType: "image/png", buffer: ONE_PX_PNG });
    await expect(page.getByText(`${kind.toLowerCase()}.png`, { exact: true })).toBeVisible({ timeout: 30_000 });
  }
  await page.getByRole("checkbox", { name: t("vendorPortal.apply.agreement") }).check();
  await page.getByRole("button", { name: t("vendorPortal.apply.submit") }).click();
  await expect(page.getByText(t("vendorPortal.apply.submittedTitle"))).toBeVisible({ timeout: 30_000 });
  await noSideScroll(page);
  const application = await db.vendorApplication.findFirstOrThrow({ where: { applicantId: applicant.id } });
  vendors.push(application.vendorId);

  // 2. Ops review: start, tick every check, approve.
  const admin = await db.user.findUniqueOrThrow({ where: { phone: SEEDED.admin } });
  const actx = await browser.newContext({ baseURL });
  await ackCookies(actx, baseURL!);
  await signInAs(actx, baseURL!, admin.id);
  const ap = await actx.newPage();
  await ap.goto(`/${locale}/admin/vendors/applications/${application.id}`);
  await ap.getByRole("button", { name: t("admin.application.decision.startReview") }).click();
  await expect.poll(async () => (await db.vendorApplication.findUniqueOrThrow({ where: { id: application.id } })).status, { timeout: 30_000 }).toBe("UNDER_REVIEW");
  for (const box of await ap.getByRole("group", { name: t("admin.application.checklist.title") }).getByRole("checkbox").all()) await box.check();
  await ap.getByRole("button", { name: t("admin.application.decision.approve") }).click();
  await expect.poll(async () => (await db.vendor.findUniqueOrThrow({ where: { id: application.vendorId } })).status, { timeout: 30_000 }).toBe("ACTIVE");

  // R5-JR-01: approval seeds PAUSED starter cards for the applied styles.
  const cards = await db.rateCard.findMany({ where: { vendorId: application.vendorId }, include: { material: true } });
  expect(cards.length).toBeGreaterThan(0);
  expect(cards.every((c) => !c.active)).toBe(true);
  const vendor = await db.vendor.findUniqueOrThrow({ where: { id: application.vendorId } });

  // R5-JR-05: a printer with no reviews is "New", not "0.0" and "0% on time".
  const pub = await browser.newPage();
  await pub.goto(`/${locale}/vendors/${vendor.slug}`);
  await expect(pub.getByRole("list", { name: t("store.vendor.statsTitle") })).toContainText(t("store.vendor.newBadge"));
  await expect(pub.getByRole("list", { name: t("store.vendor.statsTitle") })).not.toContainText("0.0");
  await pub.close();

  // 3. The printer reviews a starter card and switches on instant orders.
  const card = cards.find((c) => c.material.code === "E_FLUTE_WHITE") ?? cards[0]!;
  await page.goto(`/${locale}/vendor/rate-cards/${card.id}`);
  // R5-JR-18: a decimal comma is refused, not read as thousands ("600,50" was EGP 60,050).
  const setup = page.locator("#main").getByLabel(t("vendorPortal.rateCards.setup"));
  await setup.fill("600,50");
  await page.locator("#main").getByRole("button", { name: t("vendorPortal.common.save") }).click();
  await expect(page.getByText(t("vendorPortal.rateCards.errors.NOT_A_NUMBER")).first()).toBeVisible({ timeout: 30_000 });
  expect((await db.rateCard.findUniqueOrThrow({ where: { id: card.id } })).setupPiasters).toBe(card.setupPiasters);
  // The same amount the way each market types it: Arabic-Indic digits with «٫», or a dot.
  await setup.fill(locale === "ar" ? "٦٠٠٫٥٠" : "600.50");
  await page.getByRole("checkbox", { name: t("vendorPortal.rateCards.activeLabel") }).filter({ visible: true }).first().check();
  await page.locator("#main").getByRole("button", { name: t("vendorPortal.common.save") }).click();
  await expect.poll(async () => (await db.rateCard.findUniqueOrThrow({ where: { id: card.id } })).active, { timeout: 30_000 }).toBe(true);
  expect((await db.rateCard.findUniqueOrThrow({ where: { id: card.id } })).setupPiasters).toBe(60_050);

  // 4. A paid job for that style and board is routed to the new printer.
  const job = await cloneOrder("ELB-26202", { status: "PAID", label: "N" });
  await db.order.update({ where: { id: job.id }, data: { vendorId: vendor.id } });
  await page.goto(`/${locale}/vendor/jobs/${job.number}`);
  await expect(page.getByRole("heading", { level: 1, name: job.number })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: t("vendorPortal.job.actions.accept") }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: t("vendorPortal.job.actions.accept") }).click();
  await page.getByRole("button", { name: t("vendorPortal.job.actions.startProduction") }).first().click();
  await expect.poll(async () => (await db.order.findUniqueOrThrow({ where: { id: job.id } })).status, { timeout: 30_000 }).toBe("IN_PRODUCTION");
  const qc = page.locator("#qc");
  const photos = qc.getByRole("list", { name: t("vendorPortal.job.qcTitle") });
  await qc.locator('input[type="file"]').setInputFiles({ name: "sheet.png", mimeType: "image/png", buffer: ONE_PX_PNG });
  await expect(photos.getByRole("listitem")).toHaveCount(1, { timeout: 30_000 });
  await qc.getByLabel(t("vendorPortal.job.qcKind")).selectOption("PACKED_BUNDLE");
  await qc.locator('input[type="file"]').setInputFiles({ name: "bundle.png", mimeType: "image/png", buffer: ONE_PX_PNG });
  await expect(photos.getByRole("listitem")).toHaveCount(2, { timeout: 30_000 });
  await qc.getByRole("button", { name: t("vendorPortal.job.actions.submitQc") }).click();
  await expect.poll(async () => (await db.order.findUniqueOrThrow({ where: { id: job.id } })).status, { timeout: 30_000 }).toBe("QC_PENDING");

  // 5. Ops approve QC, book the courier, approve and pay the 40% advance.
  await ap.goto(`/${locale}/admin/orders/${job.number}`);
  await ap.getByRole("button", { name: t("admin.order.qc.approve") }).click();
  await ap.getByRole("button", { name: t("admin.order.ship.action") }).click();
  await expect.poll(async () => (await db.order.findUniqueOrThrow({ where: { id: job.id } })).status, { timeout: 30_000 }).toBe("SHIPPED");
  const advance = await db.payout.findFirstOrThrow({ where: { orderId: job.id, kind: "ADVANCE" } });
  const cost = (await db.order.findUniqueOrThrow({ where: { id: job.id } })).vendorCostPiasters;
  expect(advance.amountPiasters).toBe(Math.round(cost * 0.4));
  await ap.reload();
  const kind = t("admin.payouts.kinds.ADVANCE");
  await ap.getByRole("button", { name: `${t("admin.payouts.steps.APPROVE")}: ${job.number}, ${kind}` }).click();
  await expect.poll(async () => (await db.payout.findUniqueOrThrow({ where: { id: advance.id } })).status, { timeout: 30_000 }).toBe("APPROVED");
  await ap.getByRole("button", { name: `${t("admin.payouts.steps.PAY")}: ${job.number}, ${kind}` }).click();
  await ap.getByRole("dialog").getByRole("button", { name: t("admin.payouts.steps.PAY") }).click();
  await expect.poll(async () => (await db.payout.findUniqueOrThrow({ where: { id: advance.id } })).status, { timeout: 30_000 }).toBe("PAID");
  await actx.close();

  // 6. The printer sees the advance as paid, for the right amount.
  await page.goto(`/${locale}/vendor/payouts`);
  const row = page.getByRole("row").filter({ hasText: job.number }).filter({ hasText: t("vendorPortal.payouts.kinds.ADVANCE") });
  await expect(row).toContainText(formatMoney(advance.amountPiasters, locale, { alwaysDecimals: true }).replace(/\.00(?=\D*$)/, ""));
  await noSideScroll(page);
});
