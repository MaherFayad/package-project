import { expect, test, type Page } from "@playwright/test";
import { createUser, designerAllOptions, sendOtp, signInAs, track, uniquePhone, verifyNewAccount } from "./fixtures/factory";

/**
 * Designer main flow (seeded DB): pick a product preset, design anonymously (autosaved to the
 * server under the anonymous cookie), pass the preflight, see the instant price with no account
 * (R1-01), hit the soft gate from Share, sign up with phone + OTP, share a read-only link and export a PNG.
 *
 * New visitors get the Basics panel (logo, text, colour, size); the first test below covers it.
 * Tests of the full editor (tabs, millimetres, finishes, layers, print check) open it with
 * "All options" remembered (`designerAllOptions`, docs/audit/simplicity-2026-11/designer.md).
 */

/** A 300 × 300 PNG logo, drawn in the page. */
async function logo(page: Page): Promise<Buffer> {
  const b64 = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 300;
    const x = c.getContext("2d")!;
    x.fillStyle = "#c8964f";
    x.beginPath();
    x.arc(150, 150, 140, 0, Math.PI * 2);
    x.fill();
    return c.toDataURL("image/png").split(",")[1];
  });
  return Buffer.from(b64, "base64");
}

test("Basics (the default): logo and a name go on the 3D box; All options is remembered", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/en/design/mailer-box");
  const stage = page.getByTestId("stage-3d");
  await expect(stage.locator("canvas").first()).toBeVisible({ timeout: 45_000 });
  // Phones: the panel is a bottom sheet that starts closed.
  const expand = page.getByRole("button", { name: "Show more controls" });
  if (await expand.isVisible()) await expand.click();
  await expect(page.getByRole("button", { name: "Basics", exact: true })).toHaveAttribute("aria-pressed", "true");
  // No printer tabs and no face editor for a first-time visitor: the rail shows Logo, Colours, Size, More
  // (designer-restyle.md); the bottom dock has 3D / Laid flat / dimensions.
  await expect(page.getByRole("tab", { name: "Artwork" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Face", exact: true })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Logo", exact: true })).toHaveAttribute("aria-selected", "true");
  const basics = page.getByTestId("simple-panel");

  // Logo: one tap + the file; the editor stays on the 3D box (no jump to the flat face editor).
  const chooser = page.waitForEvent("filechooser");
  await basics.getByRole("button", { name: "Add your logo" }).click();
  await (await chooser).setFiles({ name: "logo.png", mimeType: "image/png", buffer: await logo(page) });
  await expect(basics.getByRole("button", { name: "Add another picture" })).toBeVisible({ timeout: 30_000 });
  await expect(stage).toBeVisible();
  // Image fit: a transparent logo starts as "Fit whole image" (Fill / Fit is its only placing control).
  await expect(basics.getByTestId("image-place")).toHaveAttribute("data-place", "fit");
  await expect(basics.getByRole("button", { name: "Fit whole image" })).toHaveAttribute("aria-pressed", "true");
  // The new logo is selected: one tap copies it onto every other side (not the bottom).
  await basics.getByRole("button", { name: "Put it on every side" }).click();
  await expect(basics.getByRole("button", { name: /^Image · / })).toHaveCount(5);

  // A name: one tap, the text field is focused, typed text goes under the logo on the same side.
  await basics.getByRole("button", { name: "Add a name or text" }).click();
  const field = basics.getByRole("textbox", { name: "Text", exact: true });
  await expect(field).toBeFocused();
  await field.fill("Nour Bakery");
  await expect(stage).toBeVisible();
  await expect(page).toHaveURL(/[?&]d=[\w-]+/, { timeout: 20_000 });
  await expect(page.getByTestId("save-status")).toHaveAttribute("data-state", "saved", { timeout: 20_000 });
  const saved = await (await page.request.get(`/api/designs/${new URL(page.url()).searchParams.get("d")}`)).json();
  const layers = saved.doc.artwork.outside.layers as { kind: string; face: string; text?: string; place?: string }[];
  const image = layers.find((l) => l.kind === "image");
  const text = layers.find((l) => l.kind === "text");
  expect(image).toBeTruthy();
  expect(layers.filter((l) => l.kind === "image")).toHaveLength(5);
  expect(layers.filter((l) => l.kind === "image").every((l) => l.place === "fit")).toBe(true);
  expect(text?.text).toBe("Nour Bakery");
  expect(text?.face).toBe(image?.face);

  // "All options" opens the full editor and is remembered on this device.
  await page.getByRole("button", { name: "All options", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Artwork" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("tab", { name: "Artwork" })).toBeVisible({ timeout: 45_000 });
});

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

/** All options on desktop shows Export / Share / Save as buttons; phones fold them into "More actions", Basics into "Save and share". */
async function toolbarAction(page: Page, name: string, more: string | RegExp = /^(More actions|Save and share)$/) {
  const button = page.getByRole("toolbar").getByRole("button", { name, exact: true });
  if (await button.isVisible()) return button.click();
  await page.getByRole("button", { name: more }).click();
  await page.getByRole("menuitem", { name }).click();
}

test("design a box, see the price signed out, sign up at the share gate, share and export", async ({ page }) => {
  test.setTimeout(120_000);
  await designerAllOptions(page.context());

  // 1. Picker → product preset.
  await page.goto("/en/design");
  await expect(page.getByRole("heading", { level: 1, name: "Design your box in 3D. Free." })).toBeVisible();
  await noHorizontalScroll(page);
  await page.getByRole("link", { name: /Mailer for a T-shirt/ }).click();
  await expect(page).toHaveURL(/\/en\/design\/mailer-box\?preset=tshirt/);

  // 2. Box panel shows the preset size; the 3D viewer is there and keyboard focusable.
  await expect(page.getByLabel("Length")).toHaveValue("300");
  await expect(page.getByRole("application", { name: "3D preview of your box" })).toBeVisible();
  await noHorizontalScroll(page);

  // 3. Artwork: background colour + text, edited with single-pointer controls (no dragging).
  await page.getByRole("tab", { name: "Artwork" }).click();
  await page.getByRole("button", { name: "Colour #1f3d2b" }).first().click();
  await page.getByRole("button", { name: "Add text" }).click();
  await expect(page.getByRole("group", { name: "Artwork editor for the Front panel" })).toBeVisible();
  await page.getByRole("button", { name: "Move right 1 mm" }).click();
  await page.getByRole("button", { name: "Undo" }).click();
  await page.getByRole("button", { name: "Redo" }).click();

  // 4. Text description of every panel + the print check.
  await page.getByRole("tab", { name: "Layers" }).click();
  await expect(page.getByRole("button", { name: /Text “Elba|Text “Your brand/ })).toBeVisible();
  await page.getByRole("tab", { name: /check/i }).click();
  await expect(page.getByRole("tabpanel").getByText("Ready to print")).toBeVisible();

  // 5. Anonymous autosave to the server puts the design id in the URL.
  await expect(page).toHaveURL(/[?&]d=[\w-]+/, { timeout: 15_000 });

  // 6. R1-01: the live price is public: the badge and the price sheet show it with no account.
  await expect(page.getByTestId("price-badge")).toHaveText(/500 boxes: .+ per box, all-in excl\. VAT · delivered in \d+ days?/, { timeout: 20_000 });
  await page.getByTestId("price-badge").click();
  const price = page.getByRole("dialog", { name: "Instant price" });
  await expect(price).toBeVisible({ timeout: 20_000 });
  await expect(price.getByText("Total with VAT")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("dialog", { name: "Your mobile number to continue" })).toHaveCount(0);
  await price.getByRole("button", { name: "Close" }).first().click();

  // 7. Share → soft gate (phone + OTP, marketing consent unchecked) → read-only page with "Order this box".
  await toolbarAction(page, "Share");
  const gate = page.getByRole("dialog", { name: "Your mobile number to continue" });
  await expect(gate).toBeVisible();
  // Unique per test and worker (OTP limits are per phone): e2e/fixtures/factory.ts.
  const code = await sendOtp(gate, (await uniquePhone("11")).local);
  // New phone: terms (and the unticked marketing box) appear after the first Verify (SIM-12).
  await verifyNewAccount(gate, code);
  const share = page.getByRole("dialog", { name: "Share link" });
  const link = share.getByLabel("Link");
  await expect(link).toHaveValue(/\/en\/s\/[\w-]+$/, { timeout: 20_000 });
  const shareUrl = await link.inputValue();
  await share.getByRole("button", { name: "Close" }).first().click();

  // 8. PNG export (standard size) downloads a file.
  await toolbarAction(page, "Export");
  const exp = page.getByRole("dialog", { name: "Export your design" });
  // Images and print / 3D files in one dialog (the print-ready PDF is offered here now).
  await expect(exp.getByRole("radio", { name: "Print-ready PDF" })).toBeVisible();
  await exp.getByLabel(/Standard PNG/).check();
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 30_000 }), exp.getByRole("button", { name: "Download" }).click()]);
  expect(download.suggestedFilename()).toMatch(/\.png$/);
  // Signing in (claims the draft), sharing and exporting all save: none of them may look like
  // "changed in another tab" (one tab, one device).
  await expect(page.getByText("This design changed in another tab or on another device")).toHaveCount(0);

  await page.goto(new URL(shareUrl).pathname);
  await expect(page.getByText("Shared box design")).toBeVisible();
  await expect(page.getByRole("link", { name: "Order this box" })).toHaveAttribute("href", /\/en\/checkout\/[\w-]+/);
  await noHorizontalScroll(page);
});

