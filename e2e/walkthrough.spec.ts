import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { SEEDED, db, signInAs } from "./fixtures/factory";
import { ONE_PX_PNG, ackCookies, ageShipments, sendOtpIn, tFor, rx } from "./journeys/helpers";
import { formatMoney } from "../src/lib/format";

/**
 * Walkthrough video, not a test of record: skipped unless WALK_OUT is set. Record with
 *   WALK_OUT=/path/out OTP_DEV_ECHO=1 ALLOW_MOCK_PAYMENTS=1 npx playwright test e2e/walkthrough.spec.ts --project=desktop --trace off
 * on a freshly seeded database, then join the clips (docs/screenshots/walkthrough/README.md). One happy path:
 * a brand uploads its printer's dieline, Elba recognises the box, the brand orders and pays;
 * the printer accepts, produces and sends QC photos; Elba ops approve and ship; the brand sees
 * the order delivered and opens the receipt. Captions are drawn into each page.
 */
const OUT = process.env.WALK_OUT ?? "walkthrough";
const VP = { width: 1280, height: 800 };
const DIELINE = path.resolve("docs/owner-input/2026-11-10/dieline-outside-purple.webp");
const locale = "en" as const;
const t = tFor(locale);
const pause = (p: Page, ms = 1400) => p.waitForTimeout(ms);

async function caption(p: Page, who: string, text: string) {
  await p
    .evaluate(
      ([who, text]) => {
        let el = document.getElementById("__walk");
        if (!el) {
          el = document.createElement("div");
          el.id = "__walk";
          el.setAttribute("aria-hidden", "true");
          el.style.cssText =
            "position:fixed;left:50%;transform:translateX(-50%);bottom:18px;z-index:2147483647;max-width:min(860px,92vw);padding:12px 18px;border-radius:14px;background:rgba(20,20,20,.88);color:#fff;font:600 17px/1.35 Inter,system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.25);pointer-events:none;display:flex;gap:10px;align-items:baseline";
          document.body.appendChild(el);
        }
        el.innerHTML = `<span style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#e8b77a;white-space:nowrap">${who}</span><span>${text}</span>`;
      },
      [who, text],
    )
    .catch(() => undefined);
}

async function titleCard(p: Page, kicker: string, title: string, sub: string, ms = 2600) {
  await p.setContent(
    `<html><body style="margin:0;height:100vh;display:grid;place-items:center;background:#16130f;color:#f5efe6;font-family:Inter,system-ui,sans-serif">
      <div style="text-align:center;max-width:820px;padding:24px">
        <div style="letter-spacing:.14em;text-transform:uppercase;color:#e8b77a;font-size:15px;margin-bottom:14px">${kicker}</div>
        <div style="font-size:46px;font-weight:700;line-height:1.1;margin-bottom:14px">${title}</div>
        <div style="font-size:20px;color:#cfc6b8">${sub}</div>
      </div></body></html>`,
  );
  await p.waitForTimeout(ms);
}

async function recorded(browser: import("@playwright/test").Browser, baseURL: string, name: string): Promise<BrowserContext> {
  const dir = path.join(OUT, ".raw", name);
  const ctx = await browser.newContext({ baseURL, viewport: VP, locale: "en-US", recordVideo: { dir, size: VP } });
  await ackCookies(ctx, baseURL);
  return ctx;
}

async function saveVideo(ctx: BrowserContext, p: Page, name: string) {
  const v = p.video();
  await ctx.close();
  if (v) fs.renameSync(await v.path(), path.join(OUT, `${name}.webm`));
}

test.use({ launchOptions: { slowMo: 90 } });

