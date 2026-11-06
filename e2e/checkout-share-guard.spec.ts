import { expect, test } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { cleanup, cloneOrder, createUser, db, signInAs, track } from "./fixtures/factory";

/**
 * R4-B-01: ordering from a share link keeps the library model, so a quote-only model never turns
 * into an instant order, and the share fork cannot be forced with a tampered URL.
 * (The server-side guard in order creation is unit-tested in src/lib/orders/__tests__/order-guard.test.ts.)
 */
test.afterAll(cleanup);

async function asepticDesign(ownerId: string, shareToken: string | null) {
  const material = await db.material.findUniqueOrThrow({ where: { code: "SBS_350" } });
  return db.design.create({
    data: {
      ownerId,
      name: "E2E aseptic",
      structureCode: "ECMA_STE",
      modelCode: "LIQUID_ASEPTIC_BRICK",
      dims: { L: 63, W: 40, H: 165 },
      materialId: material.id,
      finishCode: "NONE",
      printSides: "OUTSIDE",
      artwork: { outside: { background: null, layers: [] }, inside: { background: null, layers: [] } },
      shareToken,
    },
  });
}

test("share-link deep link and tampered URLs never give an instant order for a quote-only model", async ({ page, baseURL }, info) => {
  test.skip(info.project.name !== "desktop", "server behaviour, one project is enough");
  test.setTimeout(90_000);
  const owner = track(await createUser({ name: "E2E R4-B-01 owner" }));
  const visitor = track(await createUser({ name: "E2E R4-B-01 visitor" }));
  const token = randomBytes(9).toString("base64url");
  const shared = await asepticDesign(owner.id, token);
  const privateOne = await asepticDesign(owner.id, null);
  await signInAs(page.context(), baseURL!, visitor.id);

  // Tampering: a wrong token, another design's id with this token, or no token at all: no copy, not found.
  for (const url of [`/en/checkout/${shared.id}?share=${token}x`, `/en/checkout/${privateOne.id}?share=${token}`, `/en/checkout/${shared.id}`]) {
    await page.goto(url);
    await expect(page.getByText("Design not found").first()).toBeVisible();
  }
  expect(await db.design.count({ where: { ownerId: visitor.id } })).toBe(0);

  // The real deep link: a copy that keeps the model, priced by quote (no tiers, no sample, no Continue).
  await page.goto(`/en/checkout/${shared.id}?share=${token}`);
  await expect(page).toHaveURL(/\/en\/checkout\/[\w-]+$/);
  const copyId = new URL(page.url()).pathname.split("/").pop()!;
  expect(copyId).not.toBe(shared.id);
  const copy = await db.design.findUniqueOrThrow({ where: { id: copyId } });
  expect(copy).toMatchObject({ ownerId: visitor.id, modelCode: "LIQUID_ASEPTIC_BRICK", structureCode: "ECMA_STE" });
  await expect(page.getByRole("button", { name: "Request a price" })).toBeVisible();
  await expect(page.getByText(/EGP [\d.,]+ per box/)).toHaveCount(0);
  await expect(page.getByRole("radio", { name: /Sample/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Continue" })).toHaveCount(0);

  // Opening the link again reuses the same copy.
  await page.goto(`/en/checkout/${shared.id}?share=${token}`);
  await expect(page).toHaveURL(new RegExp(`/en/checkout/${copyId}$`));
  expect(await db.design.count({ where: { ownerId: visitor.id } })).toBe(1);

  await db.design.deleteMany({ where: { ownerId: { in: [owner.id, visitor.id] } } });
});

test("unknown share links and orders, and other buyers' orders, answer a real 404", async ({ page, baseURL, request }) => {
  test.setTimeout(60_000);
  // Share link: unknown token, anonymous visitor.
  const s = await request.get("/en/s/no-such-token-123");
  expect(s.status()).toBe(404);
  const sAr = await request.get("/ar/s/no-such-token-123");
  expect(sAr.status()).toBe(404);

  const buyer = track(await createUser({ name: "E2E 404 buyer" }));
  const other = track(await createUser({ name: "E2E 404 other" }));
  const theirs = await cloneOrder("ELB-26001", { status: "IN_PRODUCTION", buyerId: other.id, label: "N" });
  const mine = await cloneOrder("ELB-26001", { status: "IN_PRODUCTION", buyerId: buyer.id, label: "N" });
  await signInAs(page.context(), baseURL!, buyer.id);

  for (const path of ["/en/orders/no-such-order", `/en/orders/${theirs.id}`, `/en/orders/${theirs.number}`, `/en/orders/${theirs.id}/invoice`]) {
    const r = await page.goto(path);
    expect(r?.status(), path).toBe(404);
  }
  // Same page for unknown and someone else's order: no way to tell which ids exist.
  await expect(page.getByRole("heading", { level: 1, name: "Orders" })).toBeVisible();
  const ok = await page.goto(`/en/orders/${mine.id}`);
  expect(ok?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(mine.number);
});
