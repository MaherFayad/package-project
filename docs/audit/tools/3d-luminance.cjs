/**
 * R4-CR-10 check: on a closed box in the hero view, the vertical (front / side) faces must keep at
 * least 55 % of the top face's relative luminance, for any printed colour.
 * Probes three 11 × 11 px patches inside the model's silhouette (top face, left vertical face,
 * right vertical face), takes the median of each, converts sRGB → relative luminance (WCAG Y),
 * prints the ratios and saves the frame.
 *
 *   BASE=http://localhost:3100 node docs/audit/tools/3d-luminance.cjs /en/s/<token> out.png
 */
const { chromium } = require("playwright");

const base = process.env.BASE || "http://localhost:3100";
const [path, out = "/tmp/lum.png"] = process.argv.slice(2);
const lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const Y = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);

(async () => {
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  await page.goto(base + path, { waitUntil: "domcontentloaded" });
  await page.route("**/api/designs**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{\"id\":\"x\",\"owned\":false}" }));
  const canvas = page.locator("canvas").first();
  await canvas.waitFor({ state: "visible", timeout: 60000 });
  await page.waitForTimeout(5000);
  const png = await canvas.screenshot({ path: out, omitBackground: true });
  const res = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    const { data, width, height } = g.getImageData(0, 0, c.width, c.height);
    // the stage background (corner colour); the model is anything clearly different from it. The soft
    // shadow is a light grey close to it, so a high threshold keeps it out.
    const bg = [data[0], data[1], data[2]];
    const isModel = (x, y) => {
      const i = (y * width + x) * 4;
      return Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) > 90;
    };
    // silhouette bounds (ignore the soft shadow: it is close to the background colour)
    let x0 = width, x1 = 0, y0 = height, y1 = 0;
    for (let y = 0; y < height * 0.84; y += 2) for (let x = 0; x < width; x += 2) if (isModel(x, y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const w = x1 - x0, h = y1 - y0;
    const patch = (fx, fy) => {
      const cx = Math.round(x0 + fx * w), cy = Math.round(y0 + fy * h);
      const px = [];
      for (let y = cy - 5; y <= cy + 5; y++) for (let x = cx - 5; x <= cx + 5; x++) { const i = (y * width + x) * 4; px.push([data[i], data[i + 1], data[i + 2]]); }
      px.sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));
      return px[Math.floor(px.length / 2)];
    };
    // hero 3/4 view: top face across the upper third, front face lower left, side face lower right
    return { box: [x0, y0, w, h], top: patch(0.5, 0.2), front: patch(0.3, 0.72), side: patch(0.86, 0.62) };
  }, png.toString("base64"));
  const yt = Y(res.top), yf = Y(res.front), ys = Y(res.side);
  const hex = (c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
  console.log(JSON.stringify({ path, box: res.box, top: hex(res.top), front: hex(res.front), side: hex(res.side), frontRatio: +(yf / yt).toFixed(2), sideRatio: +(ys / yt).toFixed(2), pass: yf / yt >= 0.55 && ys / yt >= 0.55 }));
  await browser.close();
})();
