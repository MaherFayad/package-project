// @vitest-environment jsdom
/** R5-PL-01: the locale and root error boundaries (docs/audit/platform.md, round 5c). */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/client";
import { getDictionary } from "@/i18n";

vi.mock("@/app/fonts", () => ({ inter: { variable: "inter" }, plexArabic: { variable: "plex" } }));
vi.mock("next/navigation", () => ({ usePathname: () => "/ar/login", useRouter: () => ({ push: vi.fn() }) }));

import LocaleError from "../[locale]/error";
import GlobalError from "../global-error";

afterEach(() => cleanup());

describe("locale error boundary", () => {
  for (const locale of ["ar", "en"] as const) {
    it(`${locale}: one main, an alert with an h1, retry calls reset, home link keeps the locale`, () => {
      const dict = getDictionary(locale);
      const reset = vi.fn();
      vi.spyOn(console, "error").mockImplementation(() => {});
      render(
        <I18nProvider locale={locale} dict={dict}>
          <LocaleError error={new Error("boom")} reset={reset} />
        </I18nProvider>,
      );
      expect(document.querySelectorAll("main#main")).toHaveLength(1);
      const alert = screen.getByRole("alert");
      expect(alert.querySelector("h1")?.textContent).toBe(dict.store.states.errorTitle);
      fireEvent.click(screen.getByRole("button", { name: dict.store.states.retry }));
      expect(reset).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("link", { name: dict.common.goHome }).getAttribute("href")).toBe(`/${locale}`);
      expect(document.body.textContent).not.toContain("boom"); // never the error message
    });
  }
});

describe("global error boundary", () => {
  it("renders a full bilingual document with a title, lang/dir per part and no error text", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const html = renderToStaticMarkup(<GlobalError error={new Error("secret stack")} reset={() => {}} />);
    expect(html).toMatch(/^<html lang="ar" dir="rtl"/);
    expect(html).toContain("<title>");
    expect(html).toContain('lang="en" dir="ltr"');
    expect(html).toContain('href="/ar"');
    expect(html).toContain('href="/en"');
    expect((html.match(/<button/g) || []).length).toBe(2);
    expect(html).not.toContain("secret stack");
  });
});
