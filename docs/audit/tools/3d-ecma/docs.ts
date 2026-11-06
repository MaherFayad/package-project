/**
 * Test-pattern design docs for every ECMA tuck / ECMA specials library model: each outside
 * face carries its name (centre) and "UP" at its top edge, so mirrored, upside-down or seamed
 * artwork shows in a render. Inside faces carry "IN-<face>". Output: JSON {code: DesignDoc}.
 * Variants (3rd arg): "finish" = soft-touch lamination + gold foil on the face names + spot UV
 * and emboss on "UP"; "features" = every option the model supports switched on (window,
 * thumb notch, tear strip, handle, partitions, display front).
 * usage: npx tsx --tsconfig tsconfig.json docs/audit/tools/3d-ecma/docs.ts [CODE,…|-] [finish|features] > docs.json
 */
import { FACE_IDS, type DesignDoc, type FaceId } from "@/types";
import { BOX_MODELS } from "@/lib/library";
import { docGeometry } from "@/lib/library/doc";
import { createModelDoc, makeTextLayer } from "@/components/designer/lib/doc";

const only = process.argv[2] && process.argv[2] !== "-" ? process.argv[2].split(",") : undefined;
const variant = process.argv[3];
const out: Record<string, { doc: DesignDoc; faces: string[]; name: string; standard: string; source: string }> = {};
for (const m of BOX_MODELS) {
  if (m.source !== "ecma-tuck" && m.source !== "ecma-specials") continue;
  if (only && !only.includes(m.code)) continue;
  let base = createModelDoc(m, { name: m.name.en });
  if (variant === "features") {
    const s = m.features;
    base = {
      ...base,
      features: {
        ...(s.windowFaces.length ? { window: { face: s.windowFaces[0], widthRatio: 0.5, heightRatio: 0.4, film: true } } : {}),
        ...(s.thumbNotch ? { thumbNotch: true } : {}),
        ...(s.tearStrip ? { tearStrip: true } : {}),
        ...(s.handle ? { handle: true } : {}),
        ...(s.partitions ? { partitions: { rows: 2, cols: 2 } } : {}),
        ...(s.displayFront ? { displayFront: true } : {}),
      },
    };
  }
  const geo = docGeometry(base);
  const faces = geo?.dieline.faces ?? {};
  const layers = [];
  for (const f of FACE_IDS as readonly FaceId[]) {
    const info = faces[f];
    if (!info) continue;
    const name = { ...makeTextLayer(f, "outside", info, f.toUpperCase()), color: "#12355b" };
    const up = { ...makeTextLayer(f, "outside", info, "UP"), color: "#b3261e" };
    up.fontSizePt = Math.max(6, Math.round(name.fontSizePt * 0.6));
    up.y = Math.min(info.height * 0.2, up.height + 4);
    up.height = up.height * 0.6;
    layers.push(name, up);
  }
  const inside = [];
  for (const f of FACE_IDS as readonly FaceId[]) {
    const info = faces[f];
    if (!info) continue;
    inside.push({ ...makeTextLayer(f, "inside", info, `IN-${f.toUpperCase()}`), color: "#1f5130" });
  }
  const names = layers.filter((_, i) => i % 2 === 0).map((l) => l.id);
  const ups = layers.filter((_, i) => i % 2 === 1).map((l) => l.id);
  const finishes =
    variant === "finish"
      ? [
          { code: "SOFT_TOUCH_LAMINATION" as const },
          { code: "FOIL_GOLD" as const, mask: { surface: "outside" as const, layerIds: names } },
          { code: "SPOT_UV" as const, mask: { surface: "outside" as const, layerIds: ups } },
          { code: "EMBOSS" as const, mask: { surface: "outside" as const, layerIds: ups } },
        ]
      : undefined;
  const doc: DesignDoc = { ...base, ...(finishes ? { finishes, finishCode: "SOFT_TOUCH_LAMINATION" } : {}), printSides: "BOTH", artwork: { ...base.artwork, outside: { background: "#f2c14e", layers }, inside: { background: "#cfe8d5", layers: inside } } } as DesignDoc;
  out[m.code] = { doc, faces: Object.keys(faces), name: m.name.en, standard: m.standard, source: m.source };
}
console.log(JSON.stringify(out));
