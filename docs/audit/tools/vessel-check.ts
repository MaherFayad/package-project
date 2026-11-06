/**
 * Numeric audit of every container model: profile volume vs nominal capacity (default preset),
 * envelope, and option collapse (distinct container / closure options that map to the SAME core
 * renderer code, so picking them cannot change the 3D model).
 * usage: npx tsx --tsconfig tsconfig.json docs/audit/tools/vessel-check.ts
 */
import { VESSEL_MODELS } from "@/lib/library";
type Row = Record<string, unknown>;
const rows: Row[] = [];
for (const m of VESSEL_MODELS) {
  const preset = m.presets.find((p) => p.id === m.defaultPresetId) ?? m.presets[0];
  let vol: number | null = null;
  let env: unknown = null;
  let err = "";
  try {
    const d = m.describe(preset.dims, m.defaultSurfaces, preset.id);
    env = d.envelope;
    const prof = d.profile;
    if (prof) {
      // brimful inner volume by frustum integration of the outer profile minus wall, up to fillMaxY
      // clip every outer-profile segment to [baseMm, fillMaxY] (the profile goes down to the
      // push-up and back, so only rising segments count)
      const pts = prof.outer;
      let v = 0;
      const lo = prof.baseMm, hi = prof.fillMaxY;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        if (b.y <= a.y) continue;
        const at = (y: number) => a.r + ((b.r - a.r) * (y - a.y)) / (b.y - a.y);
        const y0 = Math.max(a.y, lo), y1 = Math.min(b.y, hi);
        if (y1 <= y0) continue;
        const r0 = Math.max(0, at(y0) - prof.wallMm), r1 = Math.max(0, at(y1) - prof.wallMm);
        v += (Math.PI * (y1 - y0) * (r0 * r0 + r0 * r1 + r1 * r1)) / 3;
      }
      const sectionFactor = (prof.section as { kind?: string })?.kind && (prof.section as { kind?: string }).kind !== "round" ? "non-round" : "round";
      vol = Math.round(v / 1000);
      env = { ...(env as object), section: sectionFactor };
    }
  } catch (e) {
    err = (e as Error).message;
  }
  const collapse = (opts: { code: string; core: string }[]) => {
    const by = new Map<string, string[]>();
    for (const o of opts) by.set(o.core, [...(by.get(o.core) ?? []), o.code]);
    return [...by.entries()].filter(([, v]) => v.length > 1).map(([k, v]) => `${v.join("+")}→${k}`);
  };
  rows.push({
    code: m.code, source: m.source, coreKind: m.coreKind, render: m.render, preset: preset.id, dims: preset.dims, capacityMl: preset.capacityMl ?? null, profileVolMl: vol,
    ratio: vol && preset.capacityMl ? +(vol / preset.capacityMl).toFixed(2) : null, envelope: env, err,
    containerCollapse: collapse(m.containers), closureCollapse: collapse(m.closures), containers: m.containers.map((c) => `${c.code}→${c.core}`), closures: m.closures.map((c) => `${c.code}→${c.core}`),
  });
}
console.log(JSON.stringify(rows, null, 1));
