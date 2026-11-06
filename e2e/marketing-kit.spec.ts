import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signInPhone } from "./fixtures/factory";

/**
 * Marketing kit foundation (docs/design-refs/shopify-2026-reference.md, section 6): the dev
 * gallery is axe-clean in both locales and both motion settings, the header mega-menus work by
 * hover, click and keyboard, the phone menu traps focus, and every kit section's content is
 * visible without scrolling animations (reduced motion).
 */

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: "elba_cookie_ack", value: "1", url: baseURL! }]);
});

async function axeClean(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

/** The gallery really rendered (not a 404): every kit section is on the page. */
async function isGallery(page: Page) {
  expect(await page.locator("main [data-tone]").count()).toBeGreaterThan(15);
  await expect(page.getByRole("tablist")).toHaveCount(1);
}

async function revealAll(page: Page) {
  // Scroll through so every reveal, count-up and lazy image has run, then back to the top.
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 700) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(1600);
  await page.evaluate(() => window.scrollTo(0, 0));
}

for (const locale of ["ar", "en"] as const) {
  test(`kit gallery is axe-clean (${locale}, motion)`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(`/${locale}/dev/kit`);
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await isGallery(page);
    await revealAll(page);
    await axeClean(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test(`kit gallery under reduced motion shows everything (${locale})`, async ({ browser, baseURL }) => {
    test.setTimeout(120_000);
    const ctx = await browser.newContext({ reducedMotion: "reduce", baseURL });
    await ctx.addCookies([{ name: "elba_cookie_ack", value: "1", url: baseURL! }]);
    const page = await ctx.newPage();
    await page.goto(`/${locale}/dev/kit`);
    await page.waitForLoadState("networkidle");
    await isGallery(page);
    // Nothing waits for a scroll reveal: a section far down is already fully opaque.
    const hidden = await page.evaluate(() => Array.from(document.querySelectorAll("[data-reveal]")).filter((el) => getComputedStyle(el).opacity !== "1").length);
    expect(hidden).toBe(0);
    // No pause buttons for motion that does not run (MotionScope hides its own), marquee is a scroller.
    const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running" && (a.effect as KeyframeEffect | null)?.getComputedTiming().iterations === Infinity).length);
    expect(running).toBe(0);
    await axeClean(page);
    await ctx.close();
  });
}

/** Elements (with their pseudo-elements) whose computed animation-name is not "none". */
const animated = (page: Page) =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll("body *")).flatMap((el) =>
      [null, "::before", "::after"].flatMap((pseudo) => {
        const name = getComputedStyle(el, pseudo).animationName;
        return name && name !== "none" ? [`${el.tagName.toLowerCase()}.${String((el as HTMLElement).className).split(" ")[0]}${pseudo ?? ""}: ${name}`] : [];
      }),
    ),
  );

