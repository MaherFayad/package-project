import { expect, test } from "@playwright/test";
import { deflateSync } from "node:zlib";
import { cleanup, cloneOrder, createUser, db, SEEDED, signInAs, signInPhone, track } from "./fixtures/factory";

/**
 * Checkout round 9: "Report a problem" takes up to 5 photos (JPG/PNG/WebP, 10 MB), checked by
 * magic bytes through the upload pipeline; the buyer and admins can open them, the admin dispute
 * page shows them, nobody else can.
 */
test.afterAll(cleanup);

/** A valid 8x8 PNG. */
function png(): Buffer {
  const crc = (buf: Buffer) => {
    let c = ~0;
    for (const b of buf) {
      c ^= b;
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return ~c >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const t = Buffer.from(type);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(8, 0);
  ihdr.writeUInt32BE(8, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.alloc(8 * (1 + 8 * 3), 0x80);
  for (let y = 0; y < 8; y++) raw[y * 25] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

test("a buyer adds photos to a problem report and the admin sees them", async ({ page, browser, baseURL }, info) => {
  test.skip(info.project.name !== "desktop", "one project is enough");
  test.setTimeout(120_000);
  const buyer = track(await createUser({ name: "E2E photo buyer" }));
  const o = await cloneOrder("ELB-26001", { status: "DELIVERED", buyerId: buyer.id, label: "DP" });
  await db.order.update({ where: { id: o.id }, data: { deliveredAt: new Date() } });
  await signInAs(page.context(), baseURL!, buyer.id);

  await page.goto(`/en/orders/${o.id}`);
  await page.getByRole("button", { name: "Report a problem" }).click();
  await page.getByLabel("What went wrong?").selectOption("PRINT_DEFECT");
  await page.getByLabel("Describe the problem").fill("The logo on 40 boxes is smudged.");
  const picker = page.locator('input[type="file"]');
  await picker.setInputFiles([
    { name: "box-1.png", mimeType: "image/png", buffer: png() },
    { name: "box-2.png", mimeType: "image/png", buffer: png() },
    { name: "invoice.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 test") },
  ]);
  await expect(page.getByText("Use a JPG, PNG or WebP photo.")).toBeVisible();
  await expect(page.getByText("Added")).toHaveCount(2, { timeout: 20_000 });
  await page.getByRole("button", { name: "Remove invoice.pdf" }).click();
  await page.getByRole("button", { name: "Send report" }).click();
  await expect(page.getByText("We received your report and will reply within one working day.").or(page.getByText(/Open report/)).first()).toBeVisible({ timeout: 20_000 });

  const dispute = await db.dispute.findFirstOrThrow({ where: { orderId: o.id } });
  const keys = dispute.photos as string[];
  expect(keys).toHaveLength(2);
  expect(keys.every((k) => k.startsWith(`dispute/${o.id}/`))).toBe(true);

  // The buyer can open their photo; another buyer and the order's printer cannot.
  expect((await page.request.get(`/api/vendor/files/${keys[0]}`)).status()).toBe(200);
  const other = track(await createUser({ name: "E2E other" }));
  const oc = await browser.newContext({ baseURL });
  await signInAs(oc, baseURL!, other.id);
  expect((await oc.request.get(`/api/vendor/files/${keys[0]}`)).status()).toBe(404);
  await oc.close();
  const vc = await browser.newContext({ baseURL });
  await signInPhone(vc, baseURL!, SEEDED.nileStaff);
  expect((await vc.request.get(`/api/vendor/files/${keys[0]}`)).status()).toBe(404);
  // The vendor upload route never writes into the buyer scope.
  const forged = await vc.request.post("/api/vendor/uploads", { multipart: { scope: "dispute", file: { name: "x.png", mimeType: "image/png", buffer: png() } } });
  expect(forged.status()).toBe(400);
  await vc.close();

  // Admin dispute page: read-only gallery.
  const ac = await browser.newContext({ baseURL });
  await signInPhone(ac, baseURL!, SEEDED.admin);
  const admin = await ac.newPage();
  await admin.goto(`/en/admin/disputes/${dispute.id}`);
  const gallery = admin.getByTestId("dispute-buyer-photos");
  await expect(gallery.locator("img")).toHaveCount(2);
  await expect(admin.getByRole("heading", { name: "Buyer's photos (2)" })).toBeVisible();
  await ac.close();

  await db.dispute.deleteMany({ where: { orderId: o.id } });
});

test("round 10: HEIC gets a clear message, a camera photo with no type uploads, and a removed photo is deleted", async ({ page, baseURL }, info) => {
  test.skip(info.project.name !== "mobile", "the phone camera path");
  test.setTimeout(90_000);
  const buyer = track(await createUser({ name: "E2E photo buyer 10" }));
  const o = await cloneOrder("ELB-26001", { status: "DELIVERED", buyerId: buyer.id, label: "DQ" });
  await db.order.update({ where: { id: o.id }, data: { deliveredAt: new Date() } });
  await signInAs(page.context(), baseURL!, buyer.id);

  await page.goto(`/en/orders/${o.id}`);
  await page.getByRole("button", { name: "Report a problem" }).click();
  const picker = page.locator('input[type="file"]');
  await picker.setInputFiles([{ name: "IMG_0001.HEIC", mimeType: "image/heic", buffer: Buffer.from("....ftypheic") }]);
  await expect(page.getByText(/iPhone HEIC photos cannot be added/)).toBeVisible();

  // Some Android camera pickers hand over a file with an empty type: the server sniffs it.
  await picker.setInputFiles([{ name: "camera.png", mimeType: "", buffer: png() }]);
  await expect(page.getByText("Added", { exact: true })).toHaveCount(1, { timeout: 20_000 });

  const del = page.waitForResponse((r) => r.url().includes(`/api/orders/${o.id}/dispute-photos`) && r.request().method() === "DELETE");
  await page.getByRole("button", { name: "Remove camera.png" }).click();
  expect((await del).status()).toBe(200);
  await expect(page.getByText("Added", { exact: true })).toHaveCount(0);
});