test("Arabic editor is RTL, keeps the 3D view unmirrored and gates saving", async ({ page }) => {
  await designerAllOptions(page.context());
  await page.goto("/ar/design/pizza-box?preset=pizza-30");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("application")).toHaveAttribute("dir", "ltr");
  await expect(page.getByLabel("الطول")).toHaveValue("310");
  await noHorizontalScroll(page);
  await toolbarAction(page, "حفظ", "إجراءات أخرى");
  await expect(page.getByRole("dialog", { name: "رقم محمولك للمتابعة" })).toBeVisible();
});

test("unknown structure is a 404", async ({ page }) => {
  const res = await page.goto("/en/design/no-such-box");
  expect(res?.status()).toBe(404);
});

/** React hydration failures (#418 text/HTML mismatch, #423 recoverable root error, #425 text) and their dev wording. */
const HYDRATION = /Minified React error #(418|419|423|425)|Hydration failed|hydrat(ed|ion) .*(mismatch|didn't match)|server rendered (HTML|text) didn't match/i;

test("designer pages hydrate without errors (box, container, start page, ar + en)", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`${page.url()}: ${String(e)}`));
  page.on("console", (m) => {
    if (m.type() === "error" && HYDRATION.test(m.text())) errors.push(`${page.url()}: ${m.text()}`);
  });
  // Saves are stubbed: this test is about the first render only.
  await page.route("**/api/designs**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "e2e-hydration", owned: false, updatedAt: new Date().toISOString() }) }));
  const urls = ["/en/design", "/ar/design", "/en/design/fefco-0436", "/en/design/aerosol-can", "/ar/design/mailer-box?preset=tshirt", "/ar/design/stand-up-pouch"];
  for (let round = 0; round < 2; round++) {
    for (const url of urls) {
      await page.goto(url);
      await expect(page.locator("main")).toBeVisible();
      if (url.split("/").length > 3) await expect(page.getByTestId("stage-3d").locator("canvas").first()).toBeVisible({ timeout: 45_000 });
      // let late Suspense boundaries hydrate
      await page.waitForLoadState("networkidle");
    }
  }
  expect(errors, errors.join("\n")).toEqual([]);
});

