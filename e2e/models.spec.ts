import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import models from "./fixtures/models.json";
import { designerAllOptions } from "./fixtures/factory";

/**
 * Every model of the library (src/lib/library, manifest in e2e/fixtures/models.json): open it in
 * the designer, change the size, the board / label stock and one finish, then check that the
 * page logged no errors and the WebGL canvas is not blank (pixel sample), and save a screenshot
 * to docs/screenshots/models/<code>.png. Desktop only (software WebGL is slow).
 *
 * Saving is stubbed (the anonymous autosave would hit the per-IP write limit over 370 models);
 * everything else is the real app.
 */

const OUT = path.resolve("docs/screenshots/models");
fs.mkdirSync(OUT, { recursive: true });

test.describe.configure({ mode: "parallel" });
test.use({ viewport: { width: 1100, height: 760 } });

/** Share of canvas pixels that differ from the corner (background) colour. */
async function paintedShare(page: Page): Promise<number> {
  const canvas = page.getByTestId("stage-3d").locator("canvas").first();
  const png = await canvas.screenshot();
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    const [r0, g0, b0] = [data[0], data[1], data[2]];
    let painted = 0;
    let n = 0;
    for (let i = 0; i < data.length; i += 4 * 7) {
      n++;
      if (Math.abs(data[i] - r0) + Math.abs(data[i + 1] - g0) + Math.abs(data[i + 2] - b0) > 24) painted++;
    }
    return painted / n;
  }, png.toString("base64"));
}

/** Change the size: another common size, else nudge the first size field by about 5 %. */
async function changeSize(page: Page) {
  const presets = page.locator("fieldset", { has: page.getByText("Common sizes", { exact: true }) }).getByRole("button");
  const count = await presets.count();
  for (let i = 0; i < count; i++) {
    const b = presets.nth(i);
    if ((await b.getAttribute("aria-pressed")) !== "true") {
      await b.click();
      return;
    }
  }
  const field = page.locator("fieldset", { has: page.getByText("Size", { exact: true }) }).getByRole("spinbutton").first();
  const v = Number(await field.inputValue());
  const max = Number((await field.getAttribute("max")) ?? v);
  const min = Number((await field.getAttribute("min")) ?? v);
  const next = Math.max(min, Math.min(max, Math.round(v * 1.05) === v ? v + 1 : Math.round(v * 1.05)));
  await field.fill(String(next));
}

async function pickOther(page: Page, group: string, type: "radio" | "checkbox") {
  const inputs = page.getByTestId(`group-${group}`).getByRole(type);
  const n = await inputs.count();
  for (let i = 0; i < n; i++) {
    const el = inputs.nth(i);
    if ((await el.isEnabled()) && !(await el.isChecked())) {
      await el.check();
      return true;
    }
  }
  return false;
}

test.beforeEach(async ({ context }, info) => {
  test.skip(info.project.name !== "desktop", "desktop only");
  // Size fields, board and finishes are under "All options" (the designer opens in Basics).
  await designerAllOptions(context);
});

for (const m of models) {
  test(`model ${m.code} renders and configures`, async ({ page }) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.route("**/api/designs**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: `e2e-${m.slug}`, owned: false, updatedAt: new Date().toISOString() }) }),
    );

    await page.goto(`/en/design/${m.slug}`);
    await expect(page.getByTestId("stage-3d")).toHaveAttribute("data-model", m.code);
    await expect(page.getByTestId("stage-3d").locator("canvas").first()).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("model-name")).toBeVisible();

    await changeSize(page);
    await pickOther(page, "material", "radio");
    await pickOther(page, "finish", "checkbox");
    // Still the same model, and it still builds (no size error).
    await expect(page.getByTestId("stage-3d")).toHaveAttribute("data-model", m.code);
    await expect(page.getByRole("alert").filter({ hasText: "cannot be made" })).toHaveCount(0);

    await expect.poll(() => paintedShare(page), { timeout: 30_000, intervals: [500, 1000, 2000] }).toBeGreaterThan(0.01);
    await page.getByTestId("stage-3d").screenshot({ path: path.join(OUT, `${m.code}.png`) });
    expect(errors, errors.join("\n")).toEqual([]);
  });
}
