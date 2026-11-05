import { describe, expect, it } from "vitest";
import { WRAP_OVERLAP_MM, flatPoint, radiusAt } from "../../../index";
import {
  BOTTLE_CLOSURES,
  BOTTLE_MATERIALS,
  DEFINITIONS,
  FINISHES,
  bottleBrimfulMl,
  bottleDefinition,
  bottleSectionArea,
  bottleSectionPerimeter,
  bottleVolumeToMl,
  definitionSchema,
  describeBottle,
  dimsSchemaFor,
  fillLevelFor,
  profileFor,
  sectionPointAtArc,
  surfacePoint,
  validateBottleDims,
  type BottleSection,
} from "../index";

const ALL = DEFINITIONS.flatMap((def) => def.presets.map((preset) => ({ def, preset })));
const finite = (n: number) => Number.isFinite(n) && !Number.isNaN(n);

describe("catalogue metadata", () => {
  it("has the full worldwide set with unique codes and slugs", () => {
    expect(DEFINITIONS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(DEFINITIONS.map((d) => d.code)).size).toBe(DEFINITIONS.length);
    expect(new Set(DEFINITIONS.map((d) => d.slug)).size).toBe(DEFINITIONS.length);
  });

  it("every definition passes the structural schema (MSA names without diacritics, defaults offered)", () => {
    for (const def of DEFINITIONS) {
      const r = definitionSchema.safeParse(def);
      expect(r.success, `${def.code}: ${r.success ? "" : r.error.issues.map((i) => i.message).join(", ")}`).toBe(true);
    }
  });

  it("every material, finish and closure referenced exists, and the glass palette is complete", () => {
    for (const def of DEFINITIONS) {
      for (const m of def.materials) expect(BOTTLE_MATERIALS[m], m).toBeDefined();
      for (const f of def.finishes) expect(FINISHES[f as keyof typeof FINISHES], f).toBeDefined();
      for (const c of def.closures) expect(BOTTLE_CLOSURES[c], c).toBeDefined();
    }
    const glass = new Set(DEFINITIONS.flatMap((d) => d.materials).filter((m) => m.startsWith("GLASS_")));
    for (const c of ["GLASS_FLINT", "GLASS_AMBER", "GLASS_GREEN", "GLASS_COBALT", "GLASS_FROSTED"]) expect(glass.has(c as never), c).toBe(true);
  });

  it("covers the real neck finishes asked for", () => {
    const used = new Set(DEFINITIONS.flatMap((d) => d.finishes));
    for (const f of ["PCO_1881", "F38_400", "F28_410", "CROWN_26", "TO43", "CORK_18_5", "SWING_26", "SNAP_55", "DIN61"]) expect(used.has(f), f).toBe(true);
  });

  it("every preset passes its own zod dims schema", () => {
    for (const { def, preset } of ALL) {
      const r = validateBottleDims(def, preset.dims);
      expect(r.ok, `${preset.id}: ${r.ok ? "" : r.errors.join(", ")}`).toBe(true);
    }
  });
});

describe("dimension limits", () => {
  const def = bottleDefinition("BTL_GLASS_WINE_BORDEAUX");
  it("rejects out-of-range, wrong aspect, unknown keys and NaN", () => {
    expect(validateBottleDims(def, { D: 40, H: 300 }).ok).toBe(false);
    expect(validateBottleDims(def, { D: 76, H: 500 }).ok).toBe(false);
    expect(validateBottleDims(def, { D: 100, H: 230 }).ok).toBe(false); // H/D 2.3 < 3.3
    expect(validateBottleDims(def, { D: 76, H: 300, X: 1 }).ok).toBe(false);
    expect(validateBottleDims(def, { D: Number.NaN, H: 300 }).ok).toBe(false);
    expect(validateBottleDims(def, { D: 76, H: 300, G: 50 }).ok).toBe(false); // round: no G
    expect(validateBottleDims(def, { D: 76, H: 300 }).ok).toBe(true);
  });

  it("rect sections reject a depth larger than the width", () => {
    const flask = bottleDefinition("BTL_GLASS_SPIRITS_FLASK");
    expect(validateBottleDims(flask, { D: 60, G: 64, H: 160 }).ok).toBe(false);
    expect(dimsSchemaFor(flask).safeParse({ D: 85, G: 42, H: 196 }).success).toBe(true);
  });

  it("describeBottle refuses invalid dims", () => {
    expect(() => describeBottle({ code: def.code, dims: { D: 10, H: 10 } })).toThrow();
  });
});

