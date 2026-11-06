import { describe, expect, it } from "vitest";
import type { Dims, FaceId } from "@/types";
import { applyAffine, boundsAt, computePoses } from "../../../fold";
import { polygonArea } from "../../../geometry";
import { WALL_PIVOT_MM, WRAP_VISUAL_MM } from "../common";
import { DISC_SEAT_MM } from "../tubes";
import { DEFINITIONS, DEFINITION_BY_CODE, FAMILY_MATERIALS, FamilyValidationError, octabinChamfer, printAreas, type CatalogueDefinition, type FamilyDielineModel } from "..";

const DIACRITICS = /[ً-ْٰ]/;

function allFinite(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(allFinite);
  if (value && typeof value === "object") return Object.values(value).every(allFinite);
  return true;
}

/** Corner sizes that satisfy the model's rules (round tubes keep L = W). */
function sizeCases(def: CatalogueDefinition): Dims[] {
  const l = def.params;
  const raw: Dims[] = [
    def.defaultDims,
    ...def.presets.map((p) => p.dims),
    { L: l.L.min, W: l.W.min, H: l.H.min },
    { L: l.L.max, W: l.W.max, H: l.H.max },
    { L: l.L.max, W: l.W.min, H: l.H.min },
    { L: l.L.min, W: l.W.max, H: l.H.max },
  ];
  const fix = (d: Dims): Dims => (def.shape === "cylinder" ? { ...d, W: d.L } : d);
  return raw.map(fix).filter((d) => def.validate(d).ok);
}


/** Expected outer size of the closed model from the inner size (mm). */
function expectedOuter(def: CatalogueDefinition, d: Dims, m: FamilyDielineModel): Dims | null {
  const t = m.thicknessMm;
  const c = 0.5;
  // Wrap paper on the inside of a lid / cover is drawn WRAP_VISUAL_MM thick: lids and covers
  // clear it (one paper per side).
  const p = WRAP_VISUAL_MM;
  switch (def.code) {
    case "RIGID_LID_BASE":
    case "RIGID_WINDOW":
      return { L: d.L + 4 * t + 2 * (c + p), W: d.W + 4 * t + 2 * (c + p), H: d.H + 2 * t };
    case "RIGID_SHOULDER":
      return { L: d.L + 4 * t + 2 * (c + p), W: d.W + 4 * t + 2 * (c + p), H: d.H + 2 * t };
    case "RIGID_BOOK_MAGNETIC":
      return { L: d.L + 2 * t + 4, W: d.W + 4 * t + c + p, H: d.H + 3 * t + 2 * p };
    case "RIGID_DRAWER":
      return { L: d.L + 4 * t + 1.5, W: d.W + 2 * t, H: d.H + 3 * t + 1.5 };
    case "RIGID_HINGED_LID":
      return { L: d.L + 2 * t, W: d.W + 2 * t, H: d.H + 2 * t };
    case "RIGID_COLLAPSIBLE":
      return { L: d.L + 6 * t, W: d.W + 3 * t, H: d.H + 2 * t };
    case "PALLET_BOX":
    case "OCTABIN":
      return { L: d.L + 2 * t, W: d.W + 2 * t, H: d.H + 4 * t };
    case "PALLET_BOX_LID": {
      const clr = Math.max(1, t * 0.5);
      // R5-3Q-A-08: the core telescope lid is one caliper longer so its manufacturer's joint clears the base wall.
      return { L: d.L + 5 * t + 2 * clr, W: d.W + 4 * t + 2 * clr, H: d.H + 4 * t };
    }
    case "ENVELOPE_DOCUMENT":
    case "ENVELOPE_CARD":
    case "MAILER_BAG":
      return { L: d.L, W: 4 * t, H: d.H };
    case "PADDED_MAILER":
      return { L: d.L + 2 * t, W: 4 * t, H: d.H + 2 * t };
    default:
      return null; // tubes: checked separately (polygon section)
  }
}

