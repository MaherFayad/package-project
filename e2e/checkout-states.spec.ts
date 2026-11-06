import { expect, test } from "@playwright/test";
import { cleanup, cloneOrder, createUser, db, signInAs, track } from "./fixtures/factory";

/**
 * Order tracking states the main flow never reaches (round 7): a refunded order shows the money
 * returned (order page and receipt) and labels the closing event as a refund; free-text notes
 * written on events by the printer or staff never reach the buyer (B-08, R7-02).
 */
test.afterAll(cleanup);

test("refunded order shows the refund; event notes from the printer stay hidden", async ({ page, baseURL }, info) => {
  test.skip(info.project.name !== "desktop", "server-rendered states, one project is enough");
  const buyer = track(await createUser({ name: "E2E refund buyer" }));
  const o = await cloneOrder("ELB-26001", { status: "REFUNDED", buyerId: buyer.id, label: "RF" });
  await db.payment.updateMany({ where: { orderId: o.id }, data: { status: "REFUNDED" } });
  await db.productionEvent.createMany({
    data: [
      { orderId: o.id, type: "VENDOR_DECLINED", note: "Call me on 01001234567 instead", createdAt: new Date() },
      { orderId: o.id, type: "CANCELLED", note: "REFUNDED:duplicate order", createdAt: new Date() },
    ],
  });
  await signInAs(page.context(), baseURL!, buyer.id);

  await page.goto(`/en/orders/${o.id}`);
  const refundLine = page.getByText(/^Refunded · /);
  await expect(refundLine).toBeVisible();
  await expect(refundLine.locator("..")).toContainText("EGP 14,250.00");
  await expect(page.getByText("Order cancelled and refunded")).toBeVisible();
  await expect(page.getByText("01001234567")).toHaveCount(0);
  await expect(page.getByText("duplicate order")).toHaveCount(0);
  await expect(page.getByText(/orders\.detail\.events\./)).toHaveCount(0);

  // Receipt: a sale receipt plus its credit note, as a real refund leaves them.
  const tag = o.number.slice(-8);
  await db.invoice.create({ data: { orderId: o.id, kind: "SALE", number: `INV-E2E-${tag}`, subtotalPiasters: 1_250_000, vatPiasters: 175_000, totalPiasters: 1_425_000, issuedAt: new Date() } });
  await db.invoice.create({ data: { orderId: o.id, kind: "CREDIT_NOTE", number: `CN-E2E-${tag}`, subtotalPiasters: 1_250_000, vatPiasters: 175_000, totalPiasters: 1_425_000, issuedAt: new Date() } });
  await page.goto(`/en/orders/${o.id}/invoice`);
  await expect(page.getByText("This order was refunded")).toBeVisible();
  await expect(page.getByText(`Credit note CN-E2E-${tag}`)).toBeVisible();
});