test("box and container switches keep one 3D canvas (PERF-09)", async ({ page }) => {
  test.setTimeout(120_000);
  await designerAllOptions(page.context());
  await page.route("**/api/designs**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "e2e-perf09", owned: false, updatedAt: new Date().toISOString() }) }));
  await page.goto("/en/design/mailer-box");
  const stage = page.getByTestId("stage-3d");
  await expect(stage.locator("canvas").first()).toBeVisible({ timeout: 45_000 });
  await stage.locator("canvas").first().evaluate((c) => ((c as HTMLCanvasElement).dataset.e2eFirst = "1"));
  const models: [string, string][] = [
    ["ROUND_BOTTLE", "Water and juice bottle"],
    ["FEFCO_0201", "FEFCO 0201"],
    ["STAND_UP_POUCH", "Stand-up pouch"],
    ["FEFCO_0427", "FEFCO 0427"],
  ];
  for (const [code, query] of models) {
    const change = page.getByRole("button", { name: "Change box type" }).first();
    if (!(await change.isVisible())) await page.getByRole("button", { name: /Show more controls/ }).click();
    await change.click();
    const picker = page.getByTestId("catalogue-picker");
    await picker.getByRole("searchbox").fill(query);
    await picker.getByRole("button", { name: /^All/ }).click();
    await picker.locator(`[data-model="${code}"]`).click();
    await expect(stage).toHaveAttribute("data-model", code);
  }
  // Same <canvas> element (same WebGL context) after every switch.
  await expect(stage.locator("canvas")).toHaveCount(1);
  await expect(stage.locator("canvas").first()).toHaveAttribute("data-e2e-first", "1");
});

/**
 * R10-R1: two devices on one design (two browser contexts sharing the anonymous cookie, so no
 * BroadcastChannel between them). The second save is based on an older version: the server
 * answers 409, the editor pauses autosave and asks; "Keep this version" overwrites on purpose.
 */
test("two devices on one design: the older save is refused and the visitor chooses", async ({ browser, baseURL }, testInfo) => {
  // The design name field sits in the desktop toolbar; the server path is the same on phones.
  test.skip(testInfo.project.name === "mobile", "name field is desktop-only");
  test.setTimeout(150_000);
  const a = await browser.newContext({ baseURL });
  const pageA = await a.newPage();
  await pageA.goto("/en/design/mailer-box");
  await expect(pageA.getByTestId("stage-3d").locator("canvas").first()).toBeVisible({ timeout: 45_000 });
  await pageA.getByRole("textbox", { name: "Design name" }).fill(`Two devices ${Date.now()}`);
  await expect(pageA).toHaveURL(/[?&]d=[\w-]+/, { timeout: 20_000 });
  await expect(pageA.getByTestId("save-status")).toHaveAttribute("data-state", "saved", { timeout: 20_000 });
  const url = new URL(pageA.url()).pathname + new URL(pageA.url()).search;

  // Device B: same anonymous owner (cookies), its own browser storage and channel.
  const b = await browser.newContext({ baseURL, storageState: await a.storageState() });
  const pageB = await b.newPage();
  await pageB.goto(url);
  await expect(pageB.getByTestId("stage-3d").locator("canvas").first()).toBeVisible({ timeout: 45_000 });

  // A saves a newer version.
  await pageA.getByRole("textbox", { name: "Design name" }).fill("Saved on device A");
  await expect(pageA.getByTestId("save-status")).toHaveAttribute("data-state", "saved", { timeout: 20_000 });

  // B edits from the older version: refused, banner, autosave paused.
  await pageB.getByRole("textbox", { name: "Design name" }).fill("Typed on device B");
  const banner = pageB.getByText("This design changed in another tab or on another device");
  await expect(banner).toBeVisible({ timeout: 20_000 });
  await expect(pageB.getByTestId("save-status")).toHaveText("Autosave paused");
  const check = await b.request.get(`/api/designs/${new URL(pageA.url()).searchParams.get("d")}`);
  expect((await check.json()).doc.name).toBe("Saved on device A");

  // B keeps its version on purpose: stored, and A's next save would now be the stale one.
  await pageB.getByRole("button", { name: "Keep this version" }).click();
  await expect(pageB.getByTestId("save-status")).toHaveAttribute("data-state", "saved", { timeout: 20_000 });
  const after = await b.request.get(`/api/designs/${new URL(pageA.url()).searchParams.get("d")}`);
  expect((await after.json()).doc.name).toBe("Typed on device B");
  await a.close();
  await b.close();
});

/** A 400 × 200 PNG (two colour halves) for the crop test, built in the page. */
async function twoToneImage(page: Page): Promise<Buffer> {
  const b64 = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 400;
    c.height = 200;
    const x = c.getContext("2d")!;
    x.fillStyle = "#1f3d2b";
    x.fillRect(0, 0, 200, 200);
    x.fillStyle = "#d13b3b";
    x.fillRect(200, 0, 200, 200);
    return c.toDataURL("image/png").split(",")[1];
  });
  return Buffer.from(b64, "base64");
}