describe("catalogue metadata", () => {
  it("has unique codes and slugs", () => {
    expect(new Set(DEFINITIONS.map((d) => d.code)).size).toBe(DEFINITIONS.length);
    expect(new Set(DEFINITIONS.map((d) => d.slug)).size).toBe(DEFINITIONS.length);
    expect(DEFINITIONS.length).toBeGreaterThanOrEqual(19);
  });

  it.each(DEFINITIONS.map((d) => [d.code, d] as const))("%s metadata is complete", (_c, def) => {
    for (const s of [def.name.ar, def.description.ar]) {
      expect(s.length).toBeGreaterThan(3);
      expect(DIACRITICS.test(s)).toBe(false);
      expect(/[؀-ۿ]/.test(s)).toBe(true);
    }
    expect(def.name.en.length).toBeGreaterThan(3);
    expect(def.standard.length).toBeGreaterThan(0);
    expect(def.subFamily.length).toBeGreaterThan(0);
    expect(def.slug).toMatch(/^[a-z0-9-]+$/);
    expect(def.presets.length).toBeGreaterThanOrEqual(2);
    expect(def.presets.length).toBeLessThanOrEqual(4);
    for (const pr of def.presets) {
      expect(def.validate(pr.dims).ok, pr.id).toBe(true);
      expect(DIACRITICS.test(pr.name.ar)).toBe(false);
    }
    expect(def.validate(def.defaultDims).ok).toBe(true);
    expect(def.materials).toContain(def.defaultMaterial);
    for (const m of def.materials) expect(FAMILY_MATERIALS[m].family).toBe(def.family);
    expect(def.uses.length).toBeGreaterThan(0);
  });

  it("cites the published standards where one exists", () => {
    expect(DEFINITION_BY_CODE.PALLET_BOX.standard).toBe("FEFCO 0201");
    expect(DEFINITION_BY_CODE.PALLET_BOX_LID.standard).toBe("FEFCO 0320");
    expect(DEFINITION_BY_CODE.ENVELOPE_DOCUMENT.standard).toBe("ISO 269");
    // ISO 269 finished sizes.
    const sizes = Object.fromEntries(DEFINITION_BY_CODE.ENVELOPE_DOCUMENT.presets.map((p) => [p.id, [p.dims.L, p.dims.H]]));
    expect(sizes.c4).toEqual([229, 324]);
    expect(sizes.c5).toEqual([229, 162]);
    expect(sizes.dl).toEqual([220, 110]);
    const card = Object.fromEntries(DEFINITION_BY_CODE.ENVELOPE_CARD.presets.map((p) => [p.id, [p.dims.L, p.dims.H]]));
    expect(card.c6).toEqual([162, 114]);
  });
});