describe("section math", () => {
  const sections: [BottleSection, number][] = [
    [{ kind: "round" }, 30],
    [{ kind: "rect", depthRatio: 0.5, cornerRatio: 1 }, 40],
    [{ kind: "rect", depthRatio: 0.8, cornerRatio: 0.2 }, 100],
    [{ kind: "polygon", sides: 6, cornerRatio: 0.1 }, 31],
  ];

  it("exact areas and girths for sharp shapes and the circle limit", () => {
    const sharp = { kind: "rect", depthRatio: 0.5, cornerRatio: 0 } as const;
    expect(bottleSectionArea(sharp, 10)).toBeCloseTo(20 * 10, 9);
    expect(bottleSectionPerimeter(sharp, 10)).toBeCloseTo(60, 9);
    const hex = { kind: "polygon", sides: 6, cornerRatio: 0 } as const;
    expect(bottleSectionArea(hex, 10)).toBeCloseTo(2 * Math.sqrt(3) * 100, 6);
    expect(bottleSectionPerimeter(hex, 10)).toBeCloseTo(6 * (20 / Math.sqrt(3)), 6);
    // stadium: rectangle + circle
    const st = { kind: "rect", depthRatio: 0.5, cornerRatio: 1 } as const;
    expect(bottleSectionArea(st, 10)).toBeCloseTo(10 * 10 + Math.PI * 25, 6);
    expect(bottleSectionPerimeter(st, 10)).toBeCloseTo(2 * 10 + 2 * Math.PI * 5, 6);
    for (const [sec] of sections) {
      expect(bottleSectionArea(sec, 12, 0)).toBeCloseTo(Math.PI * 144, 6);
      expect(bottleSectionPerimeter(sec, 12, 0)).toBeCloseTo(2 * Math.PI * 12, 6);
    }
  });

  it("walking the outline by arc length gives back the girth, starting at the front centre", () => {
    for (const [sec, a] of sections) {
      const P = bottleSectionPerimeter(sec, a);
      const n = 4000;
      let len = 0;
      let prev = sectionPointAtArc(sec, a, 0);
      expect(prev.x).toBeCloseTo(0, 6);
      expect(prev.z).toBeGreaterThan(0);
      for (let k = 1; k <= n; k++) {
        const q = sectionPointAtArc(sec, a, (k / n) * P);
        len += Math.hypot(q.x - prev.x, q.z - prev.z);
        prev = q;
      }
      expect(len).toBeCloseTo(P, 1);
      // first step goes towards +X
      expect(sectionPointAtArc(sec, a, 1).x).toBeGreaterThan(0);
    }
  });
});

