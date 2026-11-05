import { describe, expect, it } from "vitest";
import { STRUCTURE_CODES } from "@/types";
import { VESSEL_KINDS } from "@/lib/vessels/types";
import {
  AVAILABILITY,
  EGYPT_CLUSTERS,
  PRINT_METHODS,
  REGIONS,
  REGULATORY,
  SOURCES,
  STRUCTURE_TO_AVAILABILITY,
  VESSEL_TO_AVAILABILITY,
  availabilityFor,
  availabilityForSlug,
  availabilityForStandard,
  subFamiliesOf,
} from "./index";

const entries = Object.entries(AVAILABILITY);

describe("AVAILABILITY shape", () => {
  it("has families and sub-families", () => {
    expect(entries.length).toBeGreaterThan(60);
    expect(entries.filter(([, e]) => !e.family).length).toBeGreaterThanOrEqual(12);
  });

  it.each(entries)("%s is well formed", (key, e) => {
    expect(e.slug).toBe(key);
    if (e.family) {
      expect(key.startsWith(`${e.family}/`)).toBe(true);
      expect(AVAILABILITY[e.family]).toBeDefined();
    } else {
      expect(key).not.toContain("/");
    }
    expect(["local", "imported", "rare"]).toContain(e.egypt);
    expect(e.name.ar.length).toBeGreaterThan(0);
    expect(e.name.en.length).toBeGreaterThan(0);
    expect(e.name.ar).not.toMatch(/[ً-ْ]/); // no diacritics
    expect(e.egyptPrintMethods.length).toBeGreaterThan(0);
    for (const m of e.egyptPrintMethods) expect(PRINT_METHODS).toContain(m);
    for (const c of e.clusters) expect(EGYPT_CLUSTERS).toContain(c);
    expect(e.clusters.length).toBeGreaterThan(0);
    expect(e.sizes.length).toBeGreaterThan(0);
    expect(e.manufacturerTypes.length).toBeGreaterThan(0);
    expect(e.moq.min).toBeGreaterThan(0);
    expect(e.moq.min).toBeLessThanOrEqual(e.moq.max);
    expect(e.leadTimeDays.min).toBeGreaterThan(0);
    expect(e.leadTimeDays.min).toBeLessThanOrEqual(e.leadTimeDays.max);
    if (e.priceBandEGP) {
      expect(e.priceBandEGP.min).toBeGreaterThan(0);
      expect(e.priceBandEGP.min).toBeLessThanOrEqual(e.priceBandEGP.max);
      expect(e.priceBandEGP.estimate).toBe(true);
      expect(e.priceBandEGP.asOf).toMatch(/^\d{4}-\d{2}$/);
      expect(e.priceBandEGP.basis.length).toBeGreaterThan(10);
    }
    for (const r of REGIONS) expect(e.regions[r]?.note.length).toBeGreaterThan(0);
    for (const id of e.regulatory) expect(REGULATORY[id], id).toBeDefined();
    expect(e.sources.length).toBeGreaterThan(0);
    for (const id of e.sources) expect(SOURCES[id], id).toBeDefined();
  });

  it("every regulatory note cites known sources and Egypt notes exist", () => {
    for (const n of Object.values(REGULATORY)) for (const s of n.sources) expect(SOURCES[s], s).toBeDefined();
    for (const id of ["eg-nfsa-fcm", "eg-food-labelling", "eg-eda-pharma", "eg-vat", "eg-epr", "eg-recycling-marks"]) expect(REGULATORY[id]).toBeDefined();
  });

  it("source URLs look like URLs or repo paths", () => {
    for (const s of Object.values(SOURCES)) expect(s.url).toMatch(/^(https:\/\/|docs\/)/);
  });
});

describe("mapping", () => {
  it("maps every current structure code and vessel kind", () => {
    for (const c of STRUCTURE_CODES) expect(AVAILABILITY[STRUCTURE_TO_AVAILABILITY[c]!], c).toBeDefined();
    for (const k of VESSEL_KINDS) expect(AVAILABILITY[VESSEL_TO_AVAILABILITY[k]!], k).toBeDefined();
  });

  it("resolves standard codes", () => {
    expect(availabilityForStandard("FEFCO 0427")?.slug).toBe("corrugated/fefco-04");
    expect(availabilityForStandard("FEFCO_0201")?.slug).toBe("corrugated/fefco-02");
    expect(availabilityForStandard("0910")?.slug).toBe("corrugated/fefco-09");
    expect(availabilityForStandard("FEFCO 0110")?.slug).toBe("corrugated");
    expect(availabilityForStandard("ECMA A60.20")?.slug).toBe("folding-carton/ecma-glued");
    expect(availabilityForStandard("A20.20")?.slug).toBe("folding-carton/ecma-tuck");
    expect(availabilityForStandard("ECMA B12.01")?.slug).toBe("folding-carton/ecma-tray");
    expect(availabilityForStandard("PCO 1881")).toBeUndefined();
  });

  it("falls back from sub-family to family", () => {
    expect(availabilityForSlug("flexible/unknown-thing")?.slug).toBe("flexible");
    expect(availabilityFor({ family: "metal", subFamily: "aerosol" })?.egypt).toBe("rare");
    expect(availabilityFor({ structureCode: "PIZZA" })?.slug).toBe("corrugated/fefco-04");
    expect(availabilityFor({ vesselKind: "CAN" })?.slug).toBe("metal/beverage-can");
    expect(availabilityFor({ structureCode: "NEW_CODE", standard: "FEFCO 0711" })?.slug).toBe("corrugated/fefco-07");
    expect(availabilityFor({})).toBeUndefined();
    expect(subFamiliesOf("corrugated").length).toBe(7);
  });
});
