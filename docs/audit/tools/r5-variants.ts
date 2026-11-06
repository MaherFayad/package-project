/**
 * Round 5 3D QA: every library model × every state worth looking at, as ready DesignDocs.
 *  boxes:   def (createModelDoc), min / max size (smallest / largest dims the generator builds,
 *           searched from the limits toward the default), each supported feature (window per face,
 *           handle, thumb notch, tear strip, 2×2 partitions, display front, lid height), and each
 *           other board (kraft / white / rigid wrap look).
 *  vessels: def, min / max size, every other container, every other closure, flexible options.
 * Every doc carries the face TEST PATTERN (face name + up arrow on its own colour) on the outside,
 * so mirrored / upside-down / stretched / wrong-face artwork shows on the screenshot.
 *
 * usage: npx tsx docs/audit/tools/r5-variants.ts > variants.json   (ONLY=CODE,CODE to filter)
 */
import { MODELS, type BoxModelDef, type VesselModelDef } from "@/lib/library";
import { docGeometry } from "@/lib/library/doc";
import { BOARD_SPECS, testPatternArtwork } from "@/lib/dieline";
import { createModelDoc } from "@/components/designer/lib/doc";
import { definitionFor, ALL_OPTION_KEYS } from "@/lib/vessels/families/flexible/definitions";
import { safeParseFlexConfig } from "@/lib/vessels/families/flexible/schema";
import type { DesignDoc, Dims, StructureFeatures } from "@/types";

const only = process.env.ONLY ? new Set(process.env.ONLY.split(",")) : null;
type V = { code: string; slug: string; kind: "box" | "vessel"; variant: string; doc: DesignDoc; note?: string };
const out: V[] = [];

function withPattern(doc: DesignDoc): DesignDoc | null {
  const g = docGeometry(doc);
  if (!g) return null;
  // The doc schema caps text at 400 pt: big shipping cases would otherwise be rejected on resume.
  const outside = testPatternArtwork(g.dieline, "outside");
  outside.layers = outside.layers.map((l) => (l.kind === "text" ? { ...l, fontSizePt: Math.min(400, l.fontSizePt) } : l));
  return { ...doc, artwork: { outside, inside: { background: null, layers: [] } } };
}

function boxBuilds(m: BoxModelDef, d: Dims, f?: StructureFeatures): boolean {
  try {
    m.build(d, { thicknessMm: BOARD_SPECS[m.materials[0]].thicknessMm, features: f });
    return true;
  } catch {
    return false;
  }
}

/** Smallest / largest size that builds: start at the limit corner, walk toward the default. */
function extreme(m: BoxModelDef, which: "min" | "max"): Dims | null {
  const def = m.defaultDims;
  const lim = m.limits;
  const corner = { L: lim.L[which], W: lim.W[which], H: lim.H[which] } as Dims;
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const d = { L: Math.round(corner.L + (def.L - corner.L) * t), W: Math.round(corner.W + (def.W - corner.W) * t), H: Math.round(corner.H + (def.H - corner.H) * t) };
    if (boxBuilds(m, d)) return d;
  }
  return null;
}

function addBox(m: BoxModelDef) {
  const push = (variant: string, doc: DesignDoc | null, note?: string) => {
    const d = doc && withPattern(doc);
    if (d) out.push({ code: m.code, slug: m.slug, kind: "box", variant, doc: d, note });
  };
  const def = createModelDoc(m);
  push("def", def);
  for (const w of ["min", "max"] as const) {
    const d = extreme(m, w);
    if (d && (d.L !== def.dims.L || d.W !== def.dims.W || d.H !== def.dims.H)) push(w, createModelDoc(m, { dims: d }), `${d.L}×${d.W}×${d.H}`);
  }
  const f = m.features;
  const feat = (variant: string, features: StructureFeatures) => {
    const all = { ...def.features, ...features };
    if (boxBuilds(m, def.dims, all)) push(variant, { ...def, features: all });
  };
  for (const face of f.windowFaces) feat(`win-${face}`, { window: { face, widthRatio: 0.55, heightRatio: 0.45, film: true } });
  if (f.handle && !def.features?.handle) feat("handle", { handle: true });
  if (f.thumbNotch) feat("notch", { thumbNotch: true });
  if (f.tearStrip) feat("tear", { tearStrip: true });
  if (f.partitions) feat("part", { partitions: { rows: 2, cols: 3 } });
  if (f.displayFront) feat("display", { displayFront: true });
  if (f.lidHeight) feat("lid", { lidHeightMm: Math.max(15, Math.round(def.dims.H * 0.4)) });
  // One other board, the one that looks / folds most differently (caliper first, then liner
  // colour), shown BLANK so the board itself (kraft / white / flute edge) is what is judged.
  const d0 = BOARD_SPECS[m.materials[0]];
  const alt = [...m.materials.slice(1)].sort((a, b) => score(b) - score(a))[0];
  function score(c: (typeof m.materials)[number]) {
    const s = BOARD_SPECS[c];
    return (s.thicknessMm !== d0.thicknessMm ? 2 : 0) + (s.color !== d0.color ? 1 : 0) + (s.family !== d0.family ? 1 : 0);
  }
  if (alt) {
    const doc = createModelDoc(m, { materialCode: alt });
    if (docGeometry(doc)) out.push({ code: m.code, slug: m.slug, kind: "box", variant: `mat-${alt}`, doc });
  }
  if (docGeometry(def)) out.push({ code: m.code, slug: m.slug, kind: "box", variant: "blank", doc: def });
}

