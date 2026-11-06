import { BufferAttribute, BufferGeometry, CircleGeometry, SphereGeometry, TorusGeometry, BoxGeometry, Matrix4 } from "three";
import * as FOOD from "@/lib/dieline/families/foodservice";
import { blisterLayout } from "@/lib/vessels/families/cosmetic-cans";

/**
 * Plain mesh parts for catalogue models that are not folding dielines: paper cups, bowls and
 * sleeves (conical wraps), revolved lids, moulded pulp height fields and blister cards. Built
 * from the family geometry (src/lib/dieline/families/foodservice, cosmetic-cans), in mm with
 * Y up and the part resting on y = 0. The stage scales to metres.
 */

export type PartLook = "cupstock" | "cupstockInner" | "kraft" | "plasticClear" | "plasticWhite" | "pulp" | "foil" | "pvc" | "pill";

export interface MeshPart {
  geometry: BufferGeometry;
  look: PartLook;
  /** Column-major 4×4 (mm) applied to the part. */
  matrix?: Matrix4;
}

function fromData(d: FOOD.MeshData): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(d.positions, 3));
  g.setAttribute("uv", new BufferAttribute(d.uvs, 2));
  g.setIndex(new BufferAttribute(d.indices, 1));
  g.computeVertexNormals();
  return g;
}

function cupParts(cup: FOOD.CupModel, look: PartLook = "cupstock"): MeshPart[] {
  const parts: MeshPart[] = [{ geometry: fromData(FOOD.fanMesh(cup.sidewall, 72, 8)), look: cup.outerWall ? "cupstockInner" : look }];
  if (cup.outerWall) parts.push({ geometry: fromData(FOOD.fanMesh(cup.outerWall, 72, 8)), look });
  const base = new CircleGeometry(cup.base.radius, 48).applyMatrix4(new Matrix4().makeRotationX(-Math.PI / 2)).translate(0, cup.base.y, 0);
  parts.push({ geometry: base, look: "cupstockInner" });
  const rim = new TorusGeometry(cup.rim.radius, cup.rim.tube, 10, 72).applyMatrix4(new Matrix4().makeRotationX(Math.PI / 2)).translate(0, cup.rim.y, 0);
  parts.push({ geometry: rim, look: "cupstockInner" });
  return parts;
}

/** Height-field grid closed by a skirt down to y = 0 (moulded fibre is a thin shell). */
function pulpParts(m: FOOD.PulpModel): MeshPart[] {
  const parts: MeshPart[] = [{ geometry: fromData(FOOD.heightFieldMesh(m, "base", 3)), look: "pulp" }];
  if (m.layout.lid) {
    // Lid shown open on its back hinge so the cells read in the thumbnail.
    const lid = fromData(FOOD.heightFieldMesh(m, "lid", 4));
    const hingeZ = -m.dims.W / 2;
    const hingeY = m.baseHeightMm;
    const open = new Matrix4()
      .makeTranslation(0, hingeY, hingeZ)
      .multiply(new Matrix4().makeRotationX(-Math.PI * 0.62))
      .multiply(new Matrix4().makeTranslation(0, -hingeY, -hingeZ));
    lid.applyMatrix4(open);
    parts.push({ geometry: lid, look: "pulp" });
  }
  return parts;
}

function blisterParts(dims: { D: number; H: number; G: number; rows?: number; cols?: number; cavityD?: number }): MeshPart[] {
  const b = blisterLayout(dims);
  const card = new BoxGeometry(b.widthMm, 0.6, b.heightMm).translate(0, 0.3, 0);
  const parts: MeshPart[] = [{ geometry: card, look: "foil" }];
  for (const c of b.cavities) {
    const r = c.d / 2;
    const x = c.x - b.widthMm / 2;
    const z = c.y - b.heightMm / 2;
    const dome = new SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, b.cavityDepthMm / r, 1).translate(x, 0.6, z);
    parts.push({ geometry: dome, look: "pvc" });
    const pill = new SphereGeometry(r * 0.78, 20, 10).scale(1, (b.cavityDepthMm * 0.42) / (r * 0.78), 1).translate(x, 0.6 + b.cavityDepthMm * 0.42, z);
    parts.push({ geometry: pill, look: "pill" });
  }
  return parts;
}

export type MeshKind = "cup" | "lid" | "pulp" | "blister";

/** Mesh parts of a catalogue model at a size (mm). Throws on invalid dims. */
export function meshPartsFor(kind: MeshKind, code: string, dims: Record<string, number>): MeshPart[] {
  if (kind === "blister") return blisterParts({ D: dims.D, H: dims.H, G: dims.G ?? 4, rows: dims.rows, cols: dims.cols, cavityD: dims.cavityD });
  const r = FOOD.buildFoodservice(code as FOOD.FoodserviceCode, dims as never);
  if (r.kind === "frustum") {
    if ("fan" in r.model) {
      // Cup sleeve: the sleeve band on a plain cup it grips.
      const s = r.model;
      const cup = FOOD.buildCup(s.cup, "single");
      return [...cupParts(cup, "cupstock"), { geometry: fromData(FOOD.fanMesh(s.fan, 72, 4)), look: "kraft" }];
    }
    return cupParts(r.model);
  }
  if (r.kind === "lathe") {
    const lid = r.model;
    return [{ geometry: fromData(FOOD.latheMesh(lid.profile, 72)), look: lid.role === "cup-lid" ? "plasticWhite" : "cupstock" }];
  }
  if (r.kind === "molded") return pulpParts(r.model);
  throw new Error(`${code} is a dieline, not a mesh model`);
}
