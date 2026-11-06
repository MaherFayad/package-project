// @vitest-environment jsdom
/** R5-PL-08: per-area client dictionaries (src/i18n/scope.ts, scripts/generate-i18n-scopes.ts). */
import fs from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { computeScopes, render as renderScopes } from "../../../scripts/generate-i18n-scopes";
import { getDictionary, lookup } from "@/i18n";
import { I18nProvider, useI18n } from "@/i18n/client";
import { mergeDictionaries, scopedDictionary } from "@/i18n/scope";
import { I18N_SCOPES, type I18nScopeName } from "@/i18n/scopes.generated";

const kb = (o: unknown) => Buffer.byteLength(JSON.stringify(o)) / 1024;
const scopes = Object.keys(I18N_SCOPES) as I18nScopeName[];

describe("i18n scopes", () => {
  const fresh = computeScopes();

  it("scopes.generated.ts is up to date (npx tsx scripts/generate-i18n-scopes.ts)", () => {
    const cur = fs.readFileSync(path.join(process.cwd(), "src/i18n/scopes.generated.ts"), "utf8");
    expect(cur).toBe(renderScopes(fresh));
  });

  it("the root scope stays small: under 40 KB raw in Arabic (was 99.7 KB for the whole public dictionary)", () => {
    expect(kb(scopedDictionary("ar", "root"))).toBeLessThan(40);
    expect(kb(scopedDictionary("en", "root"))).toBeLessThan(30);
  });

  it("legal and notify never reach the browser", () => {
    for (const s of scopes) for (const l of ["ar", "en"] as const) {
      const d = scopedDictionary(l, s) as unknown as Record<string, unknown>;
      expect(d.legal).toBeUndefined();
      expect(d.notify).toBeUndefined();
    }
  });

  it("every key a scope's code names resolves in root + that scope, in both locales", () => {
    for (const l of ["ar", "en"] as const) {
      const full = getDictionary(l);
      const root = scopedDictionary(l, "root");
      for (const s of scopes) {
        const dict = s === "root" ? root : mergeDictionaries(root, scopedDictionary(l, s));
        for (const key of [...fresh.root, ...(fresh[s] ?? [])]) {
          if (key.endsWith(".") || /^(legal|notify)\./.test(key)) continue;
          const want = lookup(full, key);
          if (want === key) continue; // not a real key (a CSS class, a route, …)
          expect(lookup(dict, key), `${l} ${s}: ${key}`).toBe(want);
        }
      }
    }
  });

  it("nested providers merge the area dictionary into the root one", () => {
    function Probe() {
      const { t } = useI18n();
      return <p>{t("mk.nav.menu")} | {t("designer.untitled")}</p>;
    }
    render(
      <I18nProvider locale="en" dict={scopedDictionary("en", "root")}>
        <I18nProvider locale="en" dict={scopedDictionary("en", "design")}>
          <Probe />
        </I18nProvider>
      </I18nProvider>,
    );
    const full = getDictionary("en");
    expect(screen.getByText(`${lookup(full, "mk.nav.menu")} | ${lookup(full, "designer.untitled")}`)).toBeTruthy();
  });
});
