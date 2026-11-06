"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { BufferAttribute, CanvasTexture, CatmullRomCurve3, CylinderGeometry, Plane, SphereGeometry, TubeGeometry, Vector3, type BufferGeometry, type Group, type Material, type Mesh, type Texture } from "three";
import {
  LIQUIDS,
  VESSELS,
  pouchDims,
  type ClosureColorCode,
  type ClosureKind,
  type LabelFinishCode,
  type LabelSpec,
  type LabelStockCode,
  type LiquidCode,
  type VesselDims,
  type VesselKind,
  type VesselMaterialCode,
  type VesselProfile,
} from "@/lib/vessels";
import { configureArtworkTexture } from "../boardMaterials";
import { buildClosure, type ClosureStyle } from "./closures";
import {
  bandLabelGeometry,
  bodyGeometry,
  discLabelGeometry,
  faceLabelGeometry,
  innerRadiusAt,
  liquidGeometry,
  pouchBottomGeometry,
  pouchLabelGeometry,
  pouchPanelGeometry,
  revolve,
  ringsFromPoints,
  sleeveGeometry,
  tubeBodyGeometry,
} from "./geometry";
import { createClosureMaterial, createKraftTexture, createLabelMaterial, createLiquidMaterial, createVesselMaterial, isTransparentVessel, type VesselQuality } from "./materials";

/** World units are metres; vessel geometry is in millimetres. */
const MM = 0.001;

export interface VesselLabel {
  spec: LabelSpec;
  /** Artwork texture covering the print area, or pass `canvas` and the model makes one. */
  texture?: Texture | null;
  /** Canvas painted in flat print space (paintLabel). Bump `artworkVersion` after repainting. */
  canvas?: HTMLCanvasElement | null;
  stock: LabelStockCode;
  finish: LabelFinishCode;
}

export interface VesselModelProps {
  kind: VesselKind;
  dims: VesselDims;
  profile: VesselProfile;
  material: VesselMaterialCode;
  closure: ClosureKind;
  closureColor: ClosureColorCode;
  liquid: LiquidCode;
  /** 0..1 of the usable height. */
  fill: number;
  labels: VesselLabel[];
  quality: VesselQuality;
  /** Closure off (unscrewed, lifted, tab up). Animated. */
  open?: boolean;
  /** false (or reduced motion): every change jumps to its end state. */
  animate?: boolean;
  /** Bump to replay the entrance and sleeve-shrink animations. */
  replayKey?: string | number;
  /** Bump after repainting a label canvas. */
  artworkVersion?: number | string;
  /** Optional body colour (sRGB hex) over the material's default: green / cobalt glass, coloured HDPE, black ABS. */
  tint?: string | null;
  /** Optional bottle-neck closure style (crown, ROPP, cork + capsule, sparkling, pourer) over the core closure kind. */
  closureStyle?: ClosureStyle | null;
}

const easeOutBack = (t: number) => {
  const c1 = 1.4;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

const canvasIds = new WeakMap<object, number>();
let nextCanvasId = 1;
function canvasId(c: object): number {
  let id = canvasIds.get(c);
  if (!id) canvasIds.set(c, (id = nextCanvasId++));
  return id;
}

function useDisposable<T extends { dispose(): void } | null>(factory: () => T, deps: unknown[]): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(factory, deps);
  useEffect(() => () => value?.dispose(), [value]);
  return value;
}

/** Merge non-indexed / indexed geometries with position, normal and uv into one indexed geometry. */
function mergeSimple(list: BufferGeometry[]): BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (const g of list) {
    const base = pos.length / 3;
    const p = g.getAttribute("position");
    const n = g.getAttribute("normal");
    const u = g.getAttribute("uv");
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      nor.push(n.getX(i), n.getY(i), n.getZ(i));
      uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0);
    }
    const index = g.getIndex();
    if (index) for (let i = 0; i < index.count; i++) idx.push(base + index.getX(i));
    else for (let i = 0; i < p.count; i++) idx.push(base + i);
  }
  const out = new (list[0].constructor as new () => BufferGeometry)();
  out.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  out.setAttribute("normal", new BufferAttribute(new Float32Array(nor), 3));
  out.setAttribute("uv", new BufferAttribute(new Float32Array(uv), 2));
  out.setIndex(idx);
  out.computeBoundingSphere();
  return out;
}

/**
 * A container with its closure, product and print surfaces. Standing on y = 0, centred on its
 * axis, front facing +Z. Everything is built from @/lib/vessels so the 3D matches the print specs.
 */
