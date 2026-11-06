import { expect, test } from "@playwright/test";
import { cleanup, cloneOrder, createUser, db, SEEDED, signInAs, signInPhone, track } from "./fixtures/factory";

/**
 * Checkout round 11 (R11-01): buyer order pages carry the buyer's address and phone, so printer
 * staff never see them (R5-SEC-01). The order's own printer lands on its job page, where its notes
 * are; anyone else gets the same 404 as an unknown order. The buyer never sees printer notes.
 */
test.afterAll(cleanup);

test("the printer is sent to its job page, keeps its notes, and the buyer never sees them", async ({ page, browser, baseURL }, info) => {
  test.skip(info.project.name !== "desktop", "one project is enough");
  const buyer = track(await createUser({ name: "E2E vendor-view buyer" }));
  const o = await cloneOrder("ELB-26001", { status: "IN_PRODUCTION", buyerId: buyer.id, label: "VV" });
  await db.productionEvent.create({ data: { orderId: o.id, type: "NOTE", note: "Glue arrives Sunday, call 0100 222 3333" } });

  const vc = await browser.newContext({ baseURL });
  await signInPhone(vc, baseURL!, SEEDED.nileStaff);
  const vp = await vc.newPage();
  await vp.goto(`/en/orders/${o.id}`);
  await expect(vp).toHaveURL(new RegExp(`/en/vendor/jobs/${o.number}$`));
  await expect(vp.getByText("Glue arrives Sunday, call 0100 222 3333")).toBeVisible();
  expect((await vc.request.get(`/en/orders/${o.id}/invoice`, { maxRedirects: 0 })).status()).toBe(307);
  await vc.close();

  // Another buyer: the same 404 as an unknown order.
  const other = track(await createUser({ name: "E2E vendor-view other" }));
  const oc = await browser.newContext({ baseURL });
  await signInAs(oc, baseURL!, other.id);
  expect((await oc.request.get(`/en/orders/${o.id}`)).status()).toBe(404);
  await oc.close();

  await signInAs(page.context(), baseURL!, buyer.id);
  await page.goto(`/en/orders/${o.id}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(o.number);
  await expect(page.getByText(/0100 222 3333/)).toHaveCount(0);
});