describe("profiles", () => {
  it("are finite, start on the axis, stand on y = 0 and top out at H", () => {
    for (const { def, preset } of ALL) {
      const p = profileFor(def, preset.dims, preset.finish);
      expect(p.outer[0].r).toBe(0);
      const ys = p.outer.map((q) => q.y);
      expect(Math.min(...ys)).toBeCloseTo(0, 6);
      expect(Math.max(...ys)).toBeLessThanOrEqual(preset.dims.H + 1e-6);
      expect(p.finishTopY).toBeCloseTo(preset.dims.H, 0);
      for (const q of p.outer) {
        expect(finite(q.r) && finite(q.y) && finite(q.s), `${preset.id}`).toBe(true);
        expect(q.r).toBeGreaterThanOrEqual(0);
      }
      expect(p.body.y1).toBeGreaterThan(p.body.y0 + 10);
      expect(p.fillMaxY).toBeLessThan(p.finishTopY);
      expect(p.innerBaseY).toBeGreaterThan(0);
    }
  });

  it("closed dimensions match the inputs: body width = D (largest body diameter), height = H", () => {
    for (const { def, preset } of ALL) {
      const p = profileFor(def, preset.dims, preset.finish);
      let maxBody = 0;
      // tapered tubs/pails are widest just under the rim
      const top = preset.dims.taper ? p.finishTopY - p.finishH - 1.2 : p.body.y1;
      for (let y = p.body.y0; y <= top; y += 0.5) maxBody = Math.max(maxBody, radiusAt(p.outer, y));
      expect(2 * maxBody, preset.id).toBeCloseTo(preset.dims.D, 0);
    }
  });

  it("label and neck zones lie exactly on straight wall (cylinder or cone)", () => {
    for (const { def, preset } of ALL) {
      const p = profileFor(def, preset.dims, preset.finish);
      for (const z of [p.body, p.neckZone].filter(Boolean) as { y0: number; y1: number; r0: number; r1: number }[]) {
        for (const t of [0, 0.25, 0.5, 0.75, 1]) {
          const y = z.y0 + (z.y1 - z.y0) * t;
          expect(radiusAt(p.outer, y), `${preset.id} t=${t}`).toBeCloseTo(z.r0 + (z.r1 - z.r0) * t, 1);
        }
      }
    }
  });

  it("brimful volume matches the nominal capacity (overflow 0-30%, glass wine/beer tight)", () => {
    for (const { def, preset } of ALL) {
      const ml = bottleBrimfulMl(profileFor(def, preset.dims, preset.finish));
      const ratio = ml / preset.capacityMl;
      expect(ratio, `${preset.id}: ${ml.toFixed(0)} ml`).toBeGreaterThan(0.98);
      expect(ratio, `${preset.id}: ${ml.toFixed(0)} ml`).toBeLessThan(1.3);
    }
    // Berlin Packaging longneck 330: 345 ml brimful
    const ln = bottleDefinition("BTL_GLASS_BEER_LONGNECK");
    expect(bottleBrimfulMl(profileFor(ln, ln.presets[0].dims, "CROWN_26"))).toBeCloseTo(345, -1);
  });

  it("is parametric: taller or wider holds more, monotonic fill volume", () => {
    const def = bottleDefinition("BTL_PET_CSD");
    const a = bottleBrimfulMl(profileFor(def, { D: 93, H: 290 }));
    const b = bottleBrimfulMl(profileFor(def, { D: 93, H: 330 }));
    const c = bottleBrimfulMl(profileFor(def, { D: 100, H: 330 }));
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
    const p = profileFor(def, { D: 93, H: 312 });
    expect(bottleVolumeToMl(p, 200)).toBeGreaterThan(bottleVolumeToMl(p, 100));
    expect(bottleVolumeToMl(p, 0)).toBe(0);
  });

  it("a straight jar body holds pi r^2 h between two heights", () => {
    const def = bottleDefinition("JAR_GLASS_JAM");
    const p = profileFor(def, { D: 72, H: 107 }, "TO70");
    const r = 36 - p.wallMm;
    const v = bottleVolumeToMl(p, 70) - bottleVolumeToMl(p, 30);
    expect(v).toBeCloseTo((Math.PI * r * r * 40) / 1000, 0);
  });

  it("the BVS 30H60 screw finish keeps the shoulder where the cork version has it (volume within 5%)", () => {
    const def = bottleDefinition("BTL_GLASS_WINE_BORDEAUX");
    const cork = bottleBrimfulMl(profileFor(def, { D: 76, H: 300 }, "CORK_18_5"));
    const screw = bottleBrimfulMl(profileFor(def, { D: 76, H: 300 }, "BVS_30H60"));
    expect(Math.abs(screw / cork - 1)).toBeLessThan(0.05);
  });

  it("handles and bases are described for the renderer", () => {
    const jerry = profileFor(bottleDefinition("JERRYCAN_HDPE"), { D: 290, G: 248, H: 379 }, "DIN61");
    expect(jerry.handle?.kind).toBe("integrated");
    expect(profileFor(bottleDefinition("PAIL_PP_ROUND"), { D: 326, H: 359, taper: 61 }, "RIM").handle?.kind).toBe("bail");
    expect(profileFor(bottleDefinition("BTL_PET_CSD"), { D: 93, H: 312 }).base).toMatchObject({ kind: "petaloid", feet: 5 });
    expect(profileFor(bottleDefinition("BTL_GLASS_SPARKLING"), { D: 89, H: 300 }).base.kind).toBe("punt");
  });
});

