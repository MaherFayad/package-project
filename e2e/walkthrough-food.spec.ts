import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { SEEDED, db, signInAs } from "./fixtures/factory";
import { ONE_PX_PNG, ackCookies, ageShipments, sendOtpIn, tFor, tr, rx } from "./journeys/helpers";
import { formatMoney } from "../src/lib/format";

/**
 * Arabic walkthrough videos for food packaging (not a test of record: skipped unless WALK_OUT
 * and WALK_KIND are set). WALK_KIND=pizza (pizza-box) or sandwich (sandwich-wedge). A restaurant
 * designs its box with logo, colour and its name, gets the price, signs up, pays; the printer
 * accepts, prints and sends QC photos; ops approve and ship; the restaurant gets the receipt.
 * Clips go to WALK_OUT (1-buyer, 2-printer, 3-ops, 4-delivered). Captions are added in the edit.
 */
const OUT = process.env.WALK_OUT ?? "walkthrough-food";
const KIND = (process.env.WALK_KIND ?? "pizza") as "pizza" | "sandwich";
const VP = { width: 1280, height: 800 };
const locale = "ar" as const;
const t = tFor(locale);
const pause = (p: Page, ms = 1400) => p.waitForTimeout(ms);

const BRAND = {
  pizza: { slug: "pizza-box", name: "فورنو 24", sub: "بيتزا على الحطب", bg: "#c70a24", ink: "#f2c14e", logoBg: "#c70a24", logoInk: "#ffffff", text: "فورنو 24 · بيتزا على الحطب" },
  sandwich: { slug: "sandwich-wedge", name: "كلوب 7", sub: "ساندويتشات طازجة", bg: "#1f3d2b", ink: "#f2c14e", logoBg: "#1f3d2b", logoInk: "#f2c14e", text: "كلوب 7 · ساندويتشات طازجة" },
}[KIND];

async function recorded(browser: import("@playwright/test").Browser, baseURL: string, name: string): Promise<BrowserContext> {
  const ctx = await browser.newContext({ baseURL, viewport: VP, locale: "ar-EG", recordVideo: { dir: path.join(OUT, ".raw", name), size: VP } });
  await ackCookies(ctx, baseURL);
  return ctx;
}
async function saveVideo(ctx: BrowserContext, p: Page, name: string) {
  const v = p.video();
  await ctx.close();
  if (v) fs.renameSync(await v.path(), path.join(OUT, `${name}.webm`));
}

/** A round logo with the brand name, drawn in the page (Arabic shaping by the browser). */
async function logoPng(p: Page): Promise<Buffer> {
  const b64 = await p.evaluate((b) => {
    const c = document.createElement("canvas");
    c.width = c.height = 1200;
    const x = c.getContext("2d")!;
    x.fillStyle = b.logoBg;
    x.beginPath();
    x.arc(600, 600, 560, 0, Math.PI * 2);
    x.fill();
    x.strokeStyle = b.logoInk;
    x.lineWidth = 26;
    x.beginPath();
    x.arc(600, 600, 500, 0, Math.PI * 2);
    x.stroke();
    x.fillStyle = b.logoInk;
    x.textAlign = "center";
    x.direction = "rtl";
    x.font = "bold 230px 'IBM Plex Sans Arabic', sans-serif";
    x.fillText(b.name, 600, 640);
    x.font = "600 92px 'IBM Plex Sans Arabic', sans-serif";
    x.fillText(b.sub, 600, 800);
    return c.toDataURL("image/png").split(",")[1];
  }, BRAND);
  return Buffer.from(b64, "base64");
}

test.use({ launchOptions: { slowMo: 90 } });

