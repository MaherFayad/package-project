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
    expect(isKnownMissing(["catalog", "any-model"])).toBe(false); // needs a lookup: left to notFound()
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