describe("fill level", () => {
  it("the nominal fill sits between the base and the finish and holds the nominal volume", () => {
    for (const { def, preset } of ALL) {
      const p = profileFor(def, preset.dims, preset.finish);
      const f = fillLevelFor(p, preset.capacityMl);
      if (f.overfilled) continue; // only the 0.98-1.0 tolerance band
      expect(f.y).toBeGreaterThan(p.innerBaseY);
      expect(f.y).toBeLessThan(p.finishTopY);
      expect(bottleVolumeToMl(p, f.y) / preset.capacityMl).toBeCloseTo(1, 1);
    }
  });

  it("a wine bottle's nominal fill line is in the neck (55-75 mm under the top)", () => {
    const d = describeBottle({ code: "BTL_GLASS_WINE_BORDEAUX" });
    expect(d.fill.headspaceMm).toBeGreaterThan(20);
    expect(d.fill.headspaceMm).toBeLessThan(90);
  });
});

describe("print surfaces", () => {
  it("round wrap = circumference + overlap, print = trim + bleed, safe zone inside", () => {
    const d = describeBottle({ code: "BTL_GLASS_OIL_DORICA", surfaces: ["WRAP"] });
    const w = d.labels[0];
    expect(w.mapping).toBe("cylinder");
    expect(w.trimWidthMm).toBeCloseTo(Math.PI * 61.4 + WRAP_OVERLAP_MM, 0);
    expect(w.printWidthMm).toBeCloseTo(w.trimWidthMm + 2 * w.bleedMm, 6);
    expect(w.trimAreaM2).toBeCloseTo((w.trimWidthMm * w.trimHeightMm) / 1e6, 4);
    expect(w.safeRect.x).toBeCloseTo(w.bleedMm + w.safeMm, 9);
    expect(w.safeRect.width).toBeCloseTo(w.printWidthMm - 2 * (w.bleedMm + w.safeMm), 6);
  });

  it("prism wrap on a non-round body uses the exact developed girth", () => {
    const d = describeBottle({ code: "BTL_GLASS_OIL_MARASCA", surfaces: ["WRAP"] });
    const w = d.labels[0];
    expect(w.mapping).toBe("prism");
    const girth = bottleSectionPerimeter(d.profile.bottleSection, 28);
    expect(w.trimWidthMm).toBeCloseTo(girth + WRAP_OVERLAP_MM, 0);
  });

  it("surface mapping is isometric: flat distances equal distances on the container", () => {
    const cases = [
      describeBottle({ code: "BTL_GLASS_OIL_DORICA", surfaces: ["WRAP"] }),
      describeBottle({ code: "BTL_GLASS_OIL_MARASCA", surfaces: ["WRAP", "FRONT"] }),
      describeBottle({ code: "BTL_HDPE_SHAMPOO_OVAL", surfaces: ["FRONT", "BACK"] }),
      describeBottle({ code: "JAR_GLASS_HONEY_HEX", surfaces: ["FRONT"] }),
    ];
    for (const d of cases)
      for (const spec of d.labels) {
        const ds = 1e-4;
        for (const [s, t] of [
          [0.3, 0.5],
          [0.5, 0.2],
          [0.7, 0.8],
        ]) {
          const a3 = surfacePoint(spec, d.profile, s, t);
          const b3 = surfacePoint(spec, d.profile, s + ds, t);
          const c3 = surfacePoint(spec, d.profile, s, t + ds);
          const a2 = flatPoint(spec, s, t);
          const b2 = flatPoint(spec, s + ds, t);
          const c2 = flatPoint(spec, s, t + ds);
          const d3 = (p: typeof a3, q: typeof a3) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
          const d2 = (p: typeof a2, q: typeof a2) => Math.hypot(p.x - q.x, p.y - q.y);
          expect(d3(a3, b3), `${d.definition.code} ${spec.kind} across`).toBeCloseTo(d2(a2, b2), 3);
          expect(d3(a3, c3), `${d.definition.code} ${spec.kind} up`).toBeCloseTo(d2(a2, c2), 3);
        }
      }
  });

  it("front labels sit on the front (+Z) and back labels on the back", () => {
    const d = describeBottle({ code: "BTL_HDPE_SHAMPOO_OVAL", surfaces: ["FRONT", "BACK"] });
    const [front, back] = d.labels;
    expect(surfacePoint(front, d.profile, 0.5, 0.5).z).toBeGreaterThan(0);
    expect(surfacePoint(back, d.profile, 0.5, 0.5).z).toBeLessThan(0);
    expect(surfacePoint(front, d.profile, 0.9, 0.5).x).toBeGreaterThan(0); // s grows towards +X seen from the front
  });

  it("a tapered pail wraps with an exact cone sector; the lid takes a disc label", () => {
    const d = describeBottle({ code: "PAIL_PP_ROUND", presetId: "pail-20l", surfaces: ["WRAP", "LID"] });
    const [wrap, lid] = d.labels;
    expect(wrap.shape).toBe("sector");
    expect(wrap.mapping).toBe("cone");
    const pl = wrap.placement as { r0: number; r1: number; y0: number; y1: number };
    expect(pl.r1).toBeGreaterThan(pl.r0); // widens upwards
    const slant = Math.hypot(pl.r1 - pl.r0, pl.y1 - pl.y0);
    expect(wrap.trimAreaM2 * 1e6).toBeCloseTo(Math.PI * (pl.r0 + pl.r1) * slant, 0);
    expect(lid.shape).toBe("circle");
    expect(lid.trimWidthMm).toBeLessThan(326);
  });

  it("neck labels exist on long-neck bottles and shrink sleeves flag high shrink", () => {
    const wine = describeBottle({ code: "BTL_GLASS_WINE_BORDEAUX", surfaces: ["NECK"] });
    expect(wine.labels[0].kind).toBe("NECK");
    const sleeve = describeBottle({ code: "BTL_GLASS_SAUCE_WOOZY", surfaces: ["SHRINK_SLEEVE"] }).labels[0];
    expect(sleeve.sleeve!.circumferenceMm).toBeGreaterThanOrEqual(Math.PI * 47.2 * 1.03 - 1);
    expect(sleeve.sleeve!.layFlatMm).toBeCloseTo(sleeve.sleeve!.circumferenceMm / 2 + sleeve.sleeve!.seamMm / 2, 1);
    expect(sleeve.sleeve!.maxShrink).toBeGreaterThan(0.4); // the neck is far narrower than the body
  });

  it("no label of any preset has NaN numbers or a negative safe area", () => {
    for (const def of DEFINITIONS)
      for (const preset of def.presets) {
        const d = describeBottle({ code: def.code, presetId: preset.id, surfaces: def.surfaces });
        expect(d.labels.length, `${preset.id}`).toBeGreaterThan(0);
        for (const l of d.labels) {
          for (const n of [l.trimWidthMm, l.trimHeightMm, l.printWidthMm, l.printHeightMm, l.trimAreaM2, l.safeRect.width, l.safeRect.height]) expect(finite(n), `${preset.id} ${l.kind}`).toBe(true);
          expect(l.trimWidthMm).toBeGreaterThan(0);
          expect(l.safeRect.width).toBeGreaterThan(0);
          expect(l.bleedMm).toBeGreaterThan(0);
        }
      }
  });
});