test("a paid order is never offered for payment again: Back after paying, a second tab, an expired session", async ({ browser, baseURL }, info) => {
  test.skip(info.project.name !== "desktop", "one project is enough");
  test.setTimeout(120_000);
  const buyer = track(await createUser({ name: "E2E pay-state buyer" }));
  const o = await cloneOrder("ELB-26001", { status: "PENDING_PAYMENT", buyerId: buyer.id, label: "PS" });
  const ctx = await browser.newContext({ baseURL });
  await signInAs(ctx, baseURL!, buyer.id);
  const fawryTab = await ctx.newPage();
  const cardTab = await ctx.newPage();

  // Tab 1 opens a Fawry code; tab 2 pays by card.
  await fawryTab.goto(`/en/checkout/pay/${o.id}`);
  await fawryTab.getByRole("radio", { name: /Fawry reference code/ }).check();
  await fawryTab.getByRole("button", { name: "Continue" }).click();
  await expect(fawryTab.getByTestId("fawry-code")).toBeVisible();
  // The second tab resumes the open Fawry attempt; the buyer switches to card there.
  await cardTab.goto(`/en/checkout/pay/${o.id}`);
  await expect(cardTab.getByTestId("fawry-code")).toBeVisible();
  await cardTab.getByRole("button", { name: "Payment method" }).click();
  await cardTab.getByRole("radio", { name: /^Card/ }).check();
  await cardTab.getByRole("button", { name: "Continue" }).click();
  await cardTab.getByLabel("Card number").fill("4242 4242 4242 4242");
  await cardTab.getByLabel("Expiry (MM/YY)").fill("12/30");
  await cardTab.getByLabel("Security code").fill("123");
  await cardTab.getByRole("button", { name: /^Pay / }).click();
  await expect(cardTab).toHaveURL(/\?paid=1/, { timeout: 30_000 });

  // Back from the success page does not show the payment form again.
  await cardTab.goBack();
  await expect(cardTab).toHaveURL(new RegExp(`/en/orders/${o.id}$`), { timeout: 15_000 });

  // The Fawry tab: its attempt was voided; it moves to the order instead of "declined".
  await fawryTab.bringToFront();
  await fawryTab.getByRole("button", { name: /Simulate payment at outlet/ }).click();
  await expect(fawryTab).toHaveURL(new RegExp(`/en/orders/${o.id}$`), { timeout: 15_000 });
  await expect(fawryTab.getByText(/declined/)).toHaveCount(0);
  const paid = await db.payment.findMany({ where: { orderId: o.id, status: "PAID" } });
  expect(paid).toHaveLength(1);
  await ctx.close();

  // An expired session on the card form asks the buyer to sign in again, with a way back.
  const o2 = await cloneOrder("ELB-26001", { status: "PENDING_PAYMENT", buyerId: buyer.id, label: "PS" });
  const ctx2 = await browser.newContext({ baseURL });
  await signInAs(ctx2, baseURL!, buyer.id);
  const p = await ctx2.newPage();
  await p.goto(`/en/checkout/pay/${o2.id}`);
  await p.getByRole("button", { name: "Continue" }).click();
  await expect(p.getByLabel("Card number")).toBeVisible();
  await db.session.deleteMany({ where: { userId: buyer.id } });
  await p.getByLabel("Card number").fill("4242 4242 4242 4242");
  await p.getByLabel("Expiry (MM/YY)").fill("12/30");
  await p.getByLabel("Security code").fill("123");
  await p.getByRole("button", { name: /^Pay / }).click();
  await expect(p.getByText("Your session has ended")).toBeVisible();
  await expect(p.getByRole("link", { name: "Sign in" }).last()).toHaveAttribute("href", `/en/login?next=${encodeURIComponent(`/en/checkout/pay/${o2.id}`)}`);
  await ctx2.close();
});

test("browser Back and Forward move between checkout steps and keep the typed address", async ({ page, baseURL }, info) => {
  test.skip(info.project.name !== "mobile", "the phone case: hardware Back");
  test.setTimeout(90_000);
  const buyer = track(await createUser({ name: "E2E steps buyer" }));
  await signInAs(page.context(), baseURL!, buyer.id);
  const doc = {
    v: 1, name: "E2E steps", structureCode: "FEFCO_0427", dims: { L: 250, W: 180, H: 80 }, materialCode: "E_FLUTE_KRAFT", finishCode: "NONE", printSides: "OUTSIDE",
    artwork: { outside: { background: "#f4e9d8", layers: [] }, inside: { background: null, layers: [] } },
  };
  const { id } = (await (await page.request.post("/api/designs", { data: { doc } })).json()) as { id: string };
  await page.goto("/en/checkout");
  await page.goto(`/en/checkout/${id}`);
  await expect(page.getByTestId("vendor-offer").first()).toBeVisible();
  const bar = page.locator("[data-sticky-action]").getByRole("button", { name: "Continue" });
  await bar.click();
  await page.getByLabel("City or district").fill("Dokki");
  await page.getByLabel("Street address").fill("12 Tahrir St");
  await bar.click();
  await expect(page.getByRole("tab", { name: "3D proof" })).toBeVisible();
  await page.goBack();
  await expect(page.getByLabel("City or district")).toHaveValue("Dokki");
  await page.goForward();
  await expect(page.getByRole("tab", { name: "3D proof" })).toBeVisible();
  await page.goBack();
  await page.goBack();
  await expect(page.getByTestId("vendor-offer").first()).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/en/checkout/${id}$`));
  await db.design.deleteMany({ where: { ownerId: buyer.id } });
});