test("crop an image to a square: non-destructive, kept in the saved design", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "inspector fields are checked on desktop");
  test.setTimeout(120_000);
  await designerAllOptions(page.context());
  await page.goto("/en/design/mailer-box");
  await expect(page.getByTestId("stage-3d").locator("canvas").first()).toBeVisible({ timeout: 45_000 });
  await page.getByRole("tab", { name: "Artwork" }).click();
  // The Artwork tab's own picker (the stage has a hidden one for "tap a side of the box").
  await page.getByRole("tabpanel", { name: "Artwork" }).locator("input[type=file]").first().setInputFiles({ name: "two-tone.png", mimeType: "image/png", buffer: await twoToneImage(page) });
  const crop = page.getByRole("button", { name: "Crop", exact: true });
  await expect(crop).toBeVisible({ timeout: 15_000 });
  await crop.click();
  const dlg = page.getByRole("dialog", { name: "Crop image" });
  await dlg.getByRole("button", { name: "Square", exact: true }).click();
  // Keyboard alternative to dragging (WCAG 2.5.7): the frame moves with the arrow keys.
  await dlg.getByTestId("crop-frame").focus();
  await page.keyboard.press("ArrowRight");
  await expect(dlg.getByLabel("Width %")).toHaveValue("50");
  await dlg.getByRole("button", { name: "Apply crop" }).click();
  await expect(dlg).toBeHidden();
  // Image fit: exact sizes sit under the collapsed "Fine adjust".
  await page.getByTestId("fine-adjust").locator("summary").click();
  const w = Number(await page.getByLabel("Width (mm)", { exact: true }).inputValue());
  const h = Number(await page.getByLabel("Height (mm)", { exact: true }).inputValue());
  expect(Math.abs(w - h)).toBeLessThan(0.6);
  await expect(page.getByRole("button", { name: "Remove crop" })).toBeVisible();
  await expect(page).toHaveURL(/[?&]d=[\w-]+/, { timeout: 20_000 });
  await expect(page.getByTestId("save-status")).toHaveAttribute("data-state", "saved", { timeout: 20_000 });
  const id = new URL(page.url()).searchParams.get("d");
  const saved = await (await page.request.get(`/api/designs/${id}`)).json();
  const img = saved.doc.artwork.outside.layers.find((l: { kind: string }) => l.kind === "image");
  expect(img.crop.width).toBeCloseTo(0.5, 2);
  expect(img.pxWidth).toBe(400); // the whole image is kept
});