describe.each(DEFINITIONS.map((d) => [d.code, d] as const))("%s", (_code, def) => {
  const cases = sizeCases(def);

  it("generates finite models for every size case", () => {
    expect(cases.length).toBeGreaterThanOrEqual(3);
    for (const d of cases) {
      const m = def.generate(d);
      expect(m.catalogCode).toBe(def.code);
      expect(m.structureCode).toBe(def.baseCode);
      expect(allFinite(m), JSON.stringify(d)).toBe(true);
      expect(m.panels.length).toBeGreaterThan(3);
      expect(m.cutLines.length).toBeGreaterThan(3);
      expect(m.metrics.blankAreaM2).toBeGreaterThan(0);
      expect(m.metrics.pieceCount).toBe(def.pieces);
      // Mid-fold poses are finite too (animation).
      for (const pose of computePoses(m, 0.5).values()) expect(pose.world.elements.every(Number.isFinite)).toBe(true);
    }
  });

  it("closed size matches the inner size plus board allowances", () => {
    for (const d of cases) {
      const m = def.generate(d);
      const e = expectedOuter(def, d, m);
      if (def.shape === "cylinder") {
        // Polygon section: width between the outer apothem diameter and the circumdiameter.
        expect(m.closedOuter.L).toBeGreaterThan(d.L + 2 * m.thicknessMm);
        expect(m.closedOuter.L).toBeLessThan((d.L + 6 * m.thicknessMm + 1) / Math.cos(Math.PI / 24) + 0.5);
        // End discs are seated DISC_SEAT_MM proud of the rims (no z-fight with the rim edges).
        const h = d.H + (def.code === "TUBE_PUSH_UP" ? m.thicknessMm + DISC_SEAT_MM : 2 * (m.thicknessMm + DISC_SEAT_MM));
        expect(m.closedOuter.H).toBeCloseTo(h, 1);
        continue;
      }
      expect(e).not.toBeNull();
      expect(m.closedOuter.L, `L ${JSON.stringify(d)}`).toBeCloseTo(e!.L, 1);
      expect(m.closedOuter.W, `W ${JSON.stringify(d)}`).toBeCloseTo(e!.W, 1);
      expect(m.closedOuter.H, `H ${JSON.stringify(d)}`).toBeCloseTo(e!.H, 1);
    }
  });

  it("maps every visible face to printable panels", () => {
    const m = def.generate(def.defaultDims);
    const want: FaceId[] = def.shape === "cylinder" ? ["front", "back", "top"] : def.shape === "flat" ? ["front", "back"] : ["front", "back", "left", "right", "top", "bottom"];
    for (const f of want) expect(m.faces[f], f).toBeDefined();
    const byId = new Map(m.panels.map((p) => [p.id, p]));
    for (const face of Object.values(m.faces)) {
      for (const part of face!.parts) {
        const p = byId.get(part.panelId)!;
        expect(p).toBeDefined();
        // Centre of the part maps inside its panel on the sheet.
        const c = applyAffine(part.transform, part.rect.x + part.rect.width / 2, part.rect.y + part.rect.height / 2);
        expect(c.x).toBeGreaterThan(p.bbox.x - 0.6);
        expect(c.x).toBeLessThan(p.bbox.x + p.bbox.width + 0.6);
        expect(c.y).toBeGreaterThan(p.bbox.y - 0.6);
        expect(c.y).toBeLessThan(p.bbox.y + p.bbox.height + 0.6);
      }
    }
  });

  it("has consistent print areas (bleed ⊇ trim ⊇ safe)", () => {
    const m = def.generate(def.defaultDims);
    const a = printAreas(m);
    expect(a.trimM2).toBeGreaterThan(0);
    expect(a.bleedM2).toBeGreaterThan(a.trimM2);
    expect(a.safeM2).toBeGreaterThan(0);
    expect(a.safeM2).toBeLessThan(a.trimM2);
    expect(a.sheetM2).toBeGreaterThanOrEqual(a.trimM2);
    expect(m.bleedMm).toBe(3);
    for (const r of m.bleedRegions) {
      const p = m.panels.find((x) => x.id === r.panelId)!;
      expect(polygonArea(r.polygon)).toBeGreaterThanOrEqual(polygonArea(p.polygon) - 1e-6);
    }
    for (const z of m.safeZones) {
      const p = m.panels.find((x) => x.id === z.panelId)!;
      expect(z.rect.x).toBeGreaterThanOrEqual(p.bbox.x - 1e-6);
      expect(z.rect.x + z.rect.width).toBeLessThanOrEqual(p.bbox.x + p.bbox.width + 1e-6);
      expect(z.rect.y + z.rect.height).toBeLessThanOrEqual(p.bbox.y + p.bbox.height + 1e-6);
    }
    // Sheet = die bounds + bleed each side.
    expect(m.sheet.width).toBeCloseTo(m.dieBounds.width + 2 * m.bleedMm, 6);
    // Glue flaps stay ink-free.
    for (const p of m.panels.filter((x) => x.role === "glue")) expect(p.printable).toBe(false);
  });

  it("separately cut blanks do not overlap on the sheet", () => {
    const m = def.generate(def.defaultDims);
    const b = m.pieces.map((p) => p.bounds);
    for (let i = 0; i < b.length; i++)
      for (let j = i + 1; j < b.length; j++) {
        const ov = b[i].x < b[j].x + b[j].width - 0.01 && b[j].x < b[i].x + b[i].width - 0.01 && b[i].y < b[j].y + b[j].height - 0.01 && b[j].y < b[i].y + b[i].height - 0.01;
        expect(ov, `${m.pieces[i].label} / ${m.pieces[j].label}`).toBe(false);
      }
  });

  it("enforces limits and materials", () => {
    const l = def.params;
    const d = def.defaultDims;
    for (const bad of [
      { ...d, L: l.L.min - 1, ...(def.shape === "cylinder" ? { W: l.W.min - 1 } : {}) },
      { ...d, H: l.H.max + 1 },
      { ...d, H: Number.NaN },
    ]) {
      expect(def.validate(bad).ok).toBe(false);
      expect(() => def.generate(bad)).toThrow(FamilyValidationError);
    }
    expect(() => def.generate(d, { thicknessMm: -1 })).toThrow(FamilyValidationError);
    const foreign = Object.values(FAMILY_MATERIALS).find((m) => !def.materials.includes(m.code))!;
    expect(() => def.generate(d, { material: foreign.code })).toThrow(FamilyValidationError);
    for (const m of def.materials) expect(allFinite(def.generate(d, { material: m }).closedOuter)).toBe(true);
  });

  if (def.construction) {
    it("lists construction parts", () => {
      const spec = def.construction!(def.defaultDims);
      expect(spec.boards.length).toBeGreaterThan(0);
      expect(allFinite(spec.boards.map((b) => [b.widthMm, b.heightMm, b.qty]))).toBe(true);
      for (const b of spec.boards) expect(b.widthMm > 0 && b.heightMm > 0).toBe(true);
    });
  }
});

