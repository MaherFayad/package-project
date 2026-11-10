import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { designerAllOptions } from "./fixtures/factory";

/**
 * Store bags (src/lib/dieline/families/bags): pick a bag in the model picker, change its size and
 * handle, upload a logo and get the instant price. Also writes the bag screenshots for
 * docs/audit/bags.md (docs/screenshots/audit/bags/). Desktop only (software WebGL is slow).
 */

const OUT = path.resolve("docs/screenshots/audit/bags");
fs.mkdirSync(OUT, { recursive: true });

test.use({ viewport: { width: 1280, height: 820 } });
test.beforeEach(async ({ context, page }, info) => {
  test.skip(info.project.name !== "desktop", "desktop only");
  await designerAllOptions(context);
  // Saving is stubbed: the anonymous autosave would hit the per-IP write limit across shots.
  await page.route("**/api/designs**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "e2e-bag", owned: false, updatedAt: new Date().toISOString() }) }));
});

async function logo(page: Page): Promise<Buffer> {
  const b64 = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 300;
    const x = c.getContext("2d")!;
    x.fillStyle = "#1f3d2b";
    x.beginPath();
    x.arc(150, 150, 140, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = "#f2c14e";
    x.font = "bold 90px sans-serif";
    x.textAlign = "center";
    x.fillText("ELBA", 150, 180);
    return c.toDataURL("image/png").split(",")[1];
  });
  return Buffer.from(b64, "base64");
}

const stageShot = (page: Page, name: string) => page.getByTestId("stage-3d").screenshot({ path: path.join(OUT, `${name}.png`) });

async function settle(page: Page) {
  await expect(page.getByTestId("stage-3d").locator("canvas").first()).toBeVisible({ timeout: 45_000 });
  await page.waitForTimeout(1200);
}

test("pick a bag, change size and handle, upload a logo, get a price", async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/en/design/mailer-box");
  const stage = page.getByTestId("stage-3d");
  await expect(stage.locator("canvas").first()).toBeVisible({ timeout: 45_000 });

  // 1. The picker has a Bags group with every store bag.
  const change = page.getByRole("button", { name: "Change box type" }).first();
  if (!(await change.isVisible())) await page.getByRole("button", { name: /Show more controls/ }).click();
  await change.click();
  const picker = page.getByTestId("catalogue-picker");
  await picker.getByRole("searchbox").fill("rope handle");
  await picker.getByRole("button", { name: /^All/ }).click();
  await picker.locator('[data-model="BAG_ROPE_ART"]').click();
  await expect(stage).toHaveAttribute("data-model", "BAG_ROPE_ART");
  await expect(page.getByLabel("Gusset")).toBeVisible();

  // 2. Size: the Large preset.
  await page.locator("fieldset", { has: page.getByText("Common sizes", { exact: true }) }).getByRole("button", { name: /Large/ }).first().click();
  await expect(page.getByLabel("Width", { exact: true })).toHaveValue("320");

  // 3. Handle: satin ribbon, then a colour.
  const handle = page.getByTestId("bag-handle");
  // The card is a <label> over a full-size transparent radio (options.module.css srOnly): check the radio.
  await handle.getByRole("radio", { name: /^Satin ribbon/ }).check();
  await expect(handle.getByRole("radio", { name: /Satin ribbon/ })).toBeChecked();
  const colour = page.getByTestId("bag-handle-color");
  await colour.getByRole("radio", { name: "Navy" }).check();
  await expect(colour.getByRole("radio", { name: "Navy" })).toBeChecked();

  // 4. Logo on the front.
  await page.getByRole("tab", { name: "Artwork" }).click();
  await page.getByRole("tabpanel", { name: "Artwork" }).locator("input[type=file]").first().setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: await logo(page) });
  await expect(page.getByRole("button", { name: "Crop", exact: true })).toBeVisible({ timeout: 15_000 });

  // 5. Instant price for 500 bags (laminated bags start at 300, so 500 is the first tier).
  await expect(page.getByTestId("price-badge")).toHaveText(/500 .+ EGP .+ delivered in \d+ days?/, { timeout: 30_000 });
  // Back to the 3D view (adding artwork switches the stage to the flat face editor).
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await settle(page);
  await stageShot(page, "designer-rope-art-large-satin-logo");
  expect(errors, errors.join("\n")).toEqual([]);
});