function addVessel(m: VesselModelDef) {
  const def = createModelDoc(m);
  const push = (variant: string, doc: DesignDoc | null, note?: string) => {
    const d = doc && withPattern(doc);
    if (d) out.push({ code: m.code, slug: m.slug, kind: "vessel", variant, doc: d, note });
  };
  const v = def.vessel!;
  push("def", def);
  for (const w of ["min", "max"] as const) {
    const base = v.dims;
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const lerp = (lim: [number, number] | undefined, cur: number | undefined) => (lim && cur !== undefined ? Math.round(lim[w === "min" ? 0 : 1] + (cur - lim[w === "min" ? 0 : 1]) * t) : cur);
      const L = m.limits as unknown as { D: [number, number]; H: [number, number]; G?: [number, number] };
      const range = (r: unknown) => (Array.isArray(r) ? (r as [number, number]) : r && typeof r === "object" ? [(r as { min: number }).min, (r as { max: number }).max] as [number, number] : undefined);
      const dims = { ...base, D: lerp(range(L.D), base.D)!, H: lerp(range(L.H), base.H)!, ...(base.G !== undefined ? { G: lerp(range(L.G), base.G) } : {}) };
      const doc = { ...def, vessel: { ...v, dims, presetId: undefined } };
      if (docGeometry(doc)) {
        if (dims.D !== base.D || dims.H !== base.H) push(w, doc, `D${dims.D} H${dims.H}${dims.G ? ` G${dims.G}` : ""}`);
        break;
      }
    }
  }
  for (const c of m.containers) if (c.code !== m.defaultContainer) push(`c-${c.code}`, { ...def, vessel: { ...v, container: c.code } });
  for (const c of m.closures) if (c.code !== m.defaultClosure) push(`k-${c.code}`, { ...def, vessel: { ...v, closure: c.code } });
  if (m.render === "flexible") {
    let fd: ReturnType<typeof definitionFor> | null = null;
    try {
      fd = definitionFor(m.code as Parameters<typeof definitionFor>[0]);
    } catch {
      fd = null;
    }
    if (fd) {
      for (const k of ALL_OPTION_KEYS.filter((k) => fd!.allowedOptions.includes(k))) {
        const cur = fd.defaultOptions[k];
        const val: boolean | string = k === "spout" ? "corner" : k === "hangHole" ? "euro" : !cur;
        if (cur === val) continue;
        const options = { ...v.options, [k]: val };
        const ok = safeParseFlexConfig({ code: fd.code, dims: { W: v.dims.D, H: v.dims.H, ...(fd.limits.G ? { G: v.dims.G ?? fd.defaultDims.G } : {}) }, fill: fd.defaultFill, material: v.container, options });
        if (ok.success) push(`o-${k}`, { ...def, vessel: { ...v, options } });
      }
    }
  }
}

for (const m of MODELS) {
  if (only && !only.has(m.code)) continue;
  if (m.kind === "box") addBox(m);
  else addVessel(m);
}
process.stdout.write(JSON.stringify(out));
process.stderr.write(`${out.length} variants, ${new Set(out.map((o) => o.code)).size} models\n`);
