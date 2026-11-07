import { expect, type BrowserContext, type Locator, type Page, type TestInfo } from "@playwright/test";
import { getDictionary, getT } from "../../src/i18n";
import type { Locale } from "../../src/types";
import { db } from "../fixtures/factory";

/**
 * Journey helpers (docs/audit/journeys.md). Every journey runs twice: in English on the desktop
 * project and in Arabic on the phone project, so each step is checked in both languages and at
 * both widths without doubling the run time.
 *
 * Labels are written once, in English, and translated by looking the English string up in the
 * real dictionaries (`tr`): a renamed or mistranslated label fails the Arabic run, which is the
 * point. Interpolated strings use `t` with their key.
 */
export function localeOf(info: TestInfo): Locale {
  return info.project.name === "mobile" ? "ar" : "en";
}

type Dict = Record<string, unknown>;
const flat = (d: Dict, prefix = "", out = new Map<string, string>()) => {
  for (const [k, v] of Object.entries(d)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out.set(key, v);
    else if (v && typeof v === "object") flat(v as Dict, key, out);
  }
  return out;
};
const EN = flat(getDictionary("en") as unknown as Dict);
const AR = flat(getDictionary("ar") as unknown as Dict);
const BY_EN = new Map<string, string[]>();
for (const [k, v] of EN) BY_EN.set(v, [...(BY_EN.get(v) ?? []), k]);

/** The label in `locale` for an English UI string (the first key whose English text matches). */
export function tr(locale: Locale, en: string): string {
  if (locale === "en") return en;
  const keys = BY_EN.get(en);
  if (!keys?.length) throw new Error(`[journeys] no dictionary key has the English text "${en}"`);
  const ars = [...new Set(keys.map((k) => AR.get(k)).filter((v): v is string => !!v))];
  if (!ars.length) throw new Error(`[journeys] "${keys[0]}" has no Arabic text`);
  // One English label, several Arabic ones: the caller must name the key (t("ns.key")).
  if (ars.length > 1) throw new Error(`[journeys] "${en}" is ambiguous in Arabic (${keys.join(", ")}): use tFor(locale)(key)`);
  return ars[0]!;
}

/** The dictionary function for `locale` (for interpolated strings). */
export const tFor = (locale: Locale) => getT(locale);

/** Escape a string for an exact-match RegExp. */
export const rx = (s: string, flags = "") => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags);

/**
 * Parse every money amount in a text into piasters. "EGP 28,900.94", "28,900.94 ج.م", "−EGP 768.30",
 * "⁦−768.30⁩ ج.م" all work (bidi isolates, U+2212 minus and thin spaces are ignored).
 */
export function amounts(text: string): number[] {
  const clean = text.replace(/[⁦-⁩‎‏]/g, "");
  const out: number[] = [];
  for (const m of clean.matchAll(/([−-])?\s*(?:EGP\s*)?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\s*(?:ج\.م)?/g)) {
    if (!/EGP|ج\.م/.test(clean.slice(Math.max(0, m.index! - 5), m.index! + m[0].length + 5))) continue;
    const v = Math.round(Number(m[2]!.replace(/,/g, "")) * 100);
    out.push(m[1] ? -v : v);
  }
  return out;
}

/** The amount on the same line as `label` inside `scope` (summary rows are "label … amount"). */
export async function amountOf(scope: Locator, label: string): Promise<number> {
  const row = scope.locator("dt, th, span, p, div").filter({ hasText: rx(label) }).last();
  // Summary rows render label and value as siblings; read the row container.
  const text = await row.locator("xpath=..").innerText();
  const all = amounts(text);
  expect(all.length, `an amount next to "${label}" in: ${text}`).toBeGreaterThan(0);
  return all[all.length - 1]!;
}

/** Cookie banner acknowledged, so it never covers a control. */
export async function ackCookies(context: BrowserContext, baseURL: string): Promise<void> {
  await context.addCookies([{ name: "elba_cookie_ack", value: "1", url: baseURL }]);
}

/**
 * Locale-aware twin of factory.sendOtp: type the phone, press "Send code", return the dev code.
 * Same hydration guard (a late re-render can wipe the typed phone; only then is it typed again).
 */
export async function sendOtpIn(scope: Page | Locator, phone: string, locale: Locale): Promise<string> {
  const page = "page" in scope ? scope.page() : scope;
  const input = scope.getByLabel(tr(locale, "Mobile number"));
  const send = scope.getByRole("button", { name: tr(locale, "Send code") });
  const banner = scope.getByTestId("otp-dev-code");
  // Press "Send code" until a request actually leaves the page: a press before hydration, or a late
  // re-render that wiped the typed phone, sends nothing (and so never touches the per-phone limit).
  await expect(async () => {
    await input.fill("");
    await input.fill(phone);
    await expect(input).toHaveValue(phone, { timeout: 1000 });
    await expect(send).toBeEnabled({ timeout: 1000 });
    const sent = page.waitForRequest((r) => r.url().includes("/api/auth/request-otp") && r.method() === "POST", { timeout: 3000 });
    await send.click();
    await sent;
  }).toPass({ timeout: 60_000 });
  await expect(banner).toBeVisible({ timeout: 30_000 });
  return (await banner.textContent())!.match(/\d{6}/)![0];
}

/** No horizontal page scroll (WCAG 1.4.10 reflow at 320 CSS px and up). */
export async function noSideScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