for (const locale of ["ar", "en"] as const) {
  // WCAG 2.3.3: under reduced motion no kit element runs any animation, in either direction.
  // Computed animation-name (not getAnimations) also catches a direction-specific rule such as
  // `.track:dir(rtl) { animation-name }` outranking the reduced-motion reset.
  test(`reduced motion: computed animation-name is none everywhere (${locale})`, async ({ browser, baseURL }, info) => {
    test.setTimeout(120_000);
    const ctx = await browser.newContext({ ...info.project.use, reducedMotion: "reduce", baseURL });
    await ctx.addCookies([{ name: "elba_cookie_ack", value: "1", url: baseURL! }]);
    const page = await ctx.newPage();
    await page.goto(`/${locale}/dev/kit`);
    await page.waitForLoadState("networkidle");
    await isGallery(page);
    await revealAll(page);
    expect(await animated(page)).toEqual([]);
    if (info.project.name === "mobile") {
      await page.getByRole("button", { name: locale === "ar" ? "القائمة" : "Menu" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      expect(await animated(page)).toEqual([]);
      await dialog.getByRole("button", { name: locale === "ar" ? "المنتجات" : "Products" }).click();
      await expect(dialog.getByRole("button", { name: locale === "ar" ? "رجوع" : "Back" })).toBeVisible();
      expect(await animated(page)).toEqual([]);
    } else {
      await page.getByRole("button", { name: locale === "ar" ? "المنتجات" : "Products" }).click();
      await expect(page.getByRole("button", { name: locale === "ar" ? "المنتجات" : "Products" })).toHaveAttribute("aria-expanded", "true");
      expect(await animated(page)).toEqual([]);
    }
    await ctx.close();
  });
}

test("header: transparent over a hero, solid after scroll; mega-menu by hover, click and keyboard", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "desktop navigation");
  await page.goto("/en/dev/kit");
  await page.waitForLoadState("networkidle");
  const header = page.locator("header").first();
  const bg = () => header.evaluate((el) => getComputedStyle(el, "::after").opacity);
  expect(await bg()).toBe("0");
  await page.mouse.wheel(0, 600);
  await expect.poll(bg).toBe("1");
  await page.evaluate(() => window.scrollTo(0, 0));

  const products = page.getByRole("button", { name: "Products" });
  await products.hover();
  await expect(products).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("link", { name: "Mailer and shipping boxes" })).toBeVisible();
  await page.mouse.move(700, 880);
  await expect(products).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("link", { name: "Mailer and shipping boxes" })).toBeHidden();

  await products.click();
  await expect(products).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(products).toHaveAttribute("aria-expanded", "false");
  await expect(products).toBeFocused();

  // Keyboard: ArrowDown opens and focuses the first link; Tab walks the panel.
  await products.press("ArrowDown");
  await expect(page.getByRole("link", { name: "Mailer and shipping boxes" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Folding cartons" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(products).toBeFocused();
  await expect(page.getByRole("link", { name: "Start free" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/en/login");
});

test("phone menu: full screen, drill-down, focus trapped, Escape returns focus", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "phone navigation");
  await page.goto("/ar/dev/kit");
  await page.waitForLoadState("networkidle");
  const open = page.getByRole("button", { name: "القائمة" });
  await open.click();
  const dialog = page.getByRole("dialog", { name: "القائمة" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "المنتجات" }).click();
  await expect(dialog.getByRole("link", { name: "علب بريدية وكراتين شحن" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "رجوع" })).toBeFocused();
  await dialog.getByRole("button", { name: "رجوع" }).click();
  await expect(dialog.getByRole("link", { name: "الأسعار" })).toBeVisible();
  for (let i = 0; i < 12; i++) await page.keyboard.press("Tab");
  expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(open).toBeFocused();
});

test("footer: four columns, language switch, legal and social links", async ({ page }) => {
  await page.goto("/en/dev/kit");
  const footer = page.locator("footer");
  for (const name of ["Products", "Elba", "Printers", "Support"]) await expect(footer.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(footer.getByRole("link", { name: "العربية" })).toHaveAttribute("href", "/ar/dev/kit");
  await expect(footer.getByRole("link", { name: "Privacy policy" })).toBeVisible();
  await expect(footer.getByRole("link", { name: "Elba on Instagram" })).toHaveAttribute("rel", /noopener/);
});

test("marquee and steps pause controls (WCAG 2.2.2)", async ({ page }) => {
  await page.goto("/en/dev/kit");
  await page.waitForLoadState("networkidle");
  const pauseStrip = page.getByRole("button", { name: "Pause the moving strip" }).first();
  await pauseStrip.scrollIntoViewIfNeeded();
  await pauseStrip.click();
  await expect(page.getByRole("button", { name: "Play the moving strip" }).first()).toHaveAttribute("aria-pressed", "true");
  const tabs = page.getByRole("tablist", { name: "Getting started" });
  await tabs.scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Pause steps" }).click();
  await tabs.getByRole("tab").nth(1).click();
  await expect(tabs.getByRole("tab").nth(1)).toHaveAttribute("aria-selected", "true");
  await tabs.getByRole("tab").nth(1).press("ArrowDown");
  await expect(tabs.getByRole("tab").nth(2)).toBeFocused();
});

test("kit gallery is not in the sitemap and is disallowed in robots", async ({ request }) => {
  const sm = await (await request.get("/sitemap.xml")).text();
  expect(sm).not.toContain("/dev/");
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /*/dev/");
});

/** Header controls that run past either edge of the viewport, and the page's horizontal overflow. */
const headerOverflow = (page: Page) =>
  page.evaluate(() => {
    const h = document.querySelector("header")!;
    const out = Array.from(h.querySelectorAll<HTMLElement>("a, button"))
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && (r.right > window.innerWidth + 0.5 || r.left < -0.5);
      })
      .map((e) => e.textContent?.trim() || e.getAttribute("aria-label"));
    return { page: document.documentElement.scrollWidth - window.innerWidth, out };
  });

// R6-AX-10 (WCAG 1.4.10): the desktop header fits from 1000 to 1280 px in both locales, signed out
// and signed in with the longest role (vendor: Orders + Vendor portal; admin: Orders + Admin).
for (const who of [
  { key: "anon", phone: null },
  { key: "buyer", phone: "+201000000002" },
  { key: "vendor", phone: "+201000000010" },
  { key: "admin", phone: "+201000000001" },
] as const) {
  test(`header fits 1000 to 1280 px, ar and en (${who.key})`, async ({ page, baseURL }, info) => {
    test.skip(info.project.name !== "desktop", "desktop widths");
    test.setTimeout(120_000);
    if (who.phone) await signInPhone(page.context(), baseURL!, who.phone);
    for (const locale of ["ar", "en"] as const) {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(`/${locale}/vendors`);
      await page.waitForLoadState("networkidle");
      // Signed in for real (the account menu replaces "Sign in"); desktop actions show from 1024 px.
      if (who.phone) await expect(page.locator("header").getByRole("button", { name: locale === "ar" ? "حسابي" : "My account" })).toBeVisible();
      for (let w = 1000; w <= 1280; w += 20) {
        await page.setViewportSize({ width: w, height: 800 });
        expect(await headerOverflow(page), `${locale} ${who.key} at ${w}px`).toEqual({ page: 0, out: [] });
      }
    }
    if (who.key === "vendor" || who.key === "admin") {
      // The role links moved from the bar into the account menu.
      await page.getByRole("button", { name: "My account" }).click();
      await expect(page.getByRole("link", { name: "Orders" })).toBeVisible();
      await expect(page.getByRole("link", { name: who.key === "vendor" ? "Vendor portal" : "Admin" })).toBeVisible();
    }
  });
}

test("mega-menu: focus opens it, then Enter keeps it open and moves to the first link (R6-AX-16)", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "desktop navigation");
  await page.goto("/en/dev/kit");
  await page.waitForLoadState("networkidle");
  await page.locator("header").getByRole("link", { name: "Elba, Home" }).focus();
  await page.keyboard.press("Tab");
  const products = page.getByRole("button", { name: "Products" });
  await expect(products).toBeFocused();
  await expect(products).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Enter");
  await expect(products).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("link", { name: "Mailer and shipping boxes" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(products).toBeFocused();
  await page.keyboard.press(" ");
  await expect(products).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("link", { name: "Mailer and shipping boxes" })).toBeFocused();
});

test("violet band: text and muted text are solid white (R6-AX-14, WCAG 1.4.3)", async ({ page }) => {
  await page.goto("/en/dev/kit");
  const colours = await page.evaluate(() =>
    // Every text element whose nearest band / card is violet (Sheet, SheetCard, BentoCard).
    Array.from(document.querySelectorAll('[data-tone="violet"] :is(p, span, h2, h3, li)'))
      .filter((el) => (el.textContent ?? "").trim() && el.closest("[data-tone]")?.getAttribute("data-tone") === "violet" && !el.closest("button, a, code, [class*='orbitNode'], [class*='orbitHub']"))
      .map((el) => getComputedStyle(el).color),
  );
  expect(colours.length).toBeGreaterThan(3);
  expect([...new Set(colours)]).toEqual(["rgb(255, 255, 255)"]);
});

test("page-local loops register with data-mk-motion: a global MotionScope pauses them (R6-AX-15)", async ({ page }) => {
  await page.goto("/en/dev/kit");
  await page.waitForLoadState("networkidle");
  const loop = page.getByTestId("page-loop");
  const state = () => loop.evaluate((el) => getComputedStyle(el).animationPlayState);
  expect(await state()).toBe("running");
  // The violet section holds two scopes: Orbit's own and, around it, the global one (last in DOM).
  const pause = page.locator('[data-tone="violet"]').getByRole("button", { name: "Pause animation" }).last();
  await pause.scrollIntoViewIfNeeded();
  await pause.click();
  await expect.poll(state).toBe("paused");
  await page.locator('[data-tone="violet"]').getByRole("button", { name: "Play animation" }).last().click();
  await expect.poll(state).toBe("running");
});

for (const locale of ["ar", "en"] as const) {
  test(`footer: every link appears once (unique href and name, ${locale})`, async ({ page }) => {
    await page.goto(`/${locale}/vendors`);
    const links = await page.locator("footer a").evaluateAll((as) => as.map((a) => ({ href: (a as HTMLAnchorElement).getAttribute("href") ?? "", name: (a.getAttribute("aria-label") ?? a.textContent ?? "").trim() })));
    expect(links.length).toBeGreaterThan(15);
    const dup = (xs: string[]) => xs.filter((x, i) => xs.indexOf(x) !== i);
    // The brand link (home) and the language switch are the only non-column links; both are unique too.
    expect(dup(links.map((l) => l.href)), "duplicate footer hrefs").toEqual([]);
    expect(dup(links.map((l) => l.name)), "duplicate footer link names").toEqual([]);
  });
}

test('Sheet tone="dark-2": raised dark that overlaps a dark band instead of collapsing', async ({ page }) => {
  await page.goto("/en/dev/kit");
  await page.waitForLoadState("networkidle");
  // Hydrated (RevealScope ran): nothing re-renders the bands after this point.
  await page.waitForFunction(() => document.documentElement.dataset.motion === "on" || matchMedia("(prefers-reduced-motion: reduce)").matches);
  // The one gallery band for this tone, by its accessible name (not the first CSS match).
  const band = page.getByRole("region", { name: "Sheet tone dark-2", exact: true });
  await expect(band).toHaveCount(1);
  await expect(band).toHaveAttribute("data-tone", "dark-2");
  // Web-first, retrying assertions instead of a single computed-style snapshot.
  await expect(band).toHaveCSS("background-color", "rgb(20, 26, 26)");
  await expect(band).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(band.locator("xpath=preceding-sibling::*[1]")).toHaveAttribute("data-tone", "dark");
  await expect.poll(() => band.evaluate((el) => parseFloat(getComputedStyle(el).marginTop))).toBeLessThan(0);
  await expect.poll(() => band.evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius))).toBeGreaterThan(0);
});

