/**
 * Geometry snapshot of every box model in the library (PERF-03, round 4).
 *
 * The dieline core (fold.ts, generate.ts, structures.ts, illustration.ts) moved from three.js
 * math to the local ./math module. This test pins the exact output of every generator so that
 * move (and any later refactor) cannot change a single number: the full dieline, the panel
 * poses at three fold progresses, the bounds and the illustration SVG are hashed per model.
 *
 * Regenerate only for an intended geometry change:
 *   UPDATE_GEOMETRY_SNAPSHOT=1 npx vitest run src/lib/dieline/__tests__/geometry-snapshot.test.ts
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BOX_MODELS } from "@/lib/library";
import { STRUCTURE_CODES, type StructureFeatures } from "@/types";
import {
  BOARD_SPECS,
  DEFAULT_DIMS,
  FEATURE_SUPPORT,
  boundsAt,
  computePoses,
  defaultMaterialFor,
  generateDieline,
  structureIllustrationSvg,
  type DielineModel,
} from "..";

const FILE = path.join(__dirname, "__snapshots__", "geometry.json");
const update = process.env.UPDATE_GEOMETRY_SNAPSHOT === "1";

const sha = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 24);
const arr = (m: { elements: ArrayLike<number> }) => Array.from(m.elements);
const box = (b: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } }) => [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z];

function fingerprint(d: DielineModel): Record<string, string> {
  const poses = [0, 0.37, 1].map((p) => {
    const m = computePoses(d, p);
    return [...m.entries()].map(([id, pose]) => [id, arr(pose.local), arr(pose.world)]);
  });
  return {
    dieline: sha(d),
    poses: sha(poses),
    bounds: sha([0, 0.5, 1].map((p) => box(boundsAt(d, p)))),
    svg: sha(structureIllustrationSvg(d, { width: 320, height: 240, outside: "#c8a27a", inside: "#e9dcc9" })),
  };
}

function snapshot(): Record<string, Record<string, string> | string> {
  const out: Record<string, Record<string, string> | string> = {};
  for (const m of BOX_MODELS) {
    const t = BOARD_SPECS[m.materials[0]].thicknessMm;
    try {
      out[m.code] = fingerprint(m.build(m.defaultDims, { thicknessMm: t, features: {} }));
    } catch (e) {
      out[m.code] = `throws: ${(e as Error).message}`;
    }
  }
  // Core structures again with every supported feature switched on (windows, inserts, …).
  for (const code of STRUCTURE_CODES) {
    const s = FEATURE_SUPPORT[code];
    const features: StructureFeatures = {
      window: s.windowFaces[0] ? { face: s.windowFaces[0] } : null,
      thumbNotch: s.thumbNotch,
      handle: s.handle,
      tearStrip: s.tearStrip,
      partitions: s.partitions ? { rows: 2, cols: 3 } : null,
      displayFront: s.displayFront,
    };
    try {
      out[`${code}+features`] = fingerprint(generateDieline(code, DEFAULT_DIMS[code], { thicknessMm: BOARD_SPECS[defaultMaterialFor(code)].thicknessMm, features }));
    } catch (e) {
      out[`${code}+features`] = `throws: ${(e as Error).message}`;
    }
  }
  return out;
}

describe("geometry snapshot (every box model)", () => {
  it("matches the recorded output of every generator", () => {
    const now = snapshot();
    if (update || !fs.existsSync(FILE)) {
      fs.writeFileSync(FILE, JSON.stringify(now, null, 1) + "\n");
      return;
    }
    const before = JSON.parse(fs.readFileSync(FILE, "utf8")) as typeof now;
    expect(Object.keys(now).sort()).toEqual(Object.keys(before).sort());
    const changed = Object.keys(before).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(now[k]));
    expect(changed).toEqual([]);
  }, 300_000);
});
