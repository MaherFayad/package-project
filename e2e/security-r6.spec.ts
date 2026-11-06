import { expect, test } from "@playwright/test";
import { cleanup, createUser, db, signInAs, track } from "./fixtures/factory";
import { designSpecHash } from "../src/lib/orders/quote-spec";

/**
 * Security review round 6 (docs/audit/security.md).
 * R6-SEC-01: a price the team sent is for the box as it was priced. Changing the size, board or
 * model afterwards voids it (before the fix, order ELB-26302 was placed for a 450 × 300 × 150 mm
 * box at the price sent for 150 × 100 × 50 mm). Artwork edits keep the price.
 * R6-SEC-02/03: admin detail routes answer a signed-out visitor the same for real and unknown
 * records, and never put a record's name in the title.
 */
test.afterAll(cleanup);

test("a sent price stops working once the box spec changes (R6-SEC-01)", async ({ page, baseURL }, info) => {
  test.skip(info.project.name !== "desktop", "one checkout is enough");
  test.setTimeout(120_000);
  const buyer = track(await createUser({ name: "E2E r6 quote buyer" }));
  const material = await db.material.findUniqueOrThrow({ where: { code: "E_FLUTE_KRAFT" } });
  const design = await db.design.create({
    data: {
      ownerId: buyer.id,
      name: "E2E r6 small run",
      structureCode: "FEFCO_0427",
      dims: { L: 150, W: 100, H: 50 },
      materialId: material.id,
      finishCode: "NONE",
      printSides: "OUTSIDE",
      artwork: { outside: { background: "#f4e9d8", layers: [] }, inside: { background: null, layers: [] } },
    },
  });
  await signInAs(page.context(), baseURL!, buyer.id);
  const cur = await (await page.request.get(`/api/designs/${design.id}`)).json();
  const vendor = await db.vendor.findFirstOrThrow({ where: { status: "ACTIVE" } });
  // Stored the way the admin "Send price" action stores it (PRODUCT line carries the fingerprint).
  const quote = await db.quote.create({
    data: {
      userId: buyer.id,
      designId: design.id,
      vendorId: vendor.id,
      lines: [{ kind: "PRODUCT", labelKey: "pricing.line.product", quantity: 3000, unitPiasters: 300, totalPiasters: 900_000, specHash: designSpecHash(cur.doc) }],
      subtotalPiasters: 900_000,
      vatPiasters: 126_000,
      totalPiasters: 1_026_000,
      validUntil: new Date(Date.now() + 48 * 3_600_000),
      status: "PRICED",
      pricedAt: new Date(),
      deliveryDays: 14,
      vendorCostPiasters: 700_000,
    },
  });
  await db.auditLog.create({ data: { actorId: buyer.id, action: "QUOTE_REQUEST", entityType: "QUOTE", entityId: quote.id, summary: "e2e r6", after: { governorate: "GIZA" } } });
  const link = `/en/checkout/${design.id}?quote=${quote.id}`;

  await page.goto(link);
  await expect(page.getByText("Your price for 3,000 boxes")).toBeVisible();

  // An artwork edit keeps the price.
  const art = { ...cur.doc, artwork: { ...cur.doc.artwork, outside: { ...cur.doc.artwork.outside, background: "#112233" } } };
  expect((await page.request.put(`/api/designs/${design.id}`, { data: { doc: art } })).status()).toBe(200);
  await page.goto(link);
  await expect(page.getByText("Your price for 3,000 boxes")).toBeVisible();

  // A box 27 times the volume at the same price is refused.
  expect((await page.request.put(`/api/designs/${design.id}`, { data: { doc: { ...art, dims: { L: 450, W: 300, H: 150 } } } })).status()).toBe(200);
  await page.goto(link);
  await expect(page.getByText("This price is no longer available")).toBeVisible();
  await expect(page.getByText("Your price for 3,000 boxes")).toHaveCount(0);
  expect(await db.order.count({ where: { buyerId: buyer.id } })).toBe(0);
  expect((await db.quote.findUniqueOrThrow({ where: { id: quote.id } })).status).toBe("PRICED");

  await db.auditLog.deleteMany({ where: { entityId: quote.id } });
  await db.quote.deleteMany({ where: { id: quote.id } });
});

test("admin detail routes do not tell a signed-out visitor which records exist (R6-SEC-02/03)", async ({ request }, info) => {
  test.skip(info.project.name !== "desktop", "HTTP only");
  const buyer = await db.user.findFirstOrThrow({ where: { phone: "+201000000002" } });
  const order = await db.order.findFirstOrThrow({ where: { buyerId: buyer.id }, select: { number: true } });
  const pairs: [string, string][] = [
    [`/en/admin/orders/${order.number}`, "/en/admin/orders/ELB-00000"],
    [`/en/admin/users/${buyer.id}`, "/en/admin/users/cnotarealuser000000000000"],
  ];
  const strip = (s: string, key: string) => s.split(key).join("KEY").replace(/"b":"[^"]+"/g, "").replace(/[A-Za-z0-9_-]{21,22}(?=["\]])/g, "ID");
  for (const [real, fake] of pairs) {
    for (const headers of [{}, { RSC: "1" }] as Record<string, string>[]) {
      const a = await request.get(real, { headers, maxRedirects: 0 });
      const b = await request.get(fake, { headers, maxRedirects: 0 });
      expect(a.status()).toBe(b.status());
      const ta = strip(await a.text(), real.split("/").pop()!);
      const tb = strip(await b.text(), fake.split("/").pop()!);
      expect(ta.includes("SkeletonPage")).toBe(tb.includes("SkeletonPage"));
      expect(Math.abs(ta.length - tb.length)).toBeLessThan(64);
      if (buyer.name) expect(ta).not.toContain(buyer.name);
    }
  }
});

test("admin pages stream no data to a signed-out visitor (R6-SEC-09)", async ({ request }, info) => {
  test.skip(info.project.name !== "desktop", "HTTP only");
  // Before the fix the 307 body of /en/admin/users carried every user's full phone number.
  for (const path of ["users", "orders", "privacy", "audit", "quotes", "payouts", "disputes", "vendors", "moderation", "pricing", "catalog", ""]) {
    for (const headers of [{}, { RSC: "1" }] as Record<string, string>[]) {
      const r = await request.get(`/en/admin/${path}`, { headers, maxRedirects: 0 });
      const body = await r.text();
      expect(body, path).not.toMatch(/\+2010000000\d\d/);
      expect(body, path).not.toContain("منى عادل");
    }
  }
});
