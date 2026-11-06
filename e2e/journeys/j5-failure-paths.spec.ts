import { expect, test } from "@playwright/test";
import { SEEDED, cleanup, cloneOrder, createUser, db, signInAs, signInPhone, track, uniquePhone } from "../fixtures/factory";
import { ackCookies, checkoutToPayStep, designToPayStep, localeOf, payByCard, sendOtpIn, tFor, tr } from "./helpers";

/**
 * Journey 5 (docs/audit/journeys.md): what goes wrong, and that nothing is lost or charged twice.
 * Each case is its own test with its own users and orders (factory), English on desktop and
 * Arabic on the phone project.
 */

test.afterAll(cleanup);

test("J5 · OTP: wrong code, then too many tries kills the code", async ({ page, baseURL }, info) => {
  const locale = localeOf(info);
  const t = tFor(locale);
  await ackCookies(page.context(), baseURL!);
  await page.goto(`/${locale}/login`);
  const phone = await uniquePhone("11");
  const code = await sendOtpIn(page, phone.local, locale);
  const wrong = code === "000000" ? "111111" : "000000";
  const box = page.getByLabel(t("auth.codeLabel"));
  const terms = page.getByRole("checkbox", { name: t("auth.acceptTerms") });
  if (await terms.isVisible()) await terms.check();
  const verify = page.getByRole("button", { name: t("auth.verify") });
  await box.fill(wrong);
  await verify.click();
  await expect(page.getByRole("alert").filter({ hasText: t("auth.errors.INVALID_CODE") })).toBeVisible();
  for (let i = 0; i < 5; i++) {
    await box.fill(wrong);
    await verify.click();
  }
  await expect(page.getByRole("alert").filter({ hasText: t("auth.errors.TOO_MANY_ATTEMPTS") })).toBeVisible();
  // The right code no longer works either: the dead code cannot be brute-forced or replayed.
  await box.fill(code);
  await verify.click();
  await expect(page.getByRole("alert").filter({ hasText: t("auth.errors.TOO_MANY_ATTEMPTS") })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/${locale}/login`));
  expect(await db.session.count({ where: { user: { phone: phone.e164 } } })).toBe(0);
});

test("J5 · payment declined, then retried: one charge, order paid", async ({ page, baseURL }, info) => {
  test.setTimeout(180_000);
  const locale = localeOf(info);
  const t = tFor(locale);
  await ackCookies(page.context(), baseURL!);
  const buyer = track(await createUser());
  await signInAs(page.context(), baseURL!, buyer.id);
  const { orderId } = await designToPayStep(page, locale);
  await payByCard(page, locale, "4000 0000 0000 0002");
  await expect(page.getByText(t("buyer.declinedNewAttempt")).first()).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(new RegExp(`/checkout/pay/${orderId}`));
  // A refresh keeps the buyer on the payment step of the same order.
  await page.reload();
  await payByCard(page, locale);
  await expect(page).toHaveURL(new RegExp(`/${locale}/orders/${orderId}\\?paid=1`), { timeout: 30_000 });
  const payments = await db.payment.findMany({ where: { orderId } });
  expect(payments.filter((p) => p.status === "FAILED")).toHaveLength(1);
  expect(payments.filter((p) => p.status === "PAID")).toHaveLength(1);
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  expect(order.status).toBe("PAID");
  expect(payments.find((p) => p.status === "PAID")!.amountPiasters).toBe(order.totalPiasters);
  await db.order.delete({ where: { id: orderId } }).catch(() => undefined);
});

test("J5 · expired price: no pay button, a way back to a new price", async ({ page, baseURL }, info) => {
  test.setTimeout(180_000);
  const locale = localeOf(info);
  const t = tFor(locale);
  await ackCookies(page.context(), baseURL!);
  const buyer = track(await createUser());
  await signInAs(page.context(), baseURL!, buyer.id);
  const { designId, orderId } = await designToPayStep(page, locale);
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  await db.quote.update({ where: { id: order.quoteId! }, data: { validUntil: new Date(Date.now() - 60_000) } });
  await page.reload();
  await expect(page.getByText(t("payment.expired"))).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: t("checkout.actions.continue") })).toHaveCount(0);
  await page.getByRole("link", { name: t("payment.restart") }).or(page.getByRole("button", { name: t("payment.restart") })).first().click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/checkout/${designId}`), { timeout: 30_000 });
  expect((await db.payment.count({ where: { orderId } }))).toBe(0);
  // R5-JR-10: the new order supersedes the expired one; it does not stay "awaiting payment".
  const fresh = await checkoutToPayStep(page, locale);
  expect(fresh).not.toBe(orderId);
  const old = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { productionEvents: true } });
  expect(old.status).toBe("CANCELLED");
  expect(old.productionEvents.some((e) => e.type === "CANCELLED" && e.note?.startsWith("SUPERSEDED:"))).toBe(true);
  expect((await db.order.findUniqueOrThrow({ where: { id: fresh } })).status).toBe("PENDING_PAYMENT");
  for (const id of [orderId, fresh]) await db.order.delete({ where: { id } }).catch(() => undefined);
});

