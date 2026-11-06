/**
 * Renders a REAL 3D thumbnail for every catalogue model (src/data/catalogue): opens the
 * chrome-free render route /en/dev/catalogue/<code> headless (Playwright, software WebGL),
 * waits for the model to draw, screenshots the transparent stage and writes
 * public/models/<code>.webp (480 × 480, alpha). Fails if a model errors or draws nothing,
 * so the catalogue never ships a blank placeholder.
 *
 *   npm run dev            # or build + start
 *   npx tsx scripts/render-catalogue-thumbnails.ts [--base http://localhost:3000] [--only CODE,CODE] [--missing]
 *
 * Also writes e2e/fixtures/catalogue-models.json (code, slug, render) for the per-model e2e.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";
import sharp from "sharp";
import { CATALOGUE } from "../src/data/catalogue";

const args = process.argv.slice(2);
const arg = (k: string) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : undefined;
};
const BASE = arg("--base") ?? process.env.BASE_URL ?? "http://localhost:3000";
const ONLY = arg("--only")?.split(",");
const MISSING = args.includes("--missing");
const WORKERS = Number(arg("--workers") ?? 2);
const OUT = path.resolve("public/models");
const SIZE = 480;

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(
  path.resolve("e2e/fixtures/catalogue-models.json"),
  JSON.stringify(
    CATALOGUE.map((e) => ({ code: e.code, slug: e.slug, render: e.render })),
    null,
    1,
  ) + "\n",
);

let todo = CATALOGUE.filter((e) => !ONLY || ONLY.includes(e.code));
if (MISSING) todo = todo.filter((e) => !fs.existsSync(path.join(OUT, `${e.code}.webp`)));

/** Share of pixels with any alpha (the model drawn on a transparent stage). */
async function coverage(png: Buffer): Promise<number> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let n = 0;
  for (let i = 3; i < data.length; i += 4 * 3) if (data[i] > 16) n++;
  return n / (info.width * info.height / 3);
}

async function renderOne(page: Page, code: string): Promise<string | null> {
  const errors: string[] = [];
  const onConsole = (m: { type(): string; text(): string }) => {
    if (m.type() === "error") errors.push(m.text());
  };
  page.on("console", onConsole);
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.goto(`${BASE}/en/dev/catalogue/${encodeURIComponent(code)}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    const stage = page.getByTestId("catalogue-render");
    await page.waitForSelector('[data-testid="catalogue-render"][data-state="ready"], [data-testid="catalogue-render"][data-state="error"]', { timeout: 120_000 });
    if ((await stage.getAttribute("data-state")) === "error") return `render error: ${await stage.innerText()}`;
    // A Next dev error overlay (compile / runtime error) must fail the model, never be captured.
    const overlay = await page.evaluate(() => !!document.querySelector("nextjs-portal")?.shadowRoot?.querySelector("[data-nextjs-dialog], [data-nextjs-toast-errors]"));
    if (overlay) return "Next.js error overlay on the page";
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    const png = await stage.screenshot({ omitBackground: true });
    const share = await coverage(png);
    if (share < 0.01) return `blank render (${(share * 100).toFixed(2)} % painted)`;
    // Trim to the model, pad to a square with a margin, then fit SIZE × SIZE.
    const trimmed = await sharp(png).trim({ threshold: 1 }).toBuffer({ resolveWithObject: true });
    const side = Math.round(Math.max(trimmed.info.width, trimmed.info.height) * 1.12);
    const padX = Math.floor((side - trimmed.info.width) / 2);
    const padY = Math.floor((side - trimmed.info.height) / 2);
    // sharp runs resize before extend inside one pipeline: pad first, then resize.
    const square = await sharp(trimmed.data)
      .extend({ top: padY, bottom: side - trimmed.info.height - padY, left: padX, right: side - trimmed.info.width - padX, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    await sharp(square).resize(SIZE, SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 80, alphaQuality: 90, effort: 5 }).toFile(path.join(OUT, `${code}.webp`));
    const real = errors.filter((e) => !/Download the React DevTools|\[Fast Refresh\]|THREE\.WebGLRenderer: Context Lost/.test(e));
    return real.length ? `console errors: ${real.slice(0, 3).join(" | ")}` : null;
  } finally {
    page.off("console", onConsole);
  }
}

(async () => {
  const browser = await chromium.launch();
  const failures: string[] = [];
  let done = 0;
  const queue = [...todo];
  await Promise.all(
    Array.from({ length: WORKERS }, async () => {
      const page = await browser.newPage({ viewport: { width: 700, height: 700 } });
      for (let e = queue.shift(); e; e = queue.shift()) {
        const err = await renderOne(page, e.code).catch((x: Error) => x.message);
        done++;
        if (err) failures.push(`${e.code}: ${err}`);
        process.stdout.write(`${done}/${todo.length} ${e.code}${err ? ` ✗ ${err}` : ""}\n`);
      }
      await page.close();
    }),
  );
  await browser.close();
  if (failures.length) {
    console.error(`\n${failures.length} failed:\n${failures.join("\n")}`);
    process.exitCode = 1;
  } else console.log(`wrote ${todo.length} thumbnails to ${OUT}`);
})();
