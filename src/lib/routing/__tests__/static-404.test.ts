/** R6-RS-11: the middleware's known-missing check (src/lib/routing/static-404.ts). */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isKnownMissing, NOT_FOUND_SEGMENT, TOP_SEGMENTS } from "../static-404";
import { LEGAL_DOC_IDS } from "@/components/store/legal";

function topSegments(dir: string, out = new Set<string>()): Set<string> {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    if (/^\(.*\)$/.test(e.name)) topSegments(path.join(dir, e.name), out);
    else if (!e.name.startsWith("_") && !e.name.startsWith("[")) out.add(e.name);
  }
  return out;
}

describe("static 404 routing", () => {
  it("TOP_SEGMENTS lists exactly the route segments under src/app/[locale] (add new top-level routes there)", () => {
    const fsSegments = topSegments(path.join(process.cwd(), "src/app/[locale]"));
    fsSegments.delete(NOT_FOUND_SEGMENT);
    expect([...TOP_SEGMENTS].sort()).toEqual([...fsSegments].sort());
  });

  it("never treats a real page as missing", () => {
    for (const seg of TOP_SEGMENTS) if (seg !== "s") expect(isKnownMissing([seg]), seg).toBe(false); // /s alone has no page
    expect(isKnownMissing([])).toBe(false);
    expect(isKnownMissing(["vendors", "any-printer"])).toBe(false); // needs the database: left to notFound()
    expect(isKnownMissing(["orders", "ELB-99999"])).toBe(false);
    expect(isKnownMissing(["s", "rf_CZMTsKqxP2TQH"])).toBe(false); // a 16-character token
    for (const doc of LEGAL_DOC_IDS) expect(isKnownMissing(["legal", doc])).toBe(false);
  });

  it("answers the static 404 for unknown first segments, malformed share tokens and unknown legal docs", () => {
    expect(isKnownMissing(["no-such-page"])).toBe(true);
    expect(isKnownMissing(["no-such-page", "deeper"])).toBe(true);
    expect(isKnownMissing([NOT_FOUND_SEGMENT])).toBe(true);
    expect(isKnownMissing(["s"])).toBe(true);
    expect(isKnownMissing(["s", "no-such-token-123"])).toBe(true);
    expect(isKnownMissing(["s", "rf_CZMTsKqxP2TQH", "extra"])).toBe(true);
    expect(isKnownMissing(["legal", "no-such-policy"])).toBe(true);
  });
});

describe("editor model check matches lib/library modelFromParam", () => {
  it("agrees on every slug and code, and on unknown values", async () => {
    const { modelFromParam } = await import("@/lib/library");
    const { MODEL_INDEX } = await import("@/lib/library/model-index.generated");
    const { isEditorModel } = await import("../static-404");
    const samples = [
      ...Object.values(MODEL_INDEX).map(([, slug]) => slug),
      ...Object.keys(MODEL_INDEX),
      ...Object.keys(MODEL_INDEX).map((c) => c.toLowerCase().replace(/_/g, "-")),
      "no-such-model", "nope", "MAILER-BOX", "%E0%A4%A", "fefco-9999",
    ];
    for (const s of samples) expect(isEditorModel(s), s).toBe(!!(() => { try { return modelFromParam(s); } catch { return null; } })());
    expect(isKnownMissing(["design", "no-such-model"])).toBe(true);
    expect(isKnownMissing(["design", Object.values(MODEL_INDEX)[0]![1]])).toBe(false);
  });
});

describe("R5-PL-19: generated slug sets", () => {
  it("route-slugs.generated.ts is current (npx tsx scripts/generate-route-slugs.ts)", async () => {
    const { compute, render } = await import("../../../../scripts/generate-route-slugs");
    const cur = fs.readFileSync(path.join(process.cwd(), "src/lib/routing/route-slugs.generated.ts"), "utf8");
    expect(cur).toBe(render(compute()));
  });

  it("accepts every real catalogue model (slug and code, any case) and every redirecting structure URL", async () => {
    const { CATALOGUE, catalogueEntryFromParam } = await import("@/data/catalogue");
    const { STRUCTURE_LIST } = await import("@/lib/dieline");
    for (const e of CATALOGUE) {
      for (const p of [e.slug, e.slug.toUpperCase(), e.code, e.code.toLowerCase()]) {
        expect(isKnownMissing(["catalog", p]), p).toBe(!catalogueEntryFromParam(p));
      }
    }
    for (const s of STRUCTURE_LIST) expect(isKnownMissing(["catalog", s.slug]), s.slug).toBe(false);
    expect(isKnownMissing(["catalog", "no-such-model"])).toBe(true);
    expect(isKnownMissing(["catalog", CATALOGUE[0]!.slug, "extra"])).toBe(true);
  });

  it("accepts every box style and every SEO size page; rejects unknown styles and malformed sizes", async () => {
    const { STRUCTURE_SLUGS, seoSizeParams, structureFromSlug, parseSizeSlug } = await import("@/components/store/catalog");
    for (const slug of Object.values(STRUCTURE_SLUGS)) expect(isKnownMissing(["boxes", slug]), slug).toBe(!structureFromSlug(slug));
    for (const { structure, size } of seoSizeParams()) expect(isKnownMissing(["boxes", structure, size]), `${structure}/${size}`).toBe(false);
    const any = Object.values(STRUCTURE_SLUGS)[0]!;
    for (const size of ["300X200X150", "300×200×150", "99x99x99"]) expect(isKnownMissing(["boxes", any, size]), size).toBe(!parseSizeSlug(size));
    expect(isKnownMissing(["boxes", "no-such-style"])).toBe(true);
    expect(isKnownMissing(["boxes", any, "big"])).toBe(true);
    expect(isKnownMissing(["boxes", any, "300x200x150", "x"])).toBe(true);
  });

  it("paths below pages without children are unknown", async () => {
    const { LEAF_SEGMENTS } = await import("../route-slugs.generated");
    expect(LEAF_SEGMENTS).toContain("bottles");
    for (const leaf of LEAF_SEGMENTS) {
      if (leaf !== NOT_FOUND_SEGMENT) expect(isKnownMissing([leaf]), leaf).toBe(false);
      expect(isKnownMissing([leaf, "x"]), leaf).toBe(true);
    }
  });
});