test("brand colours: saved per account, shown first, sent with the design", async ({ page, context, baseURL }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "covered on desktop");
  test.setTimeout(120_000);
  const user = track(await createUser({ name: "Brand colours e2e" }));
  await signInAs(context, baseURL!, user.id);
  await designerAllOptions(context);
  await page.goto("/ar/design/mailer-box");
  await expect(page.getByTestId("stage-3d").locator("canvas").first()).toBeVisible({ timeout: 45_000 });
  await page.getByRole("tab", { name: "التصميم" }).click();
  await page.getByRole("textbox", { name: "رمز اللون" }).first().fill("#7a1fa2");
  await page.getByRole("button", { name: "حفظ في ألوان العلامة" }).first().click();
  const dlg = page.getByRole("dialog", { name: "ألوان العلامة التجارية" });
  await expect(dlg.getByRole("textbox", { name: "رمز اللون" })).toHaveValue("#7a1fa2");
  await dlg.getByRole("textbox", { name: "الاسم" }).fill("بنفسجي الشركة");
  // Arabic-keyboard digits in the CMYK fields.
  for (const [k, v] of [["C", "٥٠"], ["M", "٩٠"], ["Y", "0"], ["K", "10"]]) await dlg.getByRole("textbox", { name: k, exact: true }).fill(v);
  await dlg.getByRole("textbox", { name: "مرجع اللون الخاص (اختياري)" }).fill("PMS 2603 C");
  await dlg.getByRole("button", { name: "إضافة اللون" }).click();
  await expect(dlg.getByTestId("brand-list")).toContainText("بنفسجي الشركة");
  await expect(dlg.getByTestId("brand-list")).toContainText("CMYK 50 / 90 / 0 / 10");
  await dlg.getByRole("button", { name: "إغلاق" }).first().click();
  // First in the picker, and kept on the account.
  await expect(page.getByTestId("brand-swatches").first().getByRole("button", { name: /لون العلامة بنفسجي الشركة/ })).toBeVisible();
  const stored = await (await page.request.get("/api/designs/brand-colors")).json();
  expect(stored.colors).toEqual([{ name: "بنفسجي الشركة", hex: "#7a1fa2", cmyk: [50, 90, 0, 10], spot: "PMS 2603 C" }]);
  // The design uses it (background), so its references travel with the saved design.
  await expect(page).toHaveURL(/[?&]d=[\w-]+/, { timeout: 20_000 });
  await expect(page.getByTestId("save-status")).toHaveAttribute("data-state", "saved", { timeout: 20_000 });
  const id = new URL(page.url()).searchParams.get("d");
  const saved = await (await page.request.get(`/api/designs/${id}`)).json();
  expect(saved.doc.brandColors?.[0]?.spot).toBe("PMS 2603 C");
});

test("phones can rename a design from More actions (R5-JR-14)", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "the toolbar name field covers desktop");
  test.setTimeout(90_000);
  await page.goto("/en/design/mailer-box");
  await expect(page.getByTestId("stage-3d").locator("canvas").first()).toBeVisible({ timeout: 45_000 });
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Rename" }).click();
  const dlg = page.getByRole("dialog", { name: "Rename design" });
  await dlg.getByLabel("Design name").fill("Phone named box");
  await dlg.getByRole("button", { name: "Done" }).click();
  await expect(dlg).toBeHidden();
  await expect(page).toHaveURL(/[?&]d=[\w-]+/, { timeout: 20_000 });
  await expect(page.getByTestId("save-status")).toHaveAttribute("data-state", "saved", { timeout: 20_000 });
  const saved = await (await page.request.get(`/api/designs/${new URL(page.url()).searchParams.get("d")}`)).json();
  expect(saved.doc.name).toBe("Phone named box");
});
