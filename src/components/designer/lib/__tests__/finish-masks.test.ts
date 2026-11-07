import { describe, expect, it } from "vitest";
import { generateDieline } from "@/lib/dieline";
import { addLayer, createDesignDoc, makeImageLayer, makeTextLayer, removeLayer } from "../doc";
import { FINISH_PREVIEW_LAYER, defaultFinishLayerIds, extendFinishMasks, fillEmptyFinishMasks, finishPreview, setLayerFinish, toggleFinish } from "../config";

const PNG = "data:image/png;base64,iVBORw0KGgo=";

function setup() {
  const doc = createDesignDoc({ structureCode: "FEFCO_0427" });
  const model = generateDieline("FEFCO_0427", doc.dims, { thicknessMm: 1.5 });
  const face = model.faces.front!;
  const text = makeTextLayer("front", "outside", face, "Bloom");
  const logo = makeImageLayer("front", "outside", face, { src: PNG, pxWidth: 800, pxHeight: 400 });
  return { doc, model, text, logo };
}

describe("finish masks (FN-02)", () => {
  it("spot UV starts on every item, on every face", () => {
    const { doc, model, text, logo } = setup();
    const back = makeTextLayer("back", "outside", model.faces.back!, "Back");
    const d = addLayer(addLayer(addLayer(doc, text), logo), back);
    expect(defaultFinishLayerIds(d)).toEqual([text.id, logo.id, back.id]);
    const on = toggleFinish(d, "SPOT_UV", true);
    expect(on.finishes).toEqual([{ code: "SPOT_UV", mask: { surface: "outside", layerIds: [text.id, logo.id, back.id] } }]);
    expect(on.finishCode).toBe("SPOT_UV");
  });

  it("a finish on every item takes new items too; a narrowed one does not", () => {
    const { doc, model, text, logo } = setup();
    const all = toggleFinish(addLayer(doc, text), "FOIL_GOLD", true);
    const grown = extendFinishMasks(all, addLayer(all, logo), logo.id);
    expect(grown.finishes?.[0].mask?.layerIds).toEqual([text.id, logo.id]);
    const narrowed = setLayerFinish(grown, "FOIL_GOLD", text.id, false);
    const back = makeTextLayer("back", "outside", model.faces.back!, "Back");
    const kept = extendFinishMasks(narrowed, addLayer(narrowed, back), back.id);
    expect(kept.finishes?.[0].mask?.layerIds).toEqual([logo.id]);
  });

  it("an empty mask is filled by the first item added, and refilled when its item is deleted", () => {
    const { doc, text, logo } = setup();
    const on = toggleFinish(doc, "FOIL_GOLD", true);
    expect(on.finishes?.[0].mask?.layerIds).toEqual([]);
    const withText = fillEmptyFinishMasks(addLayer(on, text));
    expect(withText.finishes?.[0].mask?.layerIds).toEqual([text.id]);
    // a mask that still points at a live item is left alone
    const withLogo = fillEmptyFinishMasks(addLayer(withText, logo));
    expect(withLogo.finishes?.[0].mask?.layerIds).toEqual([text.id]);
    const gone = fillEmptyFinishMasks(removeLayer(withLogo, text.id));
    expect(gone.finishes?.[0].mask?.layerIds).toEqual([logo.id]);
  });

  it("toggles one item in and out of a masked finish", () => {
    const { doc, text, logo } = setup();
    let d = toggleFinish(addLayer(addLayer(doc, text), logo), "SPOT_UV", true);
    d = setLayerFinish(d, "SPOT_UV", text.id, true);
    expect(d.finishes?.[0].mask?.layerIds.sort()).toEqual([logo.id, text.id].sort());
    d = setLayerFinish(d, "SPOT_UV", logo.id, false);
    expect(d.finishes?.[0].mask?.layerIds).toEqual([text.id]);
  });

  it("the 3D preview covers every face when nothing is masked yet", () => {
    const { doc, model } = setup();
    const on = toggleFinish(doc, "SPOT_UV", true);
    const view = finishPreview(on.finishes!, on.artwork, model);
    const faces = Object.keys(model.faces);
    expect(view.finishes[0].mask?.layerIds).toEqual(faces.map((f) => `${FINISH_PREVIEW_LAYER}-${f}`));
    expect(view.artwork.outside.layers.map((l) => l.face)).toEqual(faces);
    const stand = view.artwork.outside.layers.find((l) => l.id === `${FINISH_PREVIEW_LAYER}-front`)!;
    expect(stand).toMatchObject({ face: "front", width: model.faces.front!.width, height: model.faces.front!.height });
    expect(stand.x).toBeCloseTo(model.faces.front!.width / 2);
    // never written into the document
    expect(on.artwork.outside.layers).toHaveLength(0);
  });

  it("the 3D preview keeps a real mask as it is and leaves coatings unmasked", () => {
    const { doc, model, logo } = setup();
    const d = toggleFinish(toggleFinish(addLayer(doc, logo), "SPOT_UV", true), "MATTE_LAMINATION", true);
    const view = finishPreview(d.finishes!, d.artwork, model);
    expect(view.finishes).toEqual([{ code: "SPOT_UV", mask: { surface: "outside", layerIds: [logo.id] } }, { code: "MATTE_LAMINATION" }]);
    expect(view.artwork).toBe(d.artwork);
  });
});