/** VAT 14% on the ex-VAT subtotal, rounded to the piaster (Egyptian VAT Law 67/2016). */
export const vatOf = (subtotalPiasters: number) => Math.round(subtotalPiasters * 0.14);

/** Age a shipment so the mock courier reports it delivered (it simulates 26 h from creation). */
export async function ageShipments(orderId: string, hours = 27): Promise<void> {
  await db.shipment.updateMany({ where: { orderId }, data: { createdAt: new Date(Date.now() - hours * 3_600_000) } });
}

/** A small, real PNG logo (a circle with initials), drawn in the page. */
export async function logoPng(page: Page): Promise<Buffer> {
  const b64 = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 400;
    const x = c.getContext("2d")!;
    x.fillStyle = "#c8964f";
    x.beginPath();
    x.arc(200, 200, 180, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = "#fff";
    x.font = "bold 120px sans-serif";
    x.fillText("BC", 90, 240);
    return c.toDataURL("image/png").split(",")[1]!;
  });
  return Buffer.from(b64, "base64");
}

export const ONE_PX_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

/**
 * The designer's Basics panel (the default for a new visitor: logo, text, colour, size). On phones
 * the panel is a bottom sheet that starts closed: open it first.
 */
export async function basicsPanel(page: Page, locale: Locale): Promise<Locator> {
  const panel = page.getByTestId("simple-panel");
  await expect(panel).toBeAttached({ timeout: 30_000 });
  const expand = page.getByRole("button", { name: tr(locale, "Show more controls") });
  if (await expand.isVisible().catch(() => false)) await expand.click();
  return panel;
}

/**
 * Signed-in buyer: a quick design (one print colour from the Basics panel, autosaved), then
 * checkout up to the payment step. Returns the design id and the order id of the PENDING_PAYMENT order.
 */
export async function designToPayStep(page: Page, locale: Locale, opts: { company?: boolean } = {}): Promise<{ designId: string; orderId: string }> {
  await page.goto(`/${locale}/design/mailer-box`);
  await expect(page.getByRole("application", { name: tr(locale, "3D preview of your box") })).toBeVisible({ timeout: 30_000 });
  const panel = await basicsPanel(page, locale);
  await panel.getByRole("button", { name: /#c70a24/ }).first().click();
  await expect(page).toHaveURL(/[?&]d=[\w-]+/, { timeout: 30_000 });
  const designId = new URL(page.url()).searchParams.get("d")!;
  await page.goto(`/${locale}/checkout/${designId}`);
  return { designId, orderId: await checkoutToPayStep(page, locale, opts) };
}

/** From the open checkout page of a design to its payment step; returns the new order id. */
export async function checkoutToPayStep(page: Page, locale: Locale, opts: { company?: boolean } = {}): Promise<string> {
  const t = getT(locale);
  // Simplified checkout (docs/audit/simplicity-2026-11/flows.md): quantity, then address +
  // approval on one step, then payment. The printer is chosen for the buyer.
  await expect(page.getByTestId("checkout-total")).toBeVisible({ timeout: 30_000 });
  const summary = page.getByRole("complementary").filter({ hasText: t("buyer.easy.summaryTitle") });
  await summary.getByRole("button", { name: t("buyer.easy.actions.toAddress") }).click();
  // A remembered address shows as a card: open the form to type a fresh one.
  const change = page.getByRole("button", { name: t("buyer.easy.address.edit") });
  if (await change.isVisible().catch(() => false)) await change.click();
  await page.getByLabel(t("checkout.address.name")).fill("Mona Adel");
  await page.getByLabel(t("checkout.address.phone")).fill("010 1234 5678");
  await page.getByLabel(t("checkout.address.governorate")).selectOption("Cairo");
  await page.getByLabel(t("checkout.address.city")).fill("Heliopolis");
  await page.getByLabel(t("checkout.address.street")).fill("3 Baghdad St");
  if (opts.company) {
    const details = page.locator("details").filter({ hasText: t("buyer.easy.address.company") });
    if (!(await details.getAttribute("open").catch(() => null))) await details.locator("summary").click();
    await page.getByLabel(t("buyer.company.toggle")).check();
    await page.getByLabel(t("buyer.company.name")).fill("Mona Foods LLC");
    await page.getByLabel(t("buyer.company.taxId")).fill("111222333");
  }
  await expect(page.getByRole("tab", { name: t("checkout.proof.tab3d") })).toBeVisible({ timeout: 30_000 });
  await page.getByLabel(t("buyer.easy.proof.approve")).check();
  await summary.getByRole("button", { name: t("buyer.easy.actions.toPay") }).click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/checkout/pay/`), { timeout: 30_000 });
  return page.url().split("/").pop()!;
}

/** Pay the open payment step by mock card (`4000 0000 0000 0002` is declined). */
export async function payByCard(page: Page, locale: Locale, card = "4242 4242 4242 4242"): Promise<void> {
  const t = getT(locale);
  const cont = page.getByRole("button", { name: t("buyer.easy.pay.next"), exact: true });
  const number = page.getByLabel(t("payment.card.number"));
  // The method step (Continue) or, after a declined card, the card form again.
  await expect(cont.or(number).first()).toBeVisible({ timeout: 30_000 });
  if (await cont.isVisible()) await cont.click();
  await number.fill(card);
  await page.getByLabel(t("payment.card.expiry")).fill("12/30");
  await page.getByLabel(t("payment.card.cvc")).fill("123");
  await page.getByRole("button", { name: new RegExp(`^${rx(t("payment.pay", { amount: "" }).trim()).source}\\s`) }).click();
}