// R6-AX-18 (WCAG 2.4.11 Focus Not Obscured): tabbing through a moving Marquee at 320 px, every
// focused item is fully inside the viewport (the loop stops on focus and the strip scrolls).
for (const locale of ["ar", "en"] as const) {
  for (const path of ["/dev/kit", "/designer"]) {
    test(`marquee: every item is fully on screen when focused at 320 px (${locale}${path})`, async ({ page }, info) => {
      test.skip(info.project.name !== "desktop", "viewport set explicitly");
      await page.setViewportSize({ width: 320, height: 700 });
      const res = await page.goto(`/${locale}${path}`);
      test.skip(res?.status() !== 200, `${path} not on this branch`);
      await page.waitForLoadState("networkidle");
      const strips = page.locator('[class*="marqueeViewport"]');
      const n = await strips.count();
      test.skip(n === 0, "no marquee on the page");
      let checked = 0;
      for (let s = 0; s < n; s++) {
        const items = strips.nth(s).locator("li:not([aria-hidden]) :is(a, button, [tabindex='0'])");
        const count = await items.count();
        if (!count) continue;
        await page.waitForTimeout(1500); // let the loop carry items past the start first
        await items.first().focus();
        for (let i = 0; i < count; i++) {
          if (i > 0) await page.keyboard.press("Tab");
          const box = await page.evaluate(() => {
            const r = document.activeElement!.getBoundingClientRect();
            return { left: r.left, right: r.right, w: window.innerWidth, label: document.activeElement!.getAttribute("aria-label") ?? document.activeElement!.textContent?.trim() };
          });
          expect(box.left, `${box.label} left`).toBeGreaterThanOrEqual(-0.5);
          expect(box.right, `${box.label} right`).toBeLessThanOrEqual(box.w + 0.5);
          checked++;
        }
      }
      expect(checked).toBeGreaterThan(0);
    });
  }
}