describe("family specifics", () => {
  it("tube label artwork lands on its own strip and covers the whole front (R5-3Q-E-04)", () => {
    for (const def of DEFINITIONS.filter((d) => d.shape === "cylinder")) {
      for (const dims of [def.defaultDims, { L: def.params.L.min, W: def.params.L.min, H: def.params.H.min }]) {
        const m = def.generate(dims as Dims);
        const front = m.faces.front!;
        let covered = 0;
        for (const part of front.parts) {
          const p = m.panels.find((q) => q.id === part.panelId)!;
          const tr = part.transform!;
          // face rect → sheet rect must lie inside the panel (no bare board on the strip)
          const y0 = part.rect.y + tr[5];
          const y1 = part.rect.y + part.rect.height + tr[5];
          expect(y0, `${def.code} ${part.panelId}`).toBeGreaterThanOrEqual(p.bbox.y - 1e-6);
          expect(y1, `${def.code} ${part.panelId}`).toBeLessThanOrEqual(p.bbox.y + p.bbox.height + 1e-6);
          covered += part.rect.width * part.rect.height;
        }
        // window strips are split, so allow the aperture; every other tube is covered edge to edge
        const min = def.code === "TUBE_WINDOW" ? 0.6 : 0.99;
        expect(covered / (front.width * front.height), `${def.code} ${JSON.stringify(dims)} covered`).toBeGreaterThan(min);
      }
    }
  });

  it("a cap's TOP print stays on the disc: its bleed never crosses the hinge onto the cap strips (R6-3Q-E-01)", () => {
    for (const def of DEFINITIONS.filter((d) => d.shape === "cylinder")) {
      for (const dims of [def.defaultDims, { L: def.params.L.min, W: def.params.L.min, H: def.params.H.min }, { L: def.params.L.max, W: def.params.L.max, H: def.params.H.max }]) {
        const m = def.generate(dims as Dims);
        const disc = m.panels.find((p) => p.id === "lidTop")!;
        const region = m.bleedRegions.find((r) => r.panelId === "lidTop")!;
        // the disc lies above its hinge on the sheet (strips below): no bleed vertex below it
        const hingeY = disc.hinge!.a.y;
        const below = Math.max(...region.polygon.map((q) => q.y - hingeY));
        expect(below, `${def.code} ${JSON.stringify(dims)}`).toBeLessThanOrEqual(1e-6);
      }
    }
  });

  it("rigid boxes show the board thickness and roll turn-ins inside", () => {
    const def = DEFINITION_BY_CODE.RIGID_LID_BASE;
    const m = def.generate({ L: 200, W: 150, H: 80 }, { material: "GREYBOARD_2500_WRAP" });
    expect(m.thicknessMm).toBe(2.65);
    const turns = m.panels.filter((p) => p.label === "Turn-in");
    expect(turns.length).toBe(8);
    for (const p of turns) expect(p.foldAngleClosed).toBe(180);
    // Inner space of the base = requested inner size: walls stand inside L + 2t. The walls hinge
    // WALL_PIVOT_MM inside the base board (R5-3Q-E-03, no end face in a printed face), so the base
    // panel is cut 2 × that smaller and the closed inner / outer sizes stay exact.
    const base = m.panels.find((p) => p.id === "bottom")!;
    expect(base.bbox.width).toBeCloseTo(200 + 2 * 2.65 - 2 * WALL_PIVOT_MM, 6);
    expect(base.bbox.height).toBeCloseTo(150 + 2 * 2.65 - 2 * WALL_PIVOT_MM, 6);
  });

  it("lid depth is adjustable up to a full telescope lid", () => {
    const def = DEFINITION_BY_CODE.RIGID_LID_BASE;
    const shallow = def.generate({ L: 200, W: 150, H: 80 }, { features: { lidHeightMm: 20 } });
    const full = def.generate({ L: 200, W: 150, H: 80 }, { features: { lidHeightMm: 80 } });
    // Walls are cut WALL_PIVOT_MM shorter: they hinge that much inside the top board (R5-3Q-E-03),
    // so the closed lid depth is still lidHeight + t.
    expect(shallow.panels.find((p) => p.id === "lid_front")!.bbox.height).toBeCloseTo(20 + shallow.thicknessMm - WALL_PIVOT_MM, 6);
    expect(full.panels.find((p) => p.id === "lid_front")!.bbox.height).toBeCloseTo(80 + full.thicknessMm - WALL_PIVOT_MM, 6);
  });

  it("window boxes cut an aperture and add film", () => {
    const rigid = DEFINITION_BY_CODE.RIGID_WINDOW.generate({ L: 200, W: 200, H: 60 });
    expect(rigid.panels.find((p) => p.id === "lid_top")!.holes?.length).toBe(1);
    expect(rigid.metrics.filmAreaM2).toBeGreaterThan(0);
    const tube = DEFINITION_BY_CODE.TUBE_WINDOW.generate({ L: 75, W: 75, H: 150 });
    expect(tube.panels.some((p) => /^body\d+t$/.test(p.id))).toBe(true);
    expect(tube.metrics.filmAreaM2).toBeGreaterThan(0);
    // R5-3Q-E-05: the smallest window tube still has its window.
    const lim = DEFINITION_BY_CODE.TUBE_WINDOW.params;
    expect(DEFINITION_BY_CODE.TUBE_WINDOW.generate({ L: lim.L.min, W: lim.L.min, H: lim.H.min }).metrics.filmAreaM2).toBeGreaterThan(0);
    // The plain tube has no split strips.
    expect(DEFINITION_BY_CODE.TUBE_LID_BASE.generate({ L: 75, W: 75, H: 150 }).panels.some((p) => /^body\d+t$/.test(p.id))).toBe(false);
  });

  it("book box flap closes on the front and the cover owns the outside faces", () => {
    const m = DEFINITION_BY_CODE.RIGID_BOOK_MAGNETIC.generate({ L: 220, W: 160, H: 70 });
    for (const f of ["front", "back", "top", "bottom"] as const) for (const part of m.faces[f]!.parts) expect(part.panelId.startsWith("cover_")).toBe(true);
    expect(m.faces.front!.parts.some((p) => p.panelId === "cover_flap")).toBe(true);
    expect(DEFINITION_BY_CODE.RIGID_BOOK_MAGNETIC.construction!({ L: 220, W: 160, H: 70 }).extras.join(" ")).toMatch(/magnet/i);
  });

  it("drawer has a ribbon slot and the sleeve is open front and back", () => {
    const m = DEFINITION_BY_CODE.RIGID_DRAWER.generate({ L: 200, W: 120, H: 40 });
    expect(m.panels.find((p) => p.id === "front")!.holes?.length).toBe(1);
    expect(m.faces.front!.parts.every((p) => !p.panelId.startsWith("sleeve_"))).toBe(true);
    expect(m.faces.top!.parts.some((p) => p.panelId === "sleeve_top")).toBe(true);
  });

  it("tube front face is one contiguous strip run of the label", () => {
    const m = DEFINITION_BY_CODE.TUBE_LID_BASE.generate({ L: 75, W: 75, H: 150 });
    const body = m.faces.front!.parts.filter((p) => /^body\d+$/.test(p.panelId));
    const tx = body.map((p) => p.transform[4]);
    expect(Math.max(...tx) - Math.min(...tx)).toBeLessThan(1e-6);
    // Roll hinges are neither cut nor crease.
    const rolls = m.panels.filter((p) => p.hingeKind === "roll").length;
    expect(rolls).toBeGreaterThan(40);
    expect(m.creaseLines.length).toBeLessThan(5);
  });

  it("rolled edge curls are continuous (no slits between strips)", () => {
    const plain = DEFINITION_BY_CODE.TUBE_LID_BASE.generate({ L: 75, W: 75, H: 150 });
    const rolled = DEFINITION_BY_CODE.TUBE_ROLLED_EDGE.generate({ L: 75, W: 75, H: 150 });
    const curls = rolled.panels.filter((p) => p.label === "Curled edge");
    expect(curls.length).toBeGreaterThan(40);
    // Only the outer outline of each curl band is added to the knife: ~2 × circumference per band.
    const extra = rolled.metrics.cutLengthMm - plain.metrics.cutLengthMm;
    expect(extra).toBeLessThan(2 * 2 * Math.PI * 45 + 200);
  });

  it("shoulder tube lid is flush with the body", () => {
    const m = DEFINITION_BY_CODE.TUBE_SHOULDER.generate({ L: 75, W: 75, H: 150 });
    const poses = computePoses(m, 1);
    const ids = (pre: string) => m.panels.filter((p) => p.pieceId === m.panels.find((q) => q.id === `${pre}${q.id.slice(pre.length)}` && q.parentId === null && q.id.startsWith(pre))?.id);
    const box = (pre: string) => boundsAt({ ...m, panels: ids(pre) }, 1, poses);
    const body = box("body");
    const lid = box("lid");
    // Flush within the lid's sliding clearance (0.4 mm per side).
    expect(Math.abs(lid.max.x - lid.min.x - (body.max.x - body.min.x))).toBeLessThan(2 * 0.4 + 0.1);
    expect(lid.min.y).toBeCloseTo(body.max.y, 0);
  });

  it("octabin uses 45° folds and a regular corner chamfer", () => {
    const m = DEFINITION_BY_CODE.OCTABIN.generate({ L: 1150, W: 950, H: 1000 });
    const walls = m.panels.filter((p) => p.parentId !== null && p.label.endsWith("panel"));
    expect(walls.length).toBe(7);
    for (const w of walls) expect(w.foldAngleClosed).toBe(45);
    // Regular octagon on 1000 mm: side 1000/(1+√2) = 414.2, corner leg (1000 − 414.2)/2 = 292.9.
    expect(octabinChamfer(1000, 1000)).toBeCloseTo(292.9, 1);
  });

  it("envelope layers stack behind the front without overlap", () => {
    const m = DEFINITION_BY_CODE.ENVELOPE_DOCUMENT.generate({ L: 229, W: 0, H: 324 });
    const depth = Object.fromEntries(m.panels.map((p) => [p.id, p.pivotDepth]));
    expect(depth.sideL).toBe(1);
    expect(depth.back).toBe(1.5);
    expect(depth.seal).toBe(2);
    expect(m.faces.back!.parts.length).toBeGreaterThanOrEqual(3);
    const bag = DEFINITION_BY_CODE.MAILER_BAG.generate({ L: 320, W: 20, H: 420 });
    expect(bag.metrics.perfLengthMm).toBeGreaterThan(500);
  });

  it("padded mailer sizes are internal", () => {
    const def = DEFINITION_BY_CODE.PADDED_MAILER;
    const m = def.generate({ L: 180, W: 10, H: 260 });
    const front = m.panels.find((p) => p.id === "front")!;
    expect(front.bbox.width).toBeCloseTo(180 + 2 * m.thicknessMm, 6);
    expect(front.bbox.height).toBeCloseTo(260 + 2 * m.thicknessMm, 6);
  });

  it("rejects rule violations", () => {
    expect(DEFINITION_BY_CODE.TUBE_LID_BASE.validate({ L: 75, W: 80, H: 150 }).ok).toBe(false);
    expect(DEFINITION_BY_CODE.OCTABIN.validate({ L: 1200, W: 600, H: 1000 }).ok).toBe(false);
    expect(DEFINITION_BY_CODE.ENVELOPE_CARD.validate({ L: 162, W: 20, H: 114 }).ok).toBe(false);
  });
});
