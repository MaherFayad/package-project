import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { signInPhone } from "./fixtures/factory";

/**
 * Route-level WCAG 2.2 AA regression (docs/audit/a11y.md, round 5): axe with the wcag2a, wcag2aa,
 * wcag21a, wcag21aa and wcag22aa tags on the main routes of every role, in Arabic and English, plus
 * the page language and direction (3.1.1, 1.3.2), one h1 and one main landmark (1.3.1, 2.4.1) and
 * no horizontal page scroll at the project width (1.4.10 Reflow). Read-only: seeded accounts only.
 */

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const PHONES = { buyer: "+201000000002", vendor: "+201000000010", admin: "+201000000001" } as const;

const ROUTES: Record<"anon" | keyof typeof PHONES, string[]> = {
  anon: ["", "/login", "/boxes", "/bottles", "/catalog", "/vendors", "/design", "/legal/privacy", "/vendor/apply", "/no-such-page"],
  buyer: ["/account", "/orders"],
  vendor: ["/vendor", "/vendor/jobs", "/vendor/rate-cards"],
  admin: ["/admin", "/admin/orders", "/admin/users", "/admin/vendors", "/admin/privacy"],
};

for (const locale of ["ar", "en"] as const) {
  for (const [role, paths] of Object.entries(ROUTES) as [keyof typeof ROUTES, string[]][]) {
    for (const path of paths) {
      test(`axe ${role} /${locale}${path}`, async ({ page, baseURL }) => {
        test.setTimeout(90_000);
        if (role !== "anon") await signInPhone(page.context(), baseURL!, PHONES[role]);
        await page.goto(`/${locale}${path}`, { waitUntil: "load" });
        await expect(page.locator("h1").first()).toBeVisible();
        // Let finite reveal transitions finish (axe would measure text mid-fade) and React swap in
        // any streamed Suspense content (it waits in a <div hidden> before it replaces the fallback).
        await page.evaluate(() =>
          Promise.all(
            document
              .getAnimations()
              .filter((a) => Number.isFinite(Number(a.effect?.getComputedTiming().endTime)))
              .map((a) => a.finished.catch(() => undefined)),
          ),
        );
        await expect(page.locator("[hidden] h1")).toHaveCount(0);

        const meta = await page.evaluate(() => ({
          lang: document.documentElement.lang,
          dir: document.documentElement.dir,
          h1: [...document.querySelectorAll("h1")].filter((h) => !h.closest("[hidden]")).length,
          main: document.querySelectorAll("main, [role=main]").length,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        }));
        expect(meta).toEqual({ lang: locale, dir: locale === "ar" ? "rtl" : "ltr", h1: 1, main: 1, overflow: 0 });

        const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
        expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
      });
    }
  }
}