export function VesselModel(props: VesselModelProps) {
  const { kind, dims, profile, material, closure, closureColor, liquid, fill, labels: labelInputs, quality, open = false, animate = true, replayKey, artworkVersion, tint, closureStyle } = props;
  const invalidate = useThree((s) => s.invalidate);

  // textures for labels given as canvases (one per canvas; a resized canvas gets a new one)
  const canvasKey = labelInputs.map((l) => (l.canvas ? `${l.spec.id}:${canvasId(l.canvas)}:${l.canvas.width}x${l.canvas.height}` : "-")).join("|");
  const ownTextures = useMemo(
    () => labelInputs.map((l) => (l.canvas && !l.texture ? configureArtworkTexture(new CanvasTexture(l.canvas), 8) : null)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canvasKey],
  );
  useEffect(() => () => ownTextures.forEach((t) => t?.dispose()), [ownTextures]);
  useEffect(() => {
    for (const t of ownTextures) if (t) t.needsUpdate = true;
    invalidate();
  }, [artworkVersion, ownTextures, invalidate]);
  const labels = labelInputs.map((l, i) => ({ ...l, texture: l.texture ?? ownTextures[i] ?? null }));
  const def = VESSELS[kind];
  const isPouch = kind === "STAND_UP_POUCH";
  const isTube = kind === "SQUEEZE_TUBE";
  const revolved = !isPouch && !isTube;
  const transparent = isTransparentVessel(material);
  const liquidInfo = LIQUIDS[liquid];
  const showLiquid = def.fillable && transparent && fill > 0.001;
  const thinMode = material === "PET_CLEAR" || (showLiquid && liquidInfo.clarity >= 0.8);
  const profileKey = JSON.stringify([kind, dims, profile.finishTopY, profile.finishR]);

  // ---------------------------------------------------------------- geometry
  // Phones ("low") get half the radial segments: silhouettes stay smooth at phone sizes and the
  // vertex / triangle load halves (PERF-12).
  const radial = quality === "low" ? 48 : 128;
  const body = useDisposable(() => (revolved ? bodyGeometry(profile, radial) : null), [profileKey, radial]);
  const tubeLabel = isTube ? labels.find((l) => l.spec.kind === "WRAP") : undefined;
  const tubeGeo = useDisposable(() => (isTube ? tubeBodyGeometry(dims, tubeLabel?.spec) : null), [profileKey, isTube, tubeLabel ? JSON.stringify(tubeLabel.spec.placement) + tubeLabel.spec.printWidthMm : ""]);
  const pouchGeo = useMemo(() => {
    if (!isPouch) return null;
    const front = pouchPanelGeometry(dims, "front");
    const back = pouchPanelGeometry(dims, "back");
    const bottom = pouchBottomGeometry(dims);
    const p = pouchDims(dims);
    const zip = new CylinderGeometry(0.7, 0.7, p.W - 2 * p.sideSeal, 12);
    zip.rotateZ(Math.PI / 2);
    return { front, back, bottom, zip, p };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileKey, isPouch]);
  useEffect(
    () => () => {
      if (pouchGeo) for (const g of [pouchGeo.front, pouchGeo.back, pouchGeo.bottom, pouchGeo.zip]) g.dispose();
    },
    [pouchGeo],
  );

  // Carry handle (jerrycan, jug, detergent, clip) or wire bail (pail): the bottle family puts the
  // centre line + tube radius on its profile; the core profile has none (3d-bottles E-02).
  const handleSpec = (profile as VesselProfile & { handle?: { kind: string; path: { x: number; y: number; z: number }[]; tubeRadiusMm: number } }).handle;
  const handleKey = handleSpec ? JSON.stringify(handleSpec) : "";
  const handleGeo = useDisposable(() => {
    if (!handleSpec || handleSpec.path.length < 2) return null;
    const pts = handleSpec.path.map((q) => new Vector3(q.x, q.y, q.z));
    const curve = new CatmullRomCurve3(pts, false, "centripetal");
    const r = handleSpec.tubeRadiusMm;
    const tube = new TubeGeometry(curve, radial === 48 ? 32 : 64, r, radial === 48 ? 10 : 16, false);
    // round the open ends into the wall / lugs
    const caps = [pts[0], pts[pts.length - 1]].map((q) => new SphereGeometry(r, 16, 12).translate(q.x, q.y, q.z));
    const merged = mergeSimple([tube, ...caps]);
    for (const g of [tube, ...caps]) g.dispose();
    return merged;
  }, [handleKey, radial]);
  const handleMat = useDisposable(() => (handleSpec?.kind === "bail" ? createClosureMaterial("capMetal", "SILVER") : null), [handleSpec?.kind]);

  const liquidGeo = useDisposable(() => (revolved && def.fillable ? liquidGeometry(profile, radial === 48 ? 32 : 72) : null), [profileKey, radial]);
  const surfaceGeo = useDisposable(() => {
    if (!revolved || !def.fillable) return null;
    // unit disc in the section shape, scaled to the inner radius at the fill height every frame
    return revolve(ringsFromPoints([{ r: 1, y: 0 }, { r: 0, y: 0 }]), { section: profile.section, segments: radial / 2 });
  }, [profileKey, radial]);

  const closureModel = useMemo(() => buildClosure(kind, closure, dims, profile, closureStyle), [kind, closure, dims, profile, closureStyle]);
  useEffect(() => () => closureModel.parts.forEach((p) => p.geometry.dispose()), [closureModel]);

  const labelGeos = useMemo(() => {
    const faceZ = (dims.G ?? dims.D) / 2;
    return labels
      .filter((l) => !(isTube && l.spec.kind === "WRAP"))
      .map((l) => {
        const s = l.spec;
        if (s.placement.type === "band") return { label: l, geometry: bandLabelGeometry(s, 0.18, radial) as BufferGeometry };
        if (s.placement.type === "disc") {
          const g = discLabelGeometry(s);
          g.translate(0, 0.18, 0);
          return { label: l, geometry: g as BufferGeometry, onLid: true };
        }
        if (s.placement.type === "face") return { label: l, geometry: isPouch ? pouchLabelGeometry(dims, s) : faceLabelGeometry(s, faceZ, profile) };
        const sl = sleeveGeometry(profile, s, 128);
        return { label: l, geometry: sl.geometry as BufferGeometry, sleeve: sl };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileKey, radial, labels.map((l) => `${l.spec.id}:${l.spec.trimWidthMm}x${l.spec.trimHeightMm}`).join("|")]);
  useEffect(() => () => labelGeos.forEach((g) => g.geometry.dispose()), [labelGeos]);

  // ---------------------------------------------------------------- materials
  const kraft = useDisposable(() => (material === "KRAFT_POUCH" ? createKraftTexture() : null), [material]);
  const bodyMat = useDisposable(() => {
    if (isTube && tubeLabel?.texture) return createLabelMaterial(tubeLabel.stock === "CLEAR_BOPP" ? "WHITE_BOPP" : tubeLabel.stock, tubeLabel.finish, tubeLabel.texture);
    return createVesselMaterial(material, quality, { thinMode, kraftMap: kraft, tint });
  }, [material, quality, thinMode, kraft, isTube, tubeLabel?.texture, tubeLabel?.stock, tubeLabel?.finish, tint]);
  const clipPlane = useMemo(() => new Plane(new Vector3(0, -1, 0), 0), []);
  const liquidMat = useDisposable(() => createLiquidMaterial(liquid, quality, [clipPlane]), [liquid, quality, clipPlane]);
  const surfaceMat = useDisposable(() => createLiquidMaterial(liquid, quality, []), [liquid, quality]);
  const closureMats = useMemo(() => {
    const map = new Map<string, Material>();
    for (const p of closureModel.parts) if (!map.has(p.role)) map.set(p.role, createClosureMaterial(p.role, closureColor));
    return map;
  }, [closureModel, closureColor]);
  useEffect(() => () => closureMats.forEach((m) => m.dispose()), [closureMats]);
  const labelMats = useMemo(
    // Build from the CURRENT label inputs (matched by spec id), not g.label: labelGeos is memoised
    // on geometry only, so g.label.texture can be a texture that ownTextures already disposed, and
    // three silently re-uploads a disposed texture that is still referenced (one orphan per mount).
    () =>
      labelGeos.map((g) => {
        const cur = labels.find((l) => l.spec.id === g.label.spec.id) ?? g.label;
        return createLabelMaterial(cur.stock, cur.finish, cur.texture);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [labelGeos, labels.map((l) => `${l.stock}:${l.finish}:${l.texture?.uuid ?? ""}`).join("|")],
  );
  useEffect(() => () => labelMats.forEach((m) => m.dispose()), [labelMats]);
  const pouchZipMat = useDisposable(() => (isPouch ? createVesselMaterial(material, quality, { kraftMap: kraft }) : null), [isPouch, material, kraft, quality]);

  useEffect(() => {
    for (const m of labelMats) m.needsUpdate = true;
    invalidate();
  }, [artworkVersion, labelMats, invalidate]);

  // ---------------------------------------------------------------- animation state
  const root = useRef<Group>(null);
  const inner = useRef<Group>(null);
  const moving = useRef<Group>(null);
  const tab = useRef<Group>(null);
  const surface = useRef<Mesh>(null);
  const sleeveMeshes = useRef<(Mesh | null)[]>([]);
  const anim = useRef({ enter: 0, fill: animate ? 0 : fill, open: open ? 1 : 0, shrink: animate ? 0 : 1 });
  const lastReplay = useRef<string | number | undefined>(undefined);
  useEffect(() => {
    if (lastReplay.current !== replayKey) {
      lastReplay.current = replayKey;
      anim.current.enter = animate ? 0 : 1;
      anim.current.shrink = animate ? 0 : 1;
      if (animate) anim.current.fill = Math.min(anim.current.fill, fill * 0.2);
    }
    invalidate();
  }, [replayKey, animate, fill, invalidate]);
  // a newly added sleeve shrinks on
  const sleeveKey = labelGeos.filter((g) => g.sleeve).map((g) => g.label.spec.id + g.label.spec.trimWidthMm).join("|");
  useEffect(() => {
    if (sleeveKey) anim.current.shrink = animate ? 0 : 1;
    invalidate();
  }, [sleeveKey, animate, invalidate]);
  useEffect(() => invalidate(), [fill, open, invalidate]);

  const tmp = useMemo(() => new Vector3(), []);
  const fillY = (f: number) => profile.baseMm + (profile.fillMaxY - profile.baseMm) * clamp01(f);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 1 / 8);
    const a = anim.current;
    let busy = false;
    const step = (cur: number, target: number, durS: number) => {
      if (!animate) return target;
      const d = dt / durS;
      const next = cur < target ? Math.min(target, cur + d) : Math.max(target, cur - d);
      if (next !== target) busy = true;
      return next;
    };
    // entrance: rise + settle
    a.enter = step(a.enter, 1, 0.7);
    if (root.current) {
      const e = easeOutBack(a.enter);
      root.current.position.y = (1 - e) * -0.006;
      const sc = MM * (0.94 + 0.06 * e);
      root.current.scale.setScalar(sc);
    }
    // fill level (exponential approach)
    if (animate) {
      const target = fill;
      const k = 1 - Math.exp(-dt * 4.5);
      a.fill = Math.abs(target - a.fill) < 0.0008 ? target : a.fill + (target - a.fill) * k;
      if (a.fill !== target) busy = true;
    } else a.fill = fill;
    if (showLiquid && inner.current) {
      const y = fillY(a.fill);
      inner.current.updateWorldMatrix(true, false);
      tmp.set(0, y, 0);
      inner.current.localToWorld(tmp);
      clipPlane.constant = tmp.y;
      if (surface.current) {
        const r = innerRadiusAt(profile, y);
        surface.current.position.y = y;
        surface.current.scale.set(r, 1, r);
        surface.current.visible = a.fill > 0.002;
      }
    }
    // closure open/close
    a.open = step(a.open, open ? 1 : 0, closureModel.motion === "tab" ? 0.6 : 1.3);
    const o = easeInOut(a.open);
    if (moving.current) {
      const m = moving.current;
      if (closureModel.motion === "unscrew") {
        const u = clamp01(o / 0.62);
        const l = clamp01((o - 0.62) / 0.38);
        const le = easeInOut(l);
        m.rotation.set(0, u * closureModel.turns * Math.PI * 2, -le * 0.2);
        m.position.set(le * (dims.D * 0.42 + 6), u * closureModel.rise + le * closureModel.lift, 0);
      } else if (closureModel.motion === "lift") {
        m.rotation.set(0, 0, -easeInOut(clamp01((o - 0.3) / 0.7)) * 0.22);
        m.position.set(easeInOut(clamp01((o - 0.25) / 0.75)) * (dims.D * 0.4 + 6), o * closureModel.lift, 0);
      } else {
        m.position.set(0, 0, 0);
        m.rotation.set(0, 0, 0);
      }
    }
    if (tab.current) tab.current.rotation.x = o * 1.15;
    // shrink sleeves: drop on, then shrink from the bottom up
    const shrinkBefore = a.shrink;
    a.shrink = step(a.shrink, 1, 1.5);
    labelGeos.forEach((g, i) => {
      const mesh = sleeveMeshes.current[i];
      if (!g.sleeve || !mesh) return;
      // settled sleeves keep their last pose: no per-frame vertex rewrite / re-upload (PERF-21)
      if (mesh.userData.shrink === a.shrink && shrinkBefore === a.shrink) return;
      mesh.userData.shrink = a.shrink;
      const pos = mesh.geometry.getAttribute("position") as BufferAttribute;
      const nor = mesh.geometry.getAttribute("normal") as BufferAttribute;
      const { start, target } = g.sleeve;
      const s = a.shrink;
      const drop = 1 - easeInOut(clamp01(s / 0.3));
      const heat = clamp01((s - 0.25) / 0.75);
      const rows = 91;
      const perRow = pos.count / rows;
      const P = pos.array as Float32Array;
      const N = nor.array as Float32Array;
      for (let r = 0; r < rows; r++) {
        const rowT = r / (rows - 1);
        const e = easeInOut(clamp01(heat * 1.5 - rowT * 0.5));
        for (let c = 0; c < perRow; c++) {
          const k = (r * perRow + c) * 3;
          P[k] = start.position[k] + (target.position[k] - start.position[k]) * e;
          P[k + 1] = target.position[k + 1] + drop * 18;
          P[k + 2] = start.position[k + 2] + (target.position[k + 2] - start.position[k + 2]) * e;
          N[k] = start.normal[k] + (target.normal[k] - start.normal[k]) * e;
          N[k + 1] = start.normal[k + 1] + (target.normal[k + 1] - start.normal[k + 1]) * e;
          N[k + 2] = start.normal[k + 2] + (target.normal[k + 2] - start.normal[k + 2]) * e;
        }
      }
      pos.needsUpdate = true;
      nor.needsUpdate = true;
      mesh.geometry.computeBoundingSphere();
    });
    if (busy) invalidate();
  });

  // ---------------------------------------------------------------- scene graph
  const staticParts = closureModel.parts.filter((p) => p.group === "static");
  const movingParts = closureModel.parts.filter((p) => p.group === "moving");
  const tabParts = closureModel.parts.filter((p) => p.group === "tab");
  const pivot = closureModel.pivot ?? [0, 0, 0];

  return (
    <group ref={root} scale={MM}>
      <group ref={inner}>
        {body ? <mesh geometry={body} material={bodyMat} renderOrder={2} /> : null}
        {handleGeo ? <mesh geometry={handleGeo} material={handleMat ?? bodyMat} renderOrder={2} /> : null}
        {tubeGeo ? <mesh geometry={tubeGeo} material={bodyMat} /> : null}
        {pouchGeo && pouchZipMat ? (
          <>
            <mesh geometry={pouchGeo.front} material={bodyMat} />
            <mesh geometry={pouchGeo.back} material={bodyMat} />
            <mesh geometry={pouchGeo.bottom} material={bodyMat} />
            <mesh geometry={pouchGeo.zip} material={pouchZipMat} position={[0, pouchGeo.p.zipperY, 1.1]} />
            <mesh geometry={pouchGeo.zip} material={pouchZipMat} position={[0, pouchGeo.p.zipperY, -1.1]} />
          </>
        ) : null}
        {showLiquid && liquidGeo ? <mesh geometry={liquidGeo} material={liquidMat} renderOrder={1} /> : null}
        {showLiquid && surfaceGeo ? <mesh ref={surface} geometry={surfaceGeo} material={surfaceMat} renderOrder={1} /> : null}
        {labelGeos.map((g, i) =>
          g.onLid ? null : (
            <mesh
              key={g.label.spec.id}
              ref={(m) => {
                sleeveMeshes.current[i] = m;
              }}
              geometry={g.geometry}
              material={labelMats[i]}
              renderOrder={3}
            />
          ),
        )}
        {staticParts.map((p, i) => (
          <mesh key={`s${i}`} geometry={p.geometry} material={closureMats.get(p.role)} position={p.position} />
        ))}
        <group ref={moving}>
          {movingParts.map((p, i) => (
            <mesh key={`m${i}`} geometry={p.geometry} material={closureMats.get(p.role)} position={p.position} />
          ))}
          {labelGeos.map((g, i) => (g.onLid ? <mesh key={g.label.spec.id} geometry={g.geometry} material={labelMats[i]} renderOrder={3} /> : null))}
        </group>
        {tabParts.length ? (
          <group position={pivot}>
            <group ref={tab}>
              <group position={[-pivot[0], -pivot[1], -pivot[2]]}>
                {tabParts.map((p, i) => (
                  <mesh key={`t${i}`} geometry={p.geometry} material={closureMats.get(p.role)} />
                ))}
              </group>
            </group>
          </group>
        ) : null}
      </group>
    </group>
  );
}
