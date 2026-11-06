import { boardAppearance, structureIllustrationSvg, BOARD_SPECS } from "@/lib/dieline";
import { VESSEL_MATERIALS, CLOSURE_COLORS, closureHeightAbove, type ClosureKind, type VesselMaterialCode } from "@/lib/vessels";
import { describeVesselModel } from "./vessels";
import type { ModelDef, VesselModelDef } from "./types";

/**
 * Catalogue thumbnails drawn from the REAL models: boxes are projected from their fold model
 * (structureIllustrationSvg), containers from their lathe profile (front silhouette with the
 * print areas shaded). Pure strings: generated to public/models by scripts/generate-model-thumbnails.ts.
 */

const BODY: Partial<Record<VesselMaterialCode, { fill: string; edge: string; opacity: number }>> = {
  GLASS_CLEAR: { fill: "#dce9ec", edge: "#9fb7bd", opacity: 0.85 },
  GLASS_AMBER: { fill: "#9a5a1c", edge: "#5e3410", opacity: 0.95 },
  GLASS_FROSTED: { fill: "#e9eeee", edge: "#b9c4c4", opacity: 0.95 },
  PET_CLEAR: { fill: "#e3eff4", edge: "#a9c2cc", opacity: 0.8 },
  HDPE_WHITE: { fill: "#f3f3f0", edge: "#c4c4bd", opacity: 1 },
  ALUMINIUM: { fill: "#c9ced3", edge: "#8d949b", opacity: 1 },
  TINPLATE: { fill: "#d4d7da", edge: "#959ca2", opacity: 1 },
  KRAFT_POUCH: { fill: "#b98d5e", edge: "#8a6640", opacity: 1 },
  WHITE_POUCH: { fill: "#f4f3ef", edge: "#c9c7bf", opacity: 1 },
  PE_TUBE_WHITE: { fill: "#f6f6f3", edge: "#c8c8c2", opacity: 1 },
};

const r1 = (n: number) => Math.round(n * 10) / 10;

function vesselSvg(m: VesselModelDef, title: string, W = 480, H = 360): string {
  const preset = m.presets.find((p) => p.id === m.defaultPresetId) ?? m.presets[0];
  const d = describeVesselModel(m, preset.dims, m.defaultSurfaces, preset.id);
  const coreMat = (m.containers.find((c) => c.code === m.defaultContainer)?.core ?? "HDPE_WHITE") as VesselMaterialCode;
  const look = BODY[coreMat] ?? BODY.HDPE_WHITE!;
  const label = "#1f3d2b";
  const pad = 28;
  const env = d.envelope;
  const s = Math.min((W - 2 * pad) / Math.max(env.width, 1), (H - 2 * pad) / Math.max(env.height, 1));
  const cx = W / 2;
  const base = H - pad;
  const parts: string[] = [];
  parts.push(`<ellipse cx="${cx}" cy="${r1(base + 4)}" rx="${r1((env.width * s) / 2)}" ry="6" fill="#000" opacity="0.08"/>`);
  if (d.profile) {
    const out = d.profile.outer;
    const right = out.map((p) => `${r1(cx + p.r * s)},${r1(base - p.y * s)}`);
    const left = [...out].reverse().map((p) => `${r1(cx - p.r * s)},${r1(base - p.y * s)}`);
    parts.push(
      `<defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="${look.edge}"/><stop offset="0.35" stop-color="${look.fill}"/><stop offset="0.7" stop-color="${look.fill}"/><stop offset="1" stop-color="${look.edge}"/></linearGradient></defs>`,
    );
    parts.push(`<polygon points="${[...right, ...left].join(" ")}" fill="url(#g)" stroke="${look.edge}" stroke-width="1.2" opacity="${look.opacity}"/>`);
    // Print areas on the body (wrap / front / sleeve bands).
    const b = d.profile.body;
    for (const a of d.areas) {
      if (!["WRAP", "FRONT", "SHRINK_SLEEVE"].includes(a.kind)) continue;
      const h = Math.min(a.trimHeightMm, b.y1 - b.y0);
      const yMid = (b.y0 + b.y1) / 2;
      const rr = Math.max(b.r0, b.r1);
      const w = a.kind === "FRONT" ? Math.min(rr * 1.4, a.trimWidthMm) : rr * 2;
      parts.push(`<rect x="${r1(cx - (w * s) / 2)}" y="${r1(base - (yMid + h / 2) * s)}" width="${r1(w * s)}" height="${r1(h * s)}" rx="2" fill="${label}" opacity="0.88"/>`);
      parts.push(`<rect x="${r1(cx - (w * s) / 2 + w * s * 0.18)}" y="${r1(base - yMid * s - 5)}" width="${r1(w * s * 0.64)}" height="10" rx="3" fill="#f2c14e"/>`);
      break;
    }
    // Closure.
    const closure = (m.closures.find((c) => c.code === m.defaultClosure)?.core ?? "") as ClosureKind;
    if (closure) {
      const top = d.profile.finishTopY;
      const ch = Math.max(6, closureHeightAbove(closure) + d.profile.finishH);
      const cr = d.profile.finishR + 1.5;
      parts.push(`<rect x="${r1(cx - cr * s)}" y="${r1(base - (top + closureHeightAbove(closure)) * s)}" width="${r1(2 * cr * s)}" height="${r1(ch * s)}" rx="3" fill="${CLOSURE_COLORS.BLACK.hex}"/>`);
    }
  } else {
    // Flexible pack: front panel outline with a top seal and a label panel.
    const w = env.width * s;
    const h = env.height * s;
    const x = cx - w / 2;
    const y = base - h;
    const kraft = m.defaultContainer.includes("KRAFT");
    const fill = kraft ? "#b98d5e" : "#eef0f2";
    parts.push(`<path d="M${r1(x)},${r1(y)} h${r1(w)} v${r1(h * 0.9)} q0,${r1(h * 0.1)} -${r1(w * 0.12)},${r1(h * 0.1)} h-${r1(w * 0.76)} q-${r1(w * 0.12)},0 -${r1(w * 0.12)},-${r1(h * 0.1)} z" fill="${fill}" stroke="#9aa0a6" stroke-width="1.2"/>`);
    parts.push(`<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(Math.max(6, h * 0.06))}" fill="#000" opacity="0.08"/>`);
    parts.push(`<rect x="${r1(x + w * 0.14)}" y="${r1(y + h * 0.3)}" width="${r1(w * 0.72)}" height="${r1(h * 0.34)}" rx="4" fill="${label}"/>`);
    parts.push(`<rect x="${r1(x + w * 0.26)}" y="${r1(y + h * 0.44)}" width="${r1(w * 0.48)}" height="10" rx="3" fill="#f2c14e"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img"><title>${escapeXml(title)}</title>${parts.join("")}</svg>`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);
}

/** SVG thumbnail of a model at its default size (English title). */
export function modelThumbnailSvg(m: ModelDef): string {
  if (m.kind === "vessel") return vesselSvg(m, m.name.en);
  const mat = m.materials[0];
  const look = boardAppearance(mat);
  const model = m.build(m.defaultDims, { thicknessMm: BOARD_SPECS[mat].thicknessMm });
  return structureIllustrationSvg(model, { width: 480, height: 360, outside: look.outside, inside: look.inside, background: null, title: m.name.en });
}

export { VESSEL_MATERIALS };
