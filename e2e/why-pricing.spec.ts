import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signInPhone } from "./fixtures/factory";

/**
 * r6-why: /why-elba and /pricing (docs/audit/r6-why.md), Arabic and English, desktop and phone
 * projects. Structure per section table, live prices equal to the instant quote checkout uses,
 * the VAT toggle, the pausable ticker (WCAG 2.2.2), reduced motion, reflow, axe 0. Read-only.
 */

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const REF = { structureCode: "FEFCO_0427", dims: { L: 300, W: 220, H: 60 }, materialCode: "E_FLUTE_KRAFT", printSides: "OUTSIDE", colours: 4, finishes: [] };

const piasters = (text: string) => Math.round(Number(/[\d,]+(?:\.\d+)?/.exec(text)![0].replace(/,/g, "")) * 100);
const vatOf = (sub: number) => {
  const num = sub * 1400;
  const q = Math.floor(num / 10_000);
  return num % 10_000 >= 5_000 ? q + 1 : q;
};

async function settle(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => Number.isFinite(Number(a.effect?.getComputedTiming().endTime)))
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
}

async function axe(page: Page) {
  // Reveal every [data-reveal] block first (axe would measure text mid-fade).
  await page.evaluate(() => document.querySelectorAll("[data-reveal]").forEach((el) => el.setAttribute("data-revealed", "")));
  await settle(page);
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

async function noHorizontalScroll(page: Page) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over).toBeLessThanOrEqual(1);
}