test("food walkthrough video (Arabic)", async ({ browser, baseURL }, info) => {
  test.skip(!process.env.WALK_OUT || info.project.name !== "desktop", "recording only: set WALK_OUT and WALK_KIND, desktop project");
  test.setTimeout(900_000);
  fs.mkdirSync(OUT, { recursive: true });

  // ── Part 1: the restaurant ─────────────────────────────────────────
  const bctx = await recorded(browser, baseURL!, "1-buyer");
  await bctx.addInitScript(() => {
    try {
      localStorage.setItem("elba.designer.mode", "advanced");
    } catch {
      /* about:blank */
    }
  });
  const b = await bctx.newPage();
  await b.goto(`/ar/design/${BRAND.slug}`);
  const stage = b.getByTestId("stage-3d").locator("canvas").first();
  await expect(stage).toBeVisible({ timeout: 60_000 });
  await pause(b, 2600);
  const box = (await stage.boundingBox())!;
  const drag = async (dx: number, dy = 30) => {
    await b.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await b.mouse.down();
    await b.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 18 });
    await b.mouse.up();
    await pause(b, 700);
  };
  await drag(-220);

  const panel = b.getByRole("complementary", { name: tr(locale, "Designer panels") });
  await panel.getByRole("tab", { name: tr(locale, "Artwork") }).click();
  await pause(b, 1200);
  await panel.getByRole("button", { name: new RegExp(BRAND.bg) }).first().click();
  await pause(b, 1600);
  // Pizza: the logo on the lid, the name on the front edge. Sandwich: the logo on the window face.
  const faceSel = b.getByLabel(t("designer.artwork.face"));
  if (KIND === "pizza") {
    await faceSel.selectOption("top");
    await pause(b, 1200);
  }
  const logo = await logoPng(b);
  // Sandwich: the logo on both triangle sides (the long face carries the window).
  for (const f of KIND === "pizza" ? [null] : ["left", "right"]) {
    if (f) {
      await faceSel.selectOption(f);
      await pause(b, 1000);
    }
    const chooser = b.waitForEvent("filechooser");
    await panel.getByRole("button", { name: tr(locale, "Add image") }).first().click();
    await (await chooser).setFiles({ name: "logo.png", mimeType: "image/png", buffer: logo });
    await expect(panel.getByRole("region", { name: /Selected item|العنصر المحدد/ })).toBeVisible({ timeout: 30_000 });
    await pause(b, 2200);
  }
  if (KIND === "pizza") {
    await faceSel.selectOption("front");
    await pause(b, 1000);
    await panel.getByRole("button", { name: tr(locale, "Add text") }).click();
    const txt = panel.getByRole("textbox", { name: t("designer.layer.textValue"), exact: true });
    await txt.fill("");
    await txt.pressSequentially(BRAND.text, { delay: 60 });
    await pause(b, 1800);
    await faceSel.selectOption("top");
  }
  await b.getByRole("button", { name: t("designer.view.threeD") }).first().click();
  await pause(b, 1600);
  // The reference can hides the small wedge: switch it off from the bottom bar.
  if (KIND === "sandwich") {
    await b.getByTestId("toggle-reference-can").click();
    await pause(b, 1400);
  }
  await drag(260, -40);
  await drag(-260, 20);
  const fold = b.getByRole("slider").first();
  if (await fold.isVisible().catch(() => false)) {
    await fold.focus();
    for (let i = 0; i < 12; i++) await fold.press("ArrowLeft");
    await pause(b, 1600);
    for (let i = 0; i < 12; i++) await fold.press("ArrowRight");
    await pause(b, 1200);
  }
  await expect(b).toHaveURL(/[?&]d=[\w-]+/, { timeout: 30_000 });
  await pause(b, 1200);
  await b.getByTestId("price-badge").click();
  const price = b.getByRole("dialog", { name: t("designer.price.heading") });
  await expect(price.getByText(t("designer.price.total"))).toBeVisible({ timeout: 30_000 });
  await pause(b, 2800);
  await price.getByRole("button", { name: t("designer.order.button") }).click();

  const gate = b.getByRole("dialog", { name: tr(locale, "Your mobile number to continue") });
  if (await gate.isVisible({ timeout: 8000 }).catch(() => false)) {
    const phone = "012" + String(Date.now()).slice(-8);
    const code = await sendOtpIn(gate, phone, locale);
    await pause(b, 1000);
    await gate.getByLabel(tr(locale, "Verification code")).pressSequentially(code, { delay: 120 });
    await pause(b, 800);
    await gate.getByRole("button", { name: tr(locale, "Verify and continue") }).click();
  }
  await expect(b).toHaveURL(/\/ar\/checkout\/[\w-]+$/, { timeout: 60_000 });
  await expect(b.getByTestId("checkout-total")).toBeVisible({ timeout: 30_000 });
  await pause(b, 2600);
  const summary = b.getByRole("complementary").filter({ hasText: t("buyer.easy.summaryTitle") });
  await summary.getByRole("button", { name: t("buyer.easy.actions.toAddress") }).click();
  await b.getByLabel(t("checkout.address.name")).pressSequentially(KIND === "pizza" ? "كريم سامي" : "نور حسن", { delay: 50 });
  await b.getByLabel(t("checkout.address.phone")).fill("01112345678");
  await b.getByLabel(t("checkout.address.governorate")).selectOption("Cairo");
  await b.getByLabel(t("checkout.address.city")).pressSequentially("مدينة نصر", { delay: 50 });
  await b.getByLabel(t("checkout.address.street")).pressSequentially("12 شارع عباس العقاد", { delay: 40 });
  await expect(b.getByRole("tab", { name: t("checkout.proof.tab3d") })).toBeVisible({ timeout: 30_000 });
  await b.getByRole("tab", { name: t("checkout.proof.tab3d") }).scrollIntoViewIfNeeded();
  await pause(b, 2600);
  await b.getByRole("checkbox", { name: new RegExp(`${rx(tr(locale, "I checked the design. Print it as it is.")).source}|${rx(t("buyer.easy.proof.approve")).source}`) }).first().check();
  await pause(b, 1000);
  await summary.getByRole("button", { name: t("buyer.easy.actions.toPay") }).click();

  await expect(b).toHaveURL(/\/ar\/checkout\/pay\//, { timeout: 30_000 });
  const orderId = b.url().split("/").pop()!;
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  const total = formatMoney(order.totalPiasters, locale);
  await pause(b, 2200);
  await b.getByRole("button", { name: t("buyer.easy.pay.next"), exact: true }).click();
  await b.getByLabel(t("payment.card.number")).pressSequentially("4242 4242 4242 4242", { delay: 30 });
  await b.getByLabel(t("payment.card.expiry")).pressSequentially("12/30", { delay: 60 });
  await b.getByLabel(t("payment.card.cvc")).pressSequentially("123", { delay: 60 });
  await pause(b, 800);
  await b.getByRole("button", { name: rx(t("payment.pay", { amount: total })) }).click();
  await expect(b).toHaveURL(new RegExp(`/ar/orders/${orderId}`), { timeout: 60_000 });
  await pause(b, 3600);
  await saveVideo(bctx, b, "1-buyer");

  // ── Part 2: the printer ───────────────────────────────────────────
  const paid = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  const staff = await db.user.findFirstOrThrow({ where: { vendorId: paid.vendorId, role: "VENDOR" } });
  const vctx = await recorded(browser, baseURL!, "2-printer");
  const v = await vctx.newPage();
  await v.goto("/ar/login?next=%2Far%2Fvendor");
  const code = await sendOtpIn(v, staff.phone.replace(/^\+20/, "0"), locale);
  await v.getByLabel(tr(locale, "Verification code")).pressSequentially(code, { delay: 120 });
  await v.getByRole("button", { name: tr(locale, "Verify and continue") }).first().click();
  await expect(v).toHaveURL(/\/ar\/vendor/, { timeout: 60_000 });
  await pause(v, 3000);
  await v.goto(`/ar/vendor/jobs/${order.number}`);
  await expect(v.getByRole("heading", { level: 1, name: order.number })).toBeVisible({ timeout: 30_000 });
  await pause(v, 2600);
  await v.mouse.wheel(0, 600);
  await pause(v, 2000);
  await v.mouse.wheel(0, -600);
  await v.getByRole("button", { name: t("vendorPortal.job.actions.accept") }).first().click();
  await pause(v, 1200);
  await v.getByRole("dialog").getByRole("button", { name: t("vendorPortal.job.actions.accept") }).click();
  await pause(v, 2200);
  await v.getByRole("button", { name: t("vendorPortal.job.actions.startProduction") }).first().click();
  await expect.poll(async () => (await db.order.findUniqueOrThrow({ where: { id: orderId } })).status, { timeout: 30_000 }).toBe("IN_PRODUCTION");
  await pause(v, 1800);
  const qc = v.locator("#qc");
  await qc.scrollIntoViewIfNeeded();
  const sheet = await v.evaluate((bg) => {
    const c = document.createElement("canvas");
    c.width = 640;
    c.height = 480;
    const x = c.getContext("2d")!;
    x.fillStyle = bg;
    x.fillRect(0, 0, 640, 480);
    return c.toDataURL("image/png").split(",")[1];
  }, BRAND.bg);
  const inputs = qc.locator('input[type="file"]');
  await inputs.nth(0).setInputFiles({ name: "first-sheet.png", mimeType: "image/png", buffer: Buffer.from(sheet, "base64") });
  await pause(v, 2400);
  await inputs.nth(1).setInputFiles({ name: "packed.png", mimeType: "image/png", buffer: ONE_PX_PNG });
  await pause(v, 2400);
  await qc.getByRole("button", { name: t("vendorPortal.job.actions.submitQc") }).click();
  await expect.poll(async () => (await db.order.findUniqueOrThrow({ where: { id: orderId } })).status, { timeout: 30_000 }).toBe("QC_PENDING");
  await pause(v, 2400);
  await saveVideo(vctx, v, "2-printer");

  // ── Part 3: Elba ops, then the restaurant again ───────────────────────
  const admin = await db.user.findUniqueOrThrow({ where: { phone: SEEDED.admin } });
  const actx = await recorded(browser, baseURL!, "3-ops");
  await signInAs(actx, baseURL!, admin.id);
  const a = await actx.newPage();
  await a.goto(`/ar/admin/orders/${order.number}`);
  await expect(a.getByRole("heading", { level: 1, name: order.number })).toBeVisible({ timeout: 30_000 });
  await pause(a, 2400);
  await a.getByRole("button", { name: t("admin.order.qc.approve") }).click();
  await a.getByRole("dialog").getByRole("button", { name: t("admin.order.qc.approve") }).click();
  await pause(a, 1600);
  await a.getByRole("button", { name: t("admin.order.ship.action") }).click();
  await a.getByRole("dialog").getByRole("button", { name: t("admin.order.ship.action") }).click();
  await expect.poll(async () => (await db.order.findUniqueOrThrow({ where: { id: orderId } })).status, { timeout: 30_000 }).toBe("SHIPPED");
  await pause(a, 2000);
  await saveVideo(actx, a, "3-ops");

  await ageShipments(orderId);
  const dctx = await recorded(browser, baseURL!, "4-delivered");
  await signInAs(dctx, baseURL!, order.buyerId);
  const d = await dctx.newPage();
  await d.goto(`/ar/orders/${orderId}`);
  await expect.poll(async () => (await db.order.findUniqueOrThrow({ where: { id: orderId } })).status, { timeout: 30_000 }).toBe("DELIVERED");
  await d.reload();
  await pause(d, 3400);
  await d.goto(`/ar/orders/${orderId}/invoice`);
  await pause(d, 3200);
  await saveVideo(dctx, d, "4-delivered");
  fs.writeFileSync(path.join(OUT, "order.json"), JSON.stringify({ number: order.number, total, kind: KIND }));
});
