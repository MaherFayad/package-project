import { expect, test, type Page } from "@playwright/test";
import { cleanup, createUser, db, signInAs, track } from "./fixtures/factory";

/**
 * B-16 end to end: a model no Egyptian SME printer makes (aseptic brick carton, order mode
 * "preview") never offers "Order this box" — not in the designer top bar, export modal, share
 * page, the share-link copy at checkout (deep link), the checkout itself (no instant tiers, no
 * paid sample, no "Order 2,000 boxes now") nor the API. Desktop only: one designer session.
 */

async function dismissCookies(page: Page) {
  const ok = page.getByRole("button", { name: /^(OK|موافق)$/ });
  if (await ok.count()) await ok.first().click();
}

async function toolbarAction(page: Page, name: string) {
  const button = page.getByRole("toolbar").getByRole("button", { name, exact: true });
  if (await button.isVisible()) return button.click();
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name }).click();
}

test.afterAll(cleanup);

test("quote-only model: no 'Order this box' in designer, export, share, checkout or API", async ({ page, browser, baseURL }, info) => {
  test.skip(info.project.name !== "desktop", "one designer session is enough");
  test.setTimeout(150_000);
  const owner = track(await createUser({ name: "E2E B-16 owner" }));
  const visitor = track(await createUser({ name: "E2E B-16 visitor" }));
  await signInAs(page.context(), baseURL!, owner.id);

  // API: the model is priced by quote, whatever quantity.
  const api = await page.request.post("/api/quote", {
    data: { structureCode: "ECMA_STE", dims: { L: 63, W: 40, H: 165 }, materialCode: "SBS_350", printSides: "OUTSIDE", quantity: 500, model: { code: "LIQUID_ASEPTIC_BRICK" } },
  });
  const body = await api.json();
  expect(api.status()).toBe(200);
  expect(body).toMatchObject({ mode: "manual_quote", reason: "MODEL_BY_QUOTE", orderReason: "FILLING_LINE" });

  // Designer: top bar and export modal say "Request a quote".
  await page.goto("/en/design/aseptic-brick-carton");
  await dismissCookies(page);
  const toolbar = page.getByRole("toolbar");
  await expect(toolbar.getByRole("button", { name: "Request a price" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Order this box" })).toHaveCount(0);
  await toolbarAction(page, "Export");
  const exp = page.getByRole("dialog", { name: "Download a mockup" });
  await expect(exp.getByRole("button", { name: "Request a price" })).toBeVisible();
  await expect(exp.getByRole("button", { name: "Order this box" })).toHaveCount(0);
  await exp.getByRole("button", { name: "Cancel" }).click();

  // Share link.
  await toolbarAction(page, "Share");
  const share = page.getByRole("dialog", { name: "Share link" });
  const link = share.getByLabel("Link");
  await expect(link).toHaveValue(/\/en\/s\/[\w-]+$/, { timeout: 20_000 });
  const sharePath = new URL(await link.inputValue()).pathname;

  // Another buyer opens the share page: model name, "Request a quote", "Design your own" opens the same model.
  const ctx = await browser.newContext({ baseURL });
  await signInAs(ctx, baseURL!, visitor.id);
  const v = await ctx.newPage();
  await v.goto(sharePath);
  await dismissCookies(v);
  await expect(v.getByText("Aseptic brick carton").first()).toBeVisible();
  await expect(v.getByRole("link", { name: "Order this box" })).toHaveCount(0);
  await expect(v.getByRole("link", { name: "Design your own" })).toHaveAttribute("href", /\/en\/design\/aseptic-brick-carton/);
  await v.getByRole("link", { name: "Request a price" }).click();

  // Deep link: the visitor's copy keeps the model, so checkout is a quote request, not an order.
  await expect(v).toHaveURL(/\/en\/checkout\/[\w-]+$/, { timeout: 20_000 });
  const copyId = new URL(v.url()).pathname.split("/").pop()!;
  const copy = await db.design.findUnique({ where: { id: copyId }, select: { ownerId: true, modelCode: true } });
  expect(copy).toMatchObject({ ownerId: visitor.id, modelCode: "LIQUID_ASEPTIC_BRICK" });
  await expect(v.getByText("filling lines").first()).toBeVisible();
  await expect(v.getByText(/EGP [\d.,]+ per box/)).toHaveCount(0);
  await expect(v.getByRole("radio", { name: /Sample/ })).toHaveCount(0);
  await expect(v.getByRole("button", { name: /Order 2,000 boxes now/ })).toHaveCount(0);
  await expect(v.getByRole("button", { name: /Pay|Continue to delivery/ })).toHaveCount(0);

  // Request a price for 100 boxes (below the instant cap: allowed for a model priced by quote).
  await v.getByRole("button", { name: "Request a price" }).click();
  await expect(v.getByText(/Price request sent for 100 boxes/).first()).toBeVisible({ timeout: 20_000 });
  const q = await db.quote.findFirst({ where: { userId: visitor.id, designId: copyId, status: "REQUESTED" } });
  expect((q?.lines as { quantity: number }[])[0].quantity).toBe(100);

  await db.auditLog.deleteMany({ where: { actorId: { in: [owner.id, visitor.id] } } });
  await db.quote.deleteMany({ where: { userId: { in: [owner.id, visitor.id] } } });
  await db.design.deleteMany({ where: { ownerId: { in: [owner.id, visitor.id] } } });
  await ctx.close();
});

test("special-gluing model no printer lists: 'Request a quote' once the price says so (R6-05)", async ({ page, baseURL }, info) => {
  test.skip(info.project.name !== "desktop", "one designer session is enough");
  test.setTimeout(90_000);
  const owner = track(await createUser({ name: "E2E R6-05 owner" }));
  await signInAs(page.context(), baseURL!, owner.id);
  await page.goto("/en/design/fefco-0711-auto-bottom-rsc");
  await dismissCookies(page);
  await expect(page.getByTestId("price-badge")).toContainText(/on request/i, { timeout: 30_000 });
  await expect(page.getByRole("toolbar").getByRole("button", { name: "Request a price" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Order this box" })).toHaveCount(0);
  await toolbarAction(page, "Export");
  const exp = page.getByRole("dialog", { name: "Download a mockup" });
  await expect(exp.getByRole("button", { name: "Request a price" })).toBeVisible();
  await exp.getByRole("button", { name: "Cancel" }).click();
  await toolbarAction(page, "Share");
  const link = page.getByRole("dialog", { name: "Share link" }).getByLabel("Link");
  await expect(link).toHaveValue(/\/en\/s\/[\w-]+$/, { timeout: 20_000 });
  await page.goto(new URL(await link.inputValue()).pathname);
  await expect(page.getByRole("link", { name: "Request a price" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Order this box" })).toHaveCount(0);
  await expect(page.getByText(/special gluing/).first()).toBeVisible();
  await db.auditLog.deleteMany({ where: { actorId: owner.id } });
  await db.design.deleteMany({ where: { ownerId: owner.id } });
});
