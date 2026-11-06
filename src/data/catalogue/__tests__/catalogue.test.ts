import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MODELS } from "@/lib/library";
import { AVAILABILITY } from "@/data/packaging-availability";
import { REGIONS } from "@/data/packaging-availability/types";
import { matchesQuery } from "@/lib/library/search";
import * as F02 from "@/lib/dieline/families/fefco-02";
import * as F0305 from "@/lib/dieline/families/fefco-03-05";
import * as F04 from "@/lib/dieline/families/fefco-04";
import * as F0607 from "@/lib/dieline/families/fefco-06-07";
import * as F09 from "@/lib/dieline/families/fefco-09";
import * as TUCK from "@/lib/dieline/families/ecma-tuck";
import * as SPEC from "@/lib/dieline/families/ecma-specials";
import * as FOOD from "@/lib/dieline/families/foodservice";
import * as RT from "@/lib/dieline/families/rigid-tubes";
import * as BTL from "@/lib/vessels/families/bottles";
import * as COS from "@/lib/vessels/families/cosmetic-cans";
import * as FLEX from "@/lib/vessels/families/flexible";
import { CATALOGUE, CATALOGUE_FAMILIES, catalogueCounts, catalogueEntry, catalogueEntryFromParam, standardOf, taxonomy } from "..";

const FAMILY_DEFS = [F02, F0305, F04, F0607, F09, TUCK, SPEC, FOOD, RT, BTL, COS, FLEX].flatMap((m) => (m.DEFINITIONS as unknown as { code: string }[]).map((d) => d.code));

describe("catalogue coverage", () => {
  it("has every model of every family folder and of the library, once", () => {
    const codes = CATALOGUE.map((e) => e.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const c of FAMILY_DEFS) expect(codes, c).toContain(c);
    for (const m of MODELS) expect(codes, m.code).toContain(m.code);
    expect(codes.length).toBe(new Set([...FAMILY_DEFS, ...MODELS.map((m) => m.code)]).size);
    expect(codes.length).toBeGreaterThanOrEqual(400);
  });

  it("dedupes family models already in the library (the library row wins)", () => {
    // FEFCO 0201 is both the core shipping box and a fefco-02 definition: one row, core source.
    expect(CATALOGUE.filter((e) => e.code === "FEFCO_0201")).toHaveLength(1);
    expect(catalogueEntry("FEFCO_0201")!.source).toBe("core");
    expect(catalogueEntry("FEFCO_0320")!.source).toBe("core");
  });

  it("has unique, URL-safe slugs", () => {
    const slugs = CATALOGUE.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9-]+$/);
  });

  it("marks library models designer-ready and the rest quote-only", () => {
    const lib = new Set(MODELS.map((m) => m.code));
    for (const e of CATALOGUE) {
      expect(e.designer, e.code).toBe(lib.has(e.code));
      expect(e.quoteOnly, e.code).toBe(!lib.has(e.code));
    }
  });
});