for (const locale of ["ar", "en"] as const) {
  test.describe(`/${locale}/why-elba`, () => {
    test("sections, real numbers, anchors the header links to, axe 0", async ({ page }) => {
      await page.goto(`/${locale}/why-elba`);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("h1")).toContainText(locale === "ar" ? "علب أكثر." : "More boxes.");
      for (const id of ["why-points", "why-orders", "why-spend", "why-segments", "why-switch", "why-faq", "why-close"]) {
        await expect(page.locator(`#${id}`)).toBeVisible();
      }
      for (const id of ["cafes", "beauty", "ecommerce", "faq"]) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
      // Real figures only: the designer model count stat is a number, and no testimonial markup.
      await expect(page.locator("#why-spend").locator("xpath=ancestor::section[1]").locator("li")).toHaveCount(4);
      await expect(page.locator("text=/★|testimonial/i")).toHaveCount(0);
      // The promise card links to the real returns policy.
      await expect(page.getByRole("link", { name: locale === "ar" ? "سياسة الاسترجاع وإعادة الطباعة" : "Returns and reprint policy" })).toHaveAttribute("href", `/${locale}/legal/returns`);
      await noHorizontalScroll(page);
      await axe(page);
    });

    test("ticker pauses with its button and stays still under reduced motion (WCAG 2.2.2, 2.3.3)", async ({ page, browser }) => {
      await page.goto(`/${locale}/why-elba`);
      const pause = page.getByRole("button", { name: locale === "ar" ? "إيقاف الشريط" : "Pause ticker" });
      await expect(pause).toHaveAttribute("aria-pressed", "false");
      const track = page.locator("ul", { has: page.locator("li", { hasText: locale === "ar" ? "سلوفان مطفي" : "Matte lamination" }) }).first();
      await expect.poll(() => track.evaluate((el) => getComputedStyle(el).animationPlayState)).toBe("running");
      await pause.click();
      await expect(page.getByRole("button", { name: locale === "ar" ? "تشغيل الشريط" : "Play ticker" })).toHaveAttribute("aria-pressed", "true");
      await expect.poll(() => track.evaluate((el) => getComputedStyle(el).animationPlayState)).toBe("paused");

      const ctx = await browser.newContext({ reducedMotion: "reduce" });
      const calm = await ctx.newPage();
      await calm.goto(`/${locale}/why-elba`);
      const names = await calm.evaluate(() => document.getAnimations().filter((a) => a.playState === "running" && !Number.isFinite(Number(a.effect?.getComputedTiming().endTime))).length);
      expect(names).toBe(0);
      // Content is all there without motion: the count-up shows its final value.
      await expect(calm.locator("#why-spend").locator("xpath=ancestor::section[1]")).toContainText("%");
      await ctx.close();
    });
  });

  test.describe(`/${locale}/pricing`, () => {
    test("tier cards, VAT toggle, comparison table, FAQ, axe 0", async ({ page }) => {
      await page.goto(`/${locale}/pricing`);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.getByTestId("tier-100")).toBeVisible();
      await expect(page.getByTestId("tier-500")).toBeVisible();
      await expect(page.getByTestId("tier-2000")).toBeVisible();
      await expect(page.getByTestId("tier-wholesale")).toBeVisible();

      const card = page.getByTestId("tier-500");
      await expect(card.getByTestId("tier-total")).toBeVisible();
      await expect(card.getByTestId("tier-subtotal")).toBeHidden();
      const toggle = page.getByRole("button", { name: locale === "ar" ? "الأسعار شاملة ضريبة القيمة المضافة 14%" : "Prices incl. 14% VAT" });
      await expect(toggle).toHaveAttribute("aria-pressed", "true");
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-pressed", "false");
      await expect(card.getByTestId("tier-subtotal")).toBeVisible();
      await expect(card.getByTestId("tier-total")).toBeHidden();
      await toggle.click();

      // The comparison table total for 500 equals the card.
      const total500 = piasters((await card.getByTestId("tier-total").textContent())!);
      await expect(page.locator("#compare table")).toContainText((await card.getByTestId("tier-total").textContent())!.trim());
      expect(total500).toBeGreaterThan(0);

      // The tier CTA opens the reference box in the designer.
      const href = await card.getByRole("link").first().getAttribute("href");
      expect(href).toContain("structure=FEFCO_0427");
      expect(href).toContain("L=300");

      await expect(page.locator("#faq details")).toHaveCount(7);
      await page.locator("#faq summary").first().click();
      await expect(page.locator("#faq details").first()).toHaveAttribute("open", "");
      await noHorizontalScroll(page);
      await axe(page);
    });

    test("card prices equal the instant quote checkout uses (best match, admin prepay discount, 14% VAT)", async ({ page, baseURL }) => {
      await signInPhone(page.context(), baseURL!, "+201000000002");
      await page.goto(`/${locale}/pricing`);
      for (const qty of [100, 500, 2000]) {
        const res = await page.request.post("/api/quote", { data: { ...REF, quantity: qty } });
        expect(res.ok()).toBeTruthy();
        const q = (await res.json()) as { mode: string; prepayDiscountPct: number; offers: { lines: { kind: string; totalPiasters: number }[] }[] };
        expect(q.mode).toBe("instant");
        const best = q.offers[0]!;
        const shipping = best.lines.filter((l) => l.kind === "SHIPPING").reduce((a, l) => a + l.totalPiasters, 0);
        const goods = best.lines.filter((l) => l.kind !== "SHIPPING" && l.kind !== "DISCOUNT").reduce((a, l) => a + l.totalPiasters, 0);
        const discount = q.prepayDiscountPct > 0 ? Math.floor((goods * Math.round(q.prepayDiscountPct * 100) + 5_000) / 10_000) : 0;
        const subtotal = goods + shipping - discount;
        const card = page.getByTestId(`tier-${qty}`);
        expect(piasters((await card.getByTestId("tier-total").textContent())!)).toBe(subtotal + vatOf(subtotal));
        expect(piasters((await card.getByTestId("tier-subtotal").textContent())!)).toBe(subtotal);
      }
    });
  });
}

test("sitemap lists both pages in both languages", async ({ request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  for (const locale of ["ar", "en"]) {
    expect(xml).toContain(`/${locale}/why-elba</loc>`);
    expect(xml).toContain(`/${locale}/pricing</loc>`);
  }
});
