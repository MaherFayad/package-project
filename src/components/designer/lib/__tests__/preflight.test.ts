import { describe, expect, it } from "vitest";
import type { DesignDoc, FaceId, ImageLayer } from "@/types";
import { FACE_IDS } from "@/types";
import { generateDieline } from "@/lib/dieline";
import { addLayer, createDesignDoc, makeImageLayer, makeShapeLayer, makeTextLayer, setBackground } from "../doc";
import { effectiveDpi, facesWithIssues, runPreflight, summarizePreflight } from "../preflight";

const PNG = "data:image/png;base64,iVBORw0KGgo=";

function setup(code: "FEFCO_0427" | "ECMA_RTE" = "FEFCO_0427") {
  const doc = createDesignDoc({ structureCode: code });
  const model = generateDieline(code, doc.dims, { thicknessMm: code === "ECMA_RTE" ? 0.48 : 1.5 });
  return { doc, model };
}

describe("preflight", () => {
  it("flags an empty design and is not ready", () => {
    const { doc, model } = setup();
    const issues = runPreflight(doc, model);
    expect(issues.map((i) => i.code)).toEqual(["EMPTY_DESIGN"]);
    expect(summarizePreflight(issues)).toMatchObject({ ready: false, empty: true, errors: 0 });
  });

  it("is ready to print with centred text and a background", () => {
    const { doc, model } = setup();
    const face = model.faces.front!;
    let d = setBackground(doc, "outside", "#1f3d2b");
    d = addLayer(d, makeTextLayer("front", "outside", face, "Bloom"));
    const issues = runPreflight(d, model);
    expect(issues).toEqual([]);
    expect(summarizePreflight(issues).ready).toBe(true);
  });

  it("errors on text crossing a fold and warns for shapes", () => {
    const { doc, model } = setup();
    const face = model.faces.front!;
    const text = { ...makeTextLayer("front", "outside", face, "Across"), x: face.width / 2, y: 0 };
    const issues = runPreflight(addLayer(doc, text), model);
    const i = issues.find((x) => x.layerId === text.id)!;
    expect(["CROSSES_FOLD", "ON_GLUE_FLAP"]).toContain(i.code);
    expect(i.severity).toBe("error");
    const shape = { ...makeShapeLayer("front", "outside", face, "rect"), x: face.width / 2, y: 0 };
    expect(runPreflight(addLayer(doc, shape), model).find((x) => x.layerId === shape.id)!.severity).toBe("warning");
  });

  it("warns when text sits in the safe margin", () => {
    const { doc, model } = setup();
    const face = model.faces.front!;
    const t = makeTextLayer("front", "outside", face, "Edge");
    const near = { ...t, x: t.width / 2 + 1, y: face.height / 2 };
    const issue = runPreflight(addLayer(doc, near), model).find((x) => x.layerId === near.id);
    expect(issue?.code).toBe("OUTSIDE_SAFE_ZONE");
    expect(facesWithIssues(runPreflight(addLayer(doc, near), model)).has("front")).toBe(true);
  });

  it("errors when text runs past the panel edge, warns for a shape there (R10-04)", () => {
    const { doc, model } = setup();
    const f: FaceId = (FACE_IDS.find((x) => x.includes("left")) ?? "front") as FaceId;
    const face = model.faces[f] ?? model.faces.front!;
    const fid = (model.faces[f] ? f : "front") as FaceId;
    const t = makeTextLayer(fid, "outside", face, "A very long line of words that will not fit");
    const wide = { ...t, x: face.width / 2, y: face.height / 2, width: face.width * 3 };
    const issue = runPreflight(addLayer(doc, wide), model).find((x) => x.layerId === wide.id);
    expect(issue?.severity).toBe("error");
    const inMargin = { ...t, x: t.width / 2 + 1, y: face.height / 2, width: Math.min(t.width, face.width - 2) };
    const mild = runPreflight(addLayer(doc, inMargin), model).find((x) => x.layerId === inMargin.id);
    if (mild?.code === "OUTSIDE_SAFE_ZONE") expect(mild.severity).toBe("warning");
  });

  it("finds artwork running onto a glue flap", () => {
    const { doc, model } = setup("ECMA_RTE");
    expect(model.panels.some((p) => p.role === "glue")).toBe(true);
    const hits = FACE_IDS.filter((f): f is FaceId => !!model.faces[f]).filter((f) => {
      const face = model.faces[f]!;
      const big = { ...makeShapeLayer(f, "outside", face, "rect"), x: face.width / 2, y: face.height / 2, width: face.width + 30, height: face.height * 0.5 };
      return runPreflight(addLayer(doc, big), model).some((i) => i.code === "ON_GLUE_FLAP");
    });
    expect(hits.length).toBeGreaterThan(0);
  });

  it("rates image resolution at its printed size", () => {
    const img = (px: number): ImageLayer => ({ ...makeImageLayer("front", "outside", { width: 200, height: 200 }, { src: PNG, pxWidth: px, pxHeight: px }), width: 100, height: 100 });
    expect(effectiveDpi(img(1200))).toBeCloseTo(304.8, 0);
    const { doc, model } = setup();
    const grade = (px: number) => {
      const l = { ...img(px), x: 125, y: 40, width: 40, height: 40 };
      return runPreflight(addLayer(doc, l), model).find((i) => i.code === "LOW_DPI")?.severity ?? "ok";
    };
    expect(grade(80)).toBe("error"); // ~51 dpi
    expect(grade(300)).toBe("warning"); // ~190 dpi
    expect(grade(600)).toBe("ok"); // ~381 dpi
  });

  it("flags tiny text and ignores the inside unless printing both sides", () => {
    const { doc, model } = setup();
    const face = model.faces.front!;
    const tiny = { ...makeTextLayer("front", "outside", face, "fine print"), fontSizePt: 4 };
    expect(runPreflight(addLayer(doc, tiny), model).some((i) => i.code === "TEXT_TOO_SMALL")).toBe(true);

    const inside = { ...makeTextLayer("front", "inside", face, "Inside"), y: 0 };
    const d: DesignDoc = addLayer(setBackground(doc, "outside", "#ffffff"), inside);
    expect(runPreflight(d, model)).toEqual([]);
    expect(runPreflight({ ...d, printSides: "BOTH" }, model).some((i) => i.layerId === inside.id)).toBe(true);
  });

  it("skips hidden layers", () => {
    const { doc, model } = setup();
    const face = model.faces.front!;
    const t = { ...makeTextLayer("front", "outside", face, "Hidden"), y: 0, hidden: true };
    expect(runPreflight(addLayer(setBackground(doc, "outside", "#ffffff"), t), model)).toEqual([]);
  });
});
