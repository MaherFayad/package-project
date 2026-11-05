import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { STRUCTURE_CODES } from "@/types";
import { validateDims } from "@/lib/dieline";
import {
  SEO_SIZES,
  STRUCTURE_SLUGS,
  designHref,
  formatCm,
  parseSizeSlug,
  parseValidSize,
  seoSizeParams,
  sizeHref,
  sizeSlug,
  structureFromSlug,
} from "../catalog";

describe("structure slugs", () => {
  it("round-trips every structure code", () => {
    for (const c of STRUCTURE_CODES) expect(structureFromSlug(STRUCTURE_SLUGS[c])).toBe(c);
    expect(structureFromSlug("nope")).toBeNull();
  });

  it("matches the slugs seeded in prisma/seed.ts", () => {
    const seed = readFileSync(path.resolve(__dirname, "../../../../prisma/seed.ts"), "utf8");
    for (const c of STRUCTURE_CODES) expect(seed).toContain(`slug: "${STRUCTURE_SLUGS[c]}"`);
  });
});

describe("size slugs", () => {
  it("formats and parses", () => {
    expect(sizeSlug({ L: 300, W: 200, H: 150 })).toBe("300x200x150");
    expect(parseSizeSlug("300x200x150")).toEqual({ L: 300, W: 200, H: 150 });
    expect(parseSizeSlug("300X200X150")).toEqual({ L: 300, W: 200, H: 150 });
    expect(parseSizeSlug(encodeURIComponent("300×200×150"))).toEqual({ L: 300, W: 200, H: 150 });
  });

  it("rejects junk and out-of-range sizes", () => {
    expect(parseSizeSlug("300x200")).toBeNull();
    expect(parseSizeSlug("3x2x1")).toBeNull();
    expect(parseSizeSlug("300x200x150; drop")).toBeNull();
    expect(parseValidSize("FEFCO_0427", "250x180x80")).toEqual({ L: 250, W: 180, H: 80 });
    expect(parseValidSize("FEFCO_0427", "250x180x200")).toBeNull(); // H <= W rule
    expect(parseValidSize("PIZZA", "300x250x40")).toBeNull(); // L == W rule
    expect(parseValidSize("ECMA_RTE", "9999x50x100")).toBeNull();
  });

  it("every SEO size is valid for its structure and unique", () => {
    for (const c of STRUCTURE_CODES) {
      const seen = new Set<string>();
      for (const d of SEO_SIZES[c]) {
        expect(validateDims(c, d).ok, `${c} ${sizeSlug(d)}`).toBe(true);
        expect(seen.has(sizeSlug(d))).toBe(false);
        seen.add(sizeSlug(d));
      }
    }
    expect(seoSizeParams().length).toBe(STRUCTURE_CODES.reduce((n, c) => n + SEO_SIZES[c].length, 0));
  });

  it("formats centimetres for Arabic search titles", () => {
    expect(formatCm({ L: 300, W: 200, H: 150 })).toBe("30×20×15");
    expect(formatCm({ L: 55, W: 45, H: 130 })).toBe("5.5×4.5×13");
  });
});

describe("links", () => {
  it("builds designer deep links", () => {
    expect(designHref("ar")).toBe("/ar/design");
    expect(designHref("en", { structure: "FEFCO_0427", dims: { L: 250, W: 180, H: 80 }, material: "E_FLUTE_KRAFT", vendor: "nile-pack" })).toBe(
      "/en/design?structure=FEFCO_0427&L=250&W=180&H=80&material=E_FLUTE_KRAFT&vendor=nile-pack",
    );
    expect(designHref("ar", { design: "abc123" })).toBe("/ar/design?design=abc123");
  });

  it("builds SEO size links", () => {
    expect(sizeHref("ar", "PIZZA", { L: 310, W: 310, H: 40 })).toBe("/ar/boxes/pizza-box/310x310x40");
  });
});