const MODELS: [string, string][] = [
  ["BAG_TWISTED_KRAFT", "kraft-bag-twisted-handle"],
  ["BAG_FLAT_KRAFT", "kraft-bag-flat-handle"],
  ["BAG_SOS", "sos-paper-bag"],
  ["BAG_ROPE_ART", "art-paper-bag-rope-handle"],
  ["BAG_GIFT_ART", "gift-bag-ribbon-handle"],
  ["BAG_DIECUT_PATCH", "die-cut-handle-bag"],
  ["BAG_BOTTLE", "bottle-bag-rope-handle"],
];

test("screenshots: every bag closed (standing open)", async ({ page }) => {
  test.setTimeout(400_000);
  for (const [code, slug] of MODELS) {
    await page.goto(`/en/design/${slug}`);
    await expect(page.getByTestId("stage-3d")).toHaveAttribute("data-model", code);
    await settle(page);
    await stageShot(page, `closed-${code}`);
  }
});

test("screenshots: three sizes and every handle type", async ({ page }) => {
  test.setTimeout(400_000);
  await page.goto("/en/design/kraft-bag-twisted-handle");
  await settle(page);
  const sizes = page.locator("fieldset", { has: page.getByText("Common sizes", { exact: true }) });
  for (const name of ["Extra small (jewellery)", "Medium", "Extra large"]) {
    await sizes.getByRole("button", { name: new RegExp(`^${name.replace(/[()]/g, "\\$&")}`) }).first().click();
    await settle(page);
    await stageShot(page, `size-twisted-${name === "Medium" ? "medium" : name.startsWith("Extra small") ? "xs" : "xl"}`);
  }
  // Handles: paper ones on the kraft bag, ropes and ribbons on the art bag, die-cut on its model.
  const shots: [string, string][] = [
    ["kraft-bag-twisted-handle", "Flat paper handle"],
    ["kraft-bag-twisted-handle", "Twisted paper handle"],
    ["art-paper-bag-rope-handle", "Cotton rope"],
    ["art-paper-bag-rope-handle", "PP rope"],
    ["art-paper-bag-rope-handle", "Satin ribbon"],
    ["art-paper-bag-rope-handle", "Grosgrain ribbon"],
  ];
  for (const [slug, label] of shots) {
    if (!page.url().includes(slug)) {
      await page.goto(`/en/design/${slug}`);
      await settle(page);
    }
    await page.getByTestId("bag-handle").getByRole("radio", { name: new RegExp(`^${label}`) }).check();
    await settle(page);
    await stageShot(page, `handle-${label.toLowerCase().replace(/ /g, "-")}`);
  }
});

test("the bags page lists every bag with a price or a quote", async ({ page }) => {
  await page.goto("/en/bags");
  await expect(page.getByRole("heading", { level: 1, name: "Printed paper bags for your shop" })).toBeVisible();
  for (const [code] of MODELS) await expect(page.locator(`[data-bag="${code}"]`)).toBeVisible();
  await expect(page.locator('[data-bag="BAG_TWISTED_KRAFT"]').getByTestId("bag-price")).toHaveText(/EGP .+ per bag/);
  await expect(page.locator('[data-bag="BAG_BOTTLE"]').getByTestId("bag-price")).toHaveText(/Price by quote/);
  await page.screenshot({ path: path.join(OUT, "bags-page-en.png"), fullPage: true });
  await page.goto("/ar/bags");
  await expect(page.getByRole("heading", { level: 1, name: "أكياس ورقية مطبوعة لمتجرك" })).toBeVisible();
  await page.screenshot({ path: path.join(OUT, "bags-page-ar.png"), fullPage: true });
});