describe("taxonomy and availability", () => {
  it.each(CATALOGUE.map((e) => [e.code, e] as const))("%s has family, sub-family, standard, Egypt availability and regions", (_c, e) => {
    expect(CATALOGUE_FAMILIES as readonly string[]).toContain(e.family);
    expect(AVAILABILITY[e.subFamily], e.subFamily).toBeTruthy();
    expect(e.subFamily.split("/")[0]).toBe(e.family);
    expect(["local", "imported", "rare"]).toContain(e.availableInEgypt);
    expect(e.availableInEgypt).toBe(AVAILABILITY[e.subFamily].egypt);
    expect(e.regions.length).toBeGreaterThan(0);
    for (const r of e.regions) expect(REGIONS).toContain(r);
    expect(["FEFCO", "ECMA", "none"]).toContain(e.standard.system);
    if (e.code.startsWith("FEFCO_")) expect(e.standard.system).toBe("FEFCO");
    if (e.standard.system !== "none") expect(e.standard.code).toBeTruthy();
    expect(e.name.ar.length).toBeGreaterThan(1);
    expect(e.name.en.length).toBeGreaterThan(1);
    expect(e.axes.length).toBeGreaterThan(1);
  });

  it("files FEFCO styles by series and liquid cartons, octabins and cups where traders do", () => {
    expect(catalogueEntry("FEFCO_0427")!.subFamily).toBe("corrugated/fefco-04");
    expect(catalogueEntry("FEFCO_0711")!.subFamily).toBe("corrugated/fefco-07");
    expect(catalogueEntry("FEFCO_0933")!.subFamily).toBe("corrugated/fefco-09");
    expect(catalogueEntry("FEFCO_0350")!.subFamily).toBe("pallet-box/octabin");
    expect(catalogueEntry("LIQUID_ASEPTIC_BRICK")!.subFamily).toBe("folding-carton/aseptic-liquid");
    expect(catalogueEntry("FS_CUP_DOUBLE")!.subFamily).toBe("food-service/paper-cup");
    expect(catalogueEntry("PH-BLISTER")!.subFamily).toBe("cosmetic-pharma/blister");
    expect(catalogueEntry("FLEX_STAND_UP_POUCH")!.subFamily).toBe("flexible/stand-up-pouch");
  });

  it("parses FEFCO variants and ECMA codes", () => {
    expect(standardOf("FEFCO_0421_1", "FEFCO 0421.1")).toEqual({ system: "FEFCO", code: "0421.1", label: "FEFCO 0421.1" });
    expect(standardOf("FEFCO_0415a", "FEFCO 0415a").code).toBe("0415a");
    expect(standardOf("ECMA_TUCK_CRASH_LOCK", "ECMA A60.20.00.03")).toMatchObject({ system: "ECMA", code: "A60.20.00.03" });
    expect(standardOf("CONE", "none")).toEqual({ system: "none", code: null, label: "" });
    expect(standardOf("ENVELOPE_DOCUMENT", "ISO 269 (C4)")).toEqual({ system: "none", code: null, label: "ISO 269 (C4)" });
  });

  it("builds a taxonomy with every sub-family in use", () => {
    const tree = taxonomy(CATALOGUE.map((e) => e.subFamily));
    const subs = new Set(tree.flatMap((n) => n.children.map((c) => c.slug)));
    for (const e of CATALOGUE) if (e.subFamily.includes("/")) expect(subs).toContain(e.subFamily);
    const c = catalogueCounts();
    expect(Object.values(c.byFamily).reduce((a, b) => a + b, 0)).toBe(c.total);
    expect(c.byEgypt.local + c.byEgypt.imported + c.byEgypt.rare).toBe(c.total);
  });
});

describe("search", () => {
  const find = (q: string) => CATALOGUE.filter((e) => matchesQuery(e, q)).map((e) => e.code);
  it("finds by FEFCO / ECMA code, in any form", () => {
    expect(find("FEFCO 0427")).toContain("FEFCO_0427");
    expect(find("fefco_0427")).toContain("FEFCO_0427");
    expect(find("0421.1")).toContain("FEFCO_0421_1");
    expect(find("A60.20")).toContain("ECMA_TUCK_CRASH_LOCK");
  });
  it("finds by Arabic and English names, with Arabic letter variants folded", () => {
    expect(find("كوب")).toContain("FS_CUP_DOUBLE");
    expect(find("paper cup")).toContain("FS_CUP_SINGLE");
    expect(find("علبه بريديه")).toContain("FEFCO_0427");
    expect(find("كرتون مضلع").length).toBeGreaterThan(100);
  });
  it("resolves a slug or a code", () => {
    const e = catalogueEntry("FS_PULP_EGG_6")!;
    expect(catalogueEntryFromParam(e.slug)?.code).toBe("FS_PULP_EGG_6");
    expect(catalogueEntryFromParam("fs_pulp_egg_6")?.code).toBe("FS_PULP_EGG_6");
  });
});

describe("thumbnails", () => {
  it("every model has a rendered 3D thumbnail (public/models/<code>.webp), never a blank placeholder", () => {
    const dir = path.resolve("public/models");
    const missing = CATALOGUE.filter((e) => !fs.existsSync(path.join(dir, `${e.code}.webp`))).map((e) => e.code);
    expect(missing).toEqual([]);
    for (const e of CATALOGUE) expect(fs.statSync(path.join(dir, `${e.code}.webp`)).size, e.code).toBeGreaterThan(1500);
  });
});

describe("library openTop flag (designer: 'Assembled' rather than 'Closed')", () => {
  it("marks trays, open styles and fittings, not lidded or telescope styles", async () => {
    const { boxModel } = await import("@/lib/library");
    for (const c of ["FEFCO_0422", "FEFCO_0200", "FEFCO_0435", "FEFCO_0501", "ECMA_TRAY_4C", "FEFCO_0901"]) expect(boxModel(c)?.openTop, c).toBe(true);
    for (const c of ["FEFCO_0427", "FEFCO_0201", "FEFCO_0421", "FEFCO_0320", "FEFCO_0300", "ECMA_TRAY_6C_LID", "FEFCO_0615", "ECMA_RTE"]) expect(boxModel(c)?.openTop, c).toBeFalsy();
  });
});