test("J5 · printer declines, admin sees it and moves the job to a capable printer", async ({ browser, baseURL }, info) => {
  test.setTimeout(180_000);
  const locale = localeOf(info);
  const t = tFor(locale);
  const job = await cloneOrder("ELB-26202", { status: "PAID", label: "D" });
  const vctx = await browser.newContext({ baseURL });
  await ackCookies(vctx, baseURL!);
  await signInPhone(vctx, baseURL!, SEEDED.nileStaff);
  const vp = await vctx.newPage();
  await vp.goto(`/${locale}/vendor/jobs/${job.number}`);
  await expect(vp.getByRole("heading", { level: 1, name: job.number })).toBeVisible({ timeout: 30_000 });
  await expect(vp.getByRole("button", { name: t("vendorPortal.job.actions.accept") }).first()).toBeVisible({ timeout: 30_000 });
  // Phones fold Decline into "More actions".
  const more = vp.getByRole("button", { name: t("vendorPortal.job.actions.more") });
  if (info.project.name === "mobile") {
    await more.click();
    await vp.getByRole("menuitem", { name: t("vendorPortal.job.actions.decline") }).click();
  } else await vp.getByRole("button", { name: t("vendorPortal.job.actions.decline") }).first().click();
  const dialog = vp.getByRole("dialog");
  await dialog.getByLabel(t("vendorPortal.job.declineReason")).selectOption({ index: 1 });
  await dialog.getByLabel(t("vendorPortal.job.declineDetail")).fill("Foil machine down this week");
  await dialog.getByRole("button", { name: t("vendorPortal.job.actions.decline") }).click();
  await expect.poll(async () => db.productionEvent.count({ where: { orderId: job.id, type: "VENDOR_DECLINED" } }), { timeout: 30_000 }).toBe(1);
  await vctx.close();

  const actx = await browser.newContext({ baseURL });
  await ackCookies(actx, baseURL!);
  await signInPhone(actx, baseURL!, SEEDED.admin);
  const ap = await actx.newPage();
  await ap.goto(`/${locale}/admin/orders/${job.number}`);
  const nile = await db.vendor.findUniqueOrThrow({ where: { id: job.vendorId } });
  // R5-JR-07: the banner says the vendor declined, not "waiting for it to accept".
  await expect(ap.getByText(t("admin.order.routing.declinedTitle", { vendor: locale === "ar" ? nile.nameAr : nile.nameEn }))).toBeVisible({ timeout: 30_000 });
  const card = ap.locator("#order-vendor");
  await card.getByRole("button", { name: t("admin.order.routing.change") }).click();
  const alex = await db.vendor.findUniqueOrThrow({ where: { slug: "alex-print-house" } });
  await card.getByLabel(t("admin.order.routing.newVendor")).selectOption(alex.id);
  await card.getByLabel(t("admin.common.reason")).fill("Nile declined: capacity");
  await card.getByRole("button", { name: t("admin.order.routing.submit") }).click();
  await expect.poll(async () => (await db.order.findUniqueOrThrow({ where: { id: job.id } })).vendorId, { timeout: 30_000 }).toBe(alex.id);
  // The banner is back to "waiting for Alex to accept".
  await expect(ap.getByText(t("admin.order.routing.awaitingTitle", { vendor: locale === "ar" ? alex.nameAr : alex.nameEn }))).toBeVisible({ timeout: 30_000 });
  await actx.close();
});

