import fs from "node:fs";
import path from "node:path";
import sharp, { type OverlayOptions } from "sharp";
import { expect, test } from "@playwright/test";
import models from "./fixtures/catalogue-models.json";

/**
 * Every catalogue model (src/data/catalogue, manifest e2e/fixtures/catalogue-models.json,
 * written by scripts/render-catalogue-thumbnails.ts): open the chrome-free 3D render route,
 * wait for the model to draw, check the WebGL stage is not blank and the page logged no
 * errors. Batched (one test per BATCH models) so 400+ models run in a few minutes at
 * --workers=2; each batch writes a labelled contact sheet to docs/screenshots/models/catalogue/.
 *
 *   npx playwright test e2e/catalogue-models.spec.ts --project=desktop --workers=2 --trace off
 */

const BATCH = 24;
const TILE = 180;
const COLS = 6;
const OUT = path.resolve("docs/screenshots/models/catalogue");
fs.mkdirSync(OUT, { recursive: true });

const IGNORED = [/Download the React DevTools/, /\[Fast Refresh\]/, /\[HMR\]/];

test.describe.configure({ mode: "parallel" });
test.use({ viewport: { width: 700, height: 700 } });

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop", "desktop only (software WebGL)");
});

/** Share of pixels the model covers on the transparent stage. */
async function painted(png: Buffer): Promise<number> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let n = 0;
  let total = 0;
  for (let i = 3; i < data.length; i += 4 * 5) {
    total++;
    if (data[i] > 16) n++;
  }
  void info;
  return n / total;
}

function esc(s: string) {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
}

async function contactSheet(file: string, tiles: { code: string; png: Buffer }[]) {
  const rows = Math.ceil(tiles.length / COLS);
  const H = TILE + 22;
  const composites: OverlayOptions[] = [];
  for (const [i, t] of tiles.entries()) {
    const x = (i % COLS) * TILE;
    const y = Math.floor(i / COLS) * H;
    composites.push({ input: await sharp(t.png).resize(TILE, TILE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(), left: x, top: y });
    composites.push({
      input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="22"><text x="${TILE / 2}" y="15" font-family="sans-serif" font-size="12" fill="#303030" text-anchor="middle">${esc(t.code)}</text></svg>`),
      left: x,
      top: y + TILE,
    });
  }
  await sharp({ create: { width: COLS * TILE, height: rows * H, channels: 3, background: "#f5f5f3" } })
    .composite(composites)
    .jpeg({ quality: 72 })
    .toFile(file);
}

const batches: (typeof models)[] = [];
for (let i = 0; i < models.length; i += BATCH) batches.push(models.slice(i, i + BATCH));

for (const [b, list] of batches.entries()) {
  const label = String(b + 1).padStart(2, "0");
  test(`catalogue models batch ${label}: ${list[0].code} … ${list[list.length - 1].code}`, async ({ page }) => {
    test.setTimeout(list.length * 45_000);
    const errors: string[] = [];
    let current = "";
    page.on("console", (m) => {
      if (m.type() === "error" && !IGNORED.some((r) => r.test(m.text()))) errors.push(`${current}: ${m.text()}`);
    });
    page.on("pageerror", (e) => errors.push(`${current}: ${e.message}`));
    page.on("response", (r) => {
      if (r.status() >= 400) errors.push(`${current}: HTTP ${r.status()} ${r.url()}`);
    });
    const tiles: { code: string; png: Buffer }[] = [];
    const blank: string[] = [];
    for (const m of list) {
      current = m.code;
      await page.goto(`/en/dev/catalogue/${encodeURIComponent(m.code)}`);
      const stage = page.getByTestId("catalogue-render");
      await expect(stage, m.code).toHaveAttribute("data-state", /ready|error/, { timeout: 60_000 });
      await expect(stage, `${m.code} failed to render`).toHaveAttribute("data-state", "ready");
      await expect(stage.locator("canvas").first()).toBeVisible();
      const png = await stage.screenshot({ omitBackground: true });
      const share = await painted(png);
      if (share < 0.01) blank.push(`${m.code} (${(share * 100).toFixed(2)} %)`);
      tiles.push({ code: m.code, png });
    }
    await contactSheet(path.join(OUT, `batch-${label}.jpg`), tiles);
    expect(blank, `blank WebGL: ${blank.join(", ")}`).toEqual([]);
    expect(errors, errors.join("\n")).toEqual([]);
  });
}