test("walkthrough video", async ({ browser, baseURL }, info) => {
  test.skip(!process.env.WALK_OUT || info.project.name !== "desktop", "recording only: set WALK_OUT, desktop project");
  test.setTimeout(900_000);
  fs.mkdirSync(OUT, { recursive: true });

  let orderId: string;
  if (process.env.WALK_RESUME !== "1") {
  // ── Part 1: the brand ─────────────────────────────────────────────
  const bctx = await recorded(browser, baseURL!, "1-buyer");
  await bctx.addInitScript(() => {
    try {
      localStorage.setItem("elba.designer.mode", "advanced");
    } catch {
      /* about:blank */
    }
  });
  const b = await bctx.newPage();
  await titleCard(b, "Elba walkthrough · 1 of 3", "A brand orders printed boxes", "From its printer's dieline to a paid order, in English on a laptop");

  await b.goto("/en");
  await caption(b, "Brand", "Home page: printed packaging for Egyptian brands, priced instantly.");
  await pause(b, 2600);
  await b.mouse.wheel(0, 700);
  await pause(b, 1600);
  await b.mouse.wheel(0, -700);

  await b.goto("/en/design/gift-box-tuck-front");
  const stage = b.getByTestId("stage-3d").locator("canvas").first();
  await expect(stage).toBeVisible({ timeout: 60_000 });
  await caption(b, "Brand", "The 3D designer opens on the box. Drag to turn it; every option shows on the model.");
  await pause(b, 2200);
  const box = (await stage.boundingBox())!;
  await b.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await b.mouse.down();
  await b.mouse.move(box.x + box.width / 2 + 220, box.y + box.height / 2 + 30, { steps: 30 });
  await b.mouse.up();
  await pause(b, 1200);

  await b.getByRole("tab", { name: "Artwork" }).click();
  await caption(b, "Brand", "Artwork → Full artwork: upload the file the brand's own printer made, die lines and all.");
  await pause(b, 1800);
  await b.getByTestId("sheet-input-outside").setInputFiles(DIELINE);
  const card = b.getByTestId("sheet-recog");
  await caption(b, "Brand", "Elba reads the cut and fold lines and finds the matching box…");
  await expect(card).toHaveAttribute("data-mode", "model", { timeout: 90_000 });
  await card.scrollIntoViewIfNeeded();
  await caption(b, "Brand", "Recognised: Gift box (tuck front). The art is rearranged face by face onto Elba's template.");
  await pause(b, 3200);
  const lid = b.getByTestId("sheet-recog-measure");
  if (await lid.waitFor({ timeout: 5000 }).then(() => true, () => false)) {
    await caption(b, "Brand", "The file has no print size, so one measurement sets it: the lid is 26 cm long.");
    await lid.fill("");
    await lid.pressSequentially("26", { delay: 180 });
    await pause(b, 1600);
  }
  await b.getByTestId("sheet-recog-apply").getByRole("button").click();
  await expect(b.getByText(/Box changed to/)).toBeVisible({ timeout: 30_000 });
  await caption(b, "Brand", "Applied. Every face of the closed box shows its own panel of the artwork.");
  await pause(b, 2600);
  for (const dx of [260, -520, 260]) {
    await b.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await b.mouse.down();
    await b.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 - 40, { steps: 18 });
    await b.mouse.up();
    await pause(b, 900);
  }
  const fold = b.getByRole("slider").first();
  if (await fold.isVisible().catch(() => false)) {
    await caption(b, "Brand", "The fold slider opens the box: the inside, the tuck and the flaps.");
    await fold.focus();
    for (let i = 0; i < 12; i++) await fold.press("ArrowLeft");
    await pause(b, 1800);
    for (let i = 0; i < 12; i++) await fold.press("ArrowRight");
    await pause(b, 1400);
  }
  await expect(b).toHaveURL(/[?&]d=[\w-]+/, { timeout: 30_000 });

  await caption(b, "Brand", "The price is live: per box, all-in, with the delivery date. Tap it for the breakdown.");
  await pause(b, 2000);
  await b.getByTestId("price-badge").click();
  const price = b.getByRole("dialog", { name: t("designer.price.heading") });
  await expect(price.getByText(t("designer.price.total"))).toBeVisible({ timeout: 30_000 });
  await pause(b, 2800);
  await price.getByRole("button", { name: t("designer.order.button") }).click();

  // Signed out: the order button asks for the mobile number first.
  const gate = b.getByRole("dialog", { name: "Your mobile number to continue" });
  if (await gate.isVisible({ timeout: 8000 }).catch(() => false)) {
    await caption(b, "Brand", "Sign-up is one mobile number and a 6-digit code (shown on screen in this demo).");
    const phone = "011" + String(Date.now()).slice(-8);
    const code = await sendOtpIn(gate, phone, locale);
    await pause(b, 1200);
    await gate.getByLabel("Verification code").pressSequentially(code, { delay: 120 });
    await pause(b, 900);
    await gate.getByRole("button", { name: "Verify and continue" }).click();
  }
  await expect(b).toHaveURL(/\/en\/checkout\/[\w-]+$/, { timeout: 60_000 });
  await expect(b.getByTestId("checkout-total")).toBeVisible({ timeout: 30_000 });
  await caption(b, "Brand", "Checkout: quantity, price per box, VAT 14% and the delivery date in one summary.");
  await pause(b, 2800);
  const summary = b.getByRole("complementary").filter({ hasText: t("buyer.easy.summaryTitle") });
  await summary.getByRole("button", { name: t("buyer.easy.actions.toAddress") }).click();

  await caption(b, "Brand", "Delivery address, then the proof: the brand approves exactly what will be printed. Elba flags a low-resolution file before printing.");
  await b.getByLabel(t("checkout.address.name")).pressSequentially("Mona Adel", { delay: 40 });
  await b.getByLabel(t("checkout.address.phone")).fill("01112345678");
  await b.getByLabel(t("checkout.address.governorate")).selectOption("Cairo");
  await b.getByLabel(t("checkout.address.city")).pressSequentially("Heliopolis", { delay: 40 });
  await b.getByLabel(t("checkout.address.street")).pressSequentially("14 Baghdad St", { delay: 40 });
  await expect(b.getByRole("tab", { name: t("checkout.proof.tab3d") })).toBeVisible({ timeout: 30_000 });
  await b.getByRole("tab", { name: t("checkout.proof.tab3d") }).scrollIntoViewIfNeeded();
  await pause(b, 2600);
  await b.getByRole("checkbox", { name: /I checked the design|I approve this proof/ }).check();
  await pause(b, 1000);
  await summary.getByRole("button", { name: t("buyer.easy.actions.toPay") }).click();

  await expect(b).toHaveURL(/\/en\/checkout\/pay\//, { timeout: 30_000 });
  orderId = b.url().split("/").pop()!;
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  const total = formatMoney(order.totalPiasters, locale);
  await caption(b, "Brand", `Payment: card, wallet, Fawry or InstaPay. Total ${total} (test card in this demo).`);
  await pause(b, 2400);
  await b.getByRole("button", { name: t("buyer.easy.pay.next"), exact: true }).click();
  await b.getByLabel(t("payment.card.number")).pressSequentially("4242 4242 4242 4242", { delay: 30 });
  await b.getByLabel(t("payment.card.expiry")).pressSequentially("12/30", { delay: 60 });
  await b.getByLabel(t("payment.card.cvc")).pressSequentially("123", { delay: 60 });
  await pause(b, 800);
  await b.getByRole("button", { name: rx(t("payment.pay", { amount: total })) }).click();
  await expect(b).toHaveURL(new RegExp(`/en/orders/${orderId}`), { timeout: 60_000 });
  await caption(b, "Brand", `Paid. Order ${order.number} is tracked here, step by step, until delivery.`);
  await pause(b, 3600);
  await saveVideo(bctx, b, "1-buyer");
  } else {
    orderId = (await db.order.findFirstOrThrow({ where: { status: "PAID" }, orderBy: { updatedAt: "desc" } })).id;
  }
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });

  // ── Part 2: the printer ───────────────────────────────────────────
  const paid = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { vendor: true } });
  const staff = await db.user.findFirstOrThrow({ where: { vendorId: paid.vendorId, role: "VENDOR" } });
  const vctx = await recorded(browser, baseURL!, "2-printer");
  const v = await vctx.newPage();
  await titleCard(v, "Elba walkthrough · 2 of 3", "The printer makes it", `${paid.vendor?.nameEn ?? "A vetted Cairo printer"} takes the job on the printer portal`);
  await v.goto("/en/login?next=%2Fen%2Fvendor");
  await caption(v, "Printer", "The printer signs in with the shop's mobile number.");
  const local = staff.phone.replace(/^\+20/, "0");
  const code = await sendOtpIn(v, local, locale);
  await v.getByLabel("Verification code").pressSequentially(code, { delay: 120 });
  await v.getByRole("button", { name: /Verify|Sign in/ }).first().click();
  await expect(v).toHaveURL(/\/en\/vendor/, { timeout: 60_000 });
  await caption(v, "Printer", "Dashboard: new paid jobs, due dates, and money to come.");
  await pause(v, 3000);
  await v.goto("/en/vendor/jobs");
  await caption(v, "Printer", "Jobs: every paid order waiting for this shop.");
  await pause(v, 2600);
  await v.goto(`/en/vendor/jobs/${order.number}`);
  await expect(v.getByRole("heading", { level: 1, name: order.number })).toBeVisible({ timeout: 30_000 });
  await caption(v, "Printer", "The job: box, size, board, quantity, the approved artwork and the printer's own price.");
  await pause(v, 2600);
  await v.mouse.wheel(0, 600);
  await pause(v, 2000);
  await v.mouse.wheel(0, -600);
  await caption(v, "Printer", "Accept. The print PDF and dieline unlock, and a 40% advance payment is raised.");
  await v.getByRole("button", { name: t("vendorPortal.job.actions.accept") }).first().click();
  await pause(v, 1200);
  await v.getByRole("dialog").getByRole("button", { name: t("vendorPortal.job.actions.accept") }).click();
  await pause(v, 2200);
  await caption(v, "Printer", "Start production when the press is ready.");
  await v.getByRole("button", { name: t("vendorPortal.job.actions.startProduction") }).first().click();
  await expect.poll(async () => (await db.order.findUniqueOrThrow({ where: { id: orderId } })).status, { timeout: 30_000 }).toBe("IN_PRODUCTION");
  await pause(v, 1800);
  const qc = v.locator("#qc");
  await qc.scrollIntoViewIfNeeded();
  await caption(v, "Printer", "Quality check: a photo of the first printed sheet and one of the packed boxes.");
  const sheetPng = await v.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 640;
    c.height = 480;
    const x = c.getContext("2d")!;
    x.fillStyle = "#4b2a7b";
    x.fillRect(0, 0, 640, 480);
    x.fillStyle = "#f4c84a";
    x.font = "bold 64px sans-serif";
    x.fillText("First sheet", 140, 260);
    return c.toDataURL("image/png").split(",")[1];
  });
  const inputs = qc.locator('input[type="file"]');
  await inputs.nth(0).setInputFiles({ name: "first-sheet.png", mimeType: "image/png", buffer: Buffer.from(sheetPng, "base64") });
  await pause(v, 2400);
  await inputs.nth(1).setInputFiles({ name: "packed.png", mimeType: "image/png", buffer: ONE_PX_PNG });
  await pause(v, 2400);
  await qc.getByRole("button", { name: t("vendorPortal.job.actions.submitQc") }).click();
  await expect.poll(async () => (await db.order.findUniqueOrThrow({ where: { id: orderId } })).status, { timeout: 30_000 }).toBe("QC_PENDING");
  await caption(v, "Printer", "Sent to Elba for the quality check. Payouts show the advance and the balance due on delivery.");
  await pause(v, 2400);
  await v.goto("/en/vendor/payouts");
  await pause(v, 3000);
  await saveVideo(vctx, v, "2-printer");

  // ── Part 3: Elba ops, then the brand again ───────────────────────────
  const admin = await db.user.findUniqueOrThrow({ where: { phone: SEEDED.admin } });
  const actx = await recorded(browser, baseURL!, "3-delivery");
  await signInAs(actx, baseURL!, admin.id);
  const a = await actx.newPage();
  await titleCard(a, "Elba walkthrough · 3 of 3", "Checked, shipped, delivered", "Elba ops approve the photos and book the courier; the brand gets its boxes");
  await a.goto(`/en/admin/orders/${order.number}`);
  await expect(a.getByRole("heading", { level: 1, name: order.number })).toBeVisible({ timeout: 30_000 });
  await caption(a, "Elba ops", "Ops review the printer's QC photos and approve.");
  await pause(a, 2400);
  await a.getByRole("button", { name: t("admin.order.qc.approve") }).click();
  await a.getByRole("dialog").getByRole("button", { name: t("admin.order.qc.approve") }).click();
  await pause(a, 1600);
  await caption(a, "Elba ops", "Book the courier (Bosta). The brand gets the tracking.");
  await a.getByRole("button", { name: t("admin.order.ship.action") }).click();
  await a.getByRole("dialog").getByRole("button", { name: t("admin.order.ship.action") }).click();
  await expect.poll(async () => (await db.order.findUniqueOrThrow({ where: { id: orderId } })).status, { timeout: 30_000 }).toBe("SHIPPED");
  await pause(a, 2000);
  await actx.close();

  // Mock courier: the shipment is a day old, so tracking reports it delivered.
  await ageShipments(orderId);
  const dctx = await recorded(browser, baseURL!, "4-delivered");
  await signInAs(dctx, baseURL!, order.buyerId);
  const d = await dctx.newPage();
  await d.goto(`/en/orders/${orderId}`);
  await expect.poll(async () => (await db.order.findUniqueOrThrow({ where: { id: orderId } })).status, { timeout: 30_000 }).toBe("DELIVERED");
  await d.reload();
  await caption(d, "Brand", "Delivered. The brand can review the printer, reorder, or open a dispute.");
  await pause(d, 3400);
  await d.goto(`/en/orders/${orderId}/invoice`);
  await caption(d, "Brand", "The receipt: the same totals and VAT as checkout.");
  await pause(d, 3200);
  await titleCard(d, "Elba", "Design it. Price it. Get it printed.", "elba-demo.maherfayad55.workers.dev", 3000);
  await saveVideo(dctx, d, "4-delivered");
  // The ops clip (3) was recorded by actx's own page: move it next to the others.
  const raw3 = path.join(OUT, ".raw", "3-delivery");
  for (const f of fs.existsSync(raw3) ? fs.readdirSync(raw3) : []) fs.renameSync(path.join(raw3, f), path.join(OUT, "3-ops.webm"));
});