test("J5 · offline mid-design: work kept, saved when back online, survives a refresh", async ({ page, context, baseURL }, info) => {
  test.setTimeout(120_000);
  const locale = localeOf(info);
  const t = tFor(locale);
  await ackCookies(context, baseURL!);
  await page.goto(`/${locale}/design/mailer-box`);
  await expect(page.getByRole("application", { name: tr(locale, "3D preview of your box") })).toBeVisible({ timeout: 30_000 });
  const panel = page.getByRole("complementary", { name: tr(locale, "Designer panels") });
  await panel.getByRole("tab", { name: tr(locale, "Artwork") }).click();
  await panel.getByRole("button", { name: /#1f3d2b/ }).first().click();
  await expect(page).toHaveURL(/[?&]d=[\w-]+/, { timeout: 30_000 });
  const designId = new URL(page.url()).searchParams.get("d")!;
  const status = page.getByTestId("save-status");
  await expect(status).toHaveAttribute("data-state", "saved", { timeout: 30_000 });

  await context.setOffline(true);
  await panel.getByRole("button", { name: /#005bd3/ }).first().click();
  await expect(status).toContainText(t("designer.save.offline"), { timeout: 30_000 });
  await context.setOffline(false);
  await expect(status).toHaveAttribute("data-state", "saved", { timeout: 60_000 });
  await expect.poll(async () => JSON.stringify((await db.design.findUniqueOrThrow({ where: { id: designId } })).artwork), { timeout: 30_000 }).toContain("#005bd3");

  await page.reload();
  await expect(page.getByRole("application", { name: tr(locale, "3D preview of your box") })).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(new RegExp(`d=${designId}`));
  await db.design.delete({ where: { id: designId } }).catch(() => undefined);
});

test("J5 · two tabs on one design: the stale tab is stopped, nothing is overwritten (R5-JR-04)", async ({ context, baseURL }, info) => {
  test.setTimeout(150_000);
  const locale = localeOf(info);
  const t = tFor(locale);
  await ackCookies(context, baseURL!);
  const buyer = track(await createUser());
  await signInAs(context, baseURL!, buyer.id);
  const a = await context.newPage();
  await a.goto(`/${locale}/design/mailer-box`);
  await expect(a.getByRole("application", { name: tr(locale, "3D preview of your box") })).toBeVisible({ timeout: 30_000 });
  const panelA = a.getByRole("complementary", { name: tr(locale, "Designer panels") });
  await panelA.getByRole("tab", { name: tr(locale, "Artwork") }).click();
  await panelA.getByRole("button", { name: /#1f3d2b/ }).first().click();
  await expect(a).toHaveURL(/[?&]d=[\w-]+/, { timeout: 30_000 });
  const designId = new URL(a.url()).searchParams.get("d")!;
  await expect(a.getByTestId("save-status")).toHaveAttribute("data-state", "saved", { timeout: 30_000 });

  // Tab B opens the same design, then tab A saves a change.
  const b = await context.newPage();
  await b.goto(a.url());
  await expect(b.getByRole("application", { name: tr(locale, "3D preview of your box") })).toBeVisible({ timeout: 30_000 });
  await b.waitForTimeout(1500); // B reads the server stamp after load
  await panelA.getByRole("button", { name: /#c70a24/ }).first().click();
  await expect(a.getByTestId("save-status")).toHaveAttribute("data-state", "saved", { timeout: 30_000 });
  await expect.poll(async () => JSON.stringify((await db.design.findUniqueOrThrow({ where: { id: designId } })).artwork), { timeout: 30_000 }).toContain("#c70a24");

  // Tab B, still on the old copy, edits: it must not overwrite A's change.
  const panelB = b.getByRole("complementary", { name: tr(locale, "Designer panels") });
  await panelB.getByRole("tab", { name: tr(locale, "Artwork") }).click();
  await panelB.getByRole("button", { name: /#f2c14e/ }).first().click();
  await expect(b.getByTestId("save-status")).toHaveAttribute("data-state", "conflict", { timeout: 30_000 });
  await expect(b.getByTestId("save-status")).toContainText(t("designer.save.conflict"));
  const stored = JSON.stringify((await db.design.findUniqueOrThrow({ where: { id: designId } })).artwork);
  expect(stored).toContain("#c70a24");
  expect(stored).not.toContain("#f2c14e");
  // Reload brings B to the latest copy, and it saves again.
  await b.getByRole("button", { name: t("designer.save.reload") }).click();
  await expect(b.getByRole("application", { name: tr(locale, "3D preview of your box") })).toBeVisible({ timeout: 30_000 });
  await expect(b.getByTestId("save-status")).toHaveAttribute("data-state", "saved", { timeout: 30_000 });
  await db.design.delete({ where: { id: designId } }).catch(() => undefined);
});
