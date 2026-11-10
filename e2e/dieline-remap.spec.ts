import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { designerAllOptions } from "./fixtures/factory";

/**
 * Dieline remap (designer: full artwork made on the buyer's own printer template). The owner's
 * outside dieline (2026-11-10) is uploaded on the mailer box: the box is recognised, the art is
 * re-composed on Elba's template, and applying the match switches the model and keeps the art.
 * Closed views go to docs/screenshots/audit/dieline-remap/ to compare by eye with
 * docs/owner-input/2026-11-10/mockup-closed-views.webp.
 */

const FILE = path.join(process.cwd(), "docs/owner-input/2026-11-10/dieline-outside-purple.webp");
const OUT = path.join(process.cwd(), "docs/screenshots/audit/dieline-remap");
const MAILERS = ["FS_BAKERY_BOX", "FEFCO_0421_1", "FEFCO_0421", "FEFCO_0421a", "FEFCO_0426a", "FEFCO_0427", "FEFCO_0427_1", "FEFCO_0428", "FEFCO_0429", "FEFCO_0429a", "FEFCO_0427_RETF"];

async function closedViews(page: Page, tag: string) {
  for (const v of ["front", "top", "left", "back"]) {
    await page.getByLabel("Panel", { exact: true }).selectOption(v);
    await page.mouse.move(2, 2);
    await page.waitForTimeout(1200);
    await page.getByTestId("stage-3d").locator("canvas").first().screenshot({ path: path.join(OUT, `e2e-${tag}-${v}.png`) });
  }
}

test("upload a printer's dieline: recognised, re-composed on the template, applied", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "the full artwork section is checked on desktop");
  test.setTimeout(240_000);
  await designerAllOptions(page.context());
  await page.goto("/en/design/mailer-box");
  await expect(page.getByTestId("stage-3d").locator("canvas").first()).toBeVisible({ timeout: 60_000 });
  await page.getByRole("tab", { name: "Artwork" }).click();
  await page.getByTestId("sheet-input-outside").setInputFiles(FILE);

  // Recognised: a hinged-lid mailer construction, with an estimated size and the one measurement.
  const card = page.getByTestId("sheet-recog");
  await expect(card).toHaveAttribute("data-mode", "model", { timeout: 90_000 });
  expect(MAILERS).toContain(await card.getAttribute("data-code"));
  await expect(card).toContainText("We recognised:");
  await expect(page.getByTestId("sheet-recog-measure")).toBeVisible();
  // No aspect-ratio warning for a re-composed sheet: it was arranged on this template.
  await expect(page.getByTestId("sheet-fit")).toHaveCount(0);
  await closedViews(page, "mailer");

  // One measurement fixes the size: a 26 cm lid.
  await page.getByTestId("sheet-recog-measure").fill("26");
  await expect(card).toContainText("26 ×");
  await page.getByTestId("sheet-recog-apply").getByRole("button").click();
  await expect(page).not.toHaveURL(/\/design\/mailer-box/, { timeout: 30_000 });
  await expect(page.getByTestId("stage-3d").locator("canvas").first()).toBeVisible({ timeout: 60_000 });

  // Saved with the original upload and how the sheet was made.
  await expect(page).toHaveURL(/[?&]d=[\w-]+/, { timeout: 30_000 });
  await expect(page.getByTestId("save-status")).toHaveAttribute("data-state", "saved", { timeout: 30_000 });
  await expect
    .poll(
      async () => {
        const id = new URL(page.url()).searchParams.get("d");
        const saved = await (await page.request.get(`/api/designs/${id}`)).json();
        const sheet = saved.doc.artwork.outside.sheetImage;
        // an empty target means the sheet still waits to be made again for the new model and size
        return `${!!sheet?.original}:${!!sheet?.remap?.target}:${saved.doc.dims.L}`;
      },
      { timeout: 30_000 },
    )
    .toMatch(/^true:true:2[56]\d$/);
  await page.waitForTimeout(1500);
  await closedViews(page, "applied");
});
