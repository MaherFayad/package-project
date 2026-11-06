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
