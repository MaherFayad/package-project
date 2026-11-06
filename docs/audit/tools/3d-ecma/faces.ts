/** Print each face of a model (default size, 0.4 mm board) with its parts. usage: npx tsx --tsconfig tsconfig.json docs/audit/tools/3d-ecma/faces.ts <CODE> */
import { BOX_MODELS } from "@/lib/library";
const m = BOX_MODELS.find((x) => x.code === process.argv[2])!;
const d = m.build(m.defaultDims, { thicknessMm: 0.4 });
for (const f of Object.values(d.faces)) console.log(f!.face, f!.width.toFixed(1), f!.height.toFixed(1), f!.parts.map((p) => `${p.panelId}[${p.rect.x.toFixed(0)},${p.rect.y.toFixed(0)},${p.rect.width.toFixed(0)}x${p.rect.height.toFixed(0)}]`).join(" "));