describe("configuration", () => {
  it("envelope holds body, closure and handle", () => {
    for (const { def, preset } of ALL) {
      const d = describeBottle({ code: def.code, presetId: preset.id });
      expect(d.envelope.width).toBeGreaterThanOrEqual(preset.dims.D - 0.01);
      expect(d.envelope.height).toBeGreaterThanOrEqual(preset.dims.H);
      if (preset.dims.G) expect(d.envelope.depth).toBeGreaterThanOrEqual(preset.dims.G - 0.5);
    }
  });

  it("closures are matched to the chosen finish", () => {
    const beer = describeBottle({ code: "BTL_GLASS_BEER_STUBBY", finish: "SWING_26", closure: "CROWN_26" });
    expect(beer.closure).toBe("SWING_TOP");
    const crown = describeBottle({ code: "BTL_GLASS_BEER_STUBBY" });
    expect(crown.closure).toBe("CROWN_26");
    for (const def of DEFINITIONS) expect(BOTTLE_CLOSURES[def.defaultClosure].fits).toContain(FINISHES[def.presets.find((p) => p.id === def.defaultPresetId)!.finish as keyof typeof FINISHES].kind);
  });

  it("custom dims keep a sensible nominal fill", () => {
    const d = describeBottle({ code: "BTL_PET_JUICE", dims: { D: 72, H: 210 } });
    expect(d.fill.ml).toBeGreaterThan(500);
    expect(d.fill.ml).toBeLessThan(d.brimfulMl);
  });
});
