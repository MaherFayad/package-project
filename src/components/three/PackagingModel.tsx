"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, type ReactElement } from "react";
import { Color, DoubleSide, MeshBasicMaterial, MeshPhysicalMaterial, Vector3, type BufferGeometry, type Group, type Material, type Texture } from "three";
import type { FinishCode, MaterialCode } from "@/types";
import { boardAppearance, boundsAt, computePoses, rootIds, type BoardAppearance, type DielineModel, type DielinePanel, type Segment } from "@/lib/dieline";
import { createBoardMaterials, type BoardMaterialSet } from "./boardMaterials";
import { buildFilmGeometry, buildPanelGeometry, buildPerfGeometry, pointInPolygon } from "./panelGeometry";
import { useTextureQuality } from "./perf";
import { buildAccessoryGeometry, createAccessoryMaterial } from "./accessories";

/** World units are metres; dieline geometry is in millimetres. */
export const MM = 0.001;

export interface ArtworkTextures {
  outside?: Texture | null;
  inside?: Texture | null;
}

export interface PackagingModelProps {
  dieline: DielineModel;
  /** One texture per printed surface, painted in sheet space (see paintArtworkSurface). */
  artworkTextures?: ArtworkTextures;
  /** Board (material code or a custom appearance). */
  material: MaterialCode | BoardAppearance;
  finish?: FinishCode;
  /** Show the inside texture (printSides === "BOTH"). Default: true when an inside texture is given. */
  printInside?: boolean;
  /**
   * 0 = flat sheet, 1 = closed box. A ref is read every frame (for animation without
   * React re-renders); a number is applied on render.
   */
  foldProgress: number | { readonly current: number };
  castShadow?: boolean;
  /**
   * Added by finishes: use these [outside, inside, edge] materials instead of building them
   * (FinishedPackagingModel owns and disposes them; `material` / `finish` are then ignored).
   */
  materialsOverride?: BoardMaterialSet;
}

/**
 * The folding box. Builds a nested group per panel (pivot on its hinge) so every flap
 * turns with its parent, and keeps the model resting on y = 0, centred on x/z.
 */
export function PackagingModel({
  dieline,
  artworkTextures,
  material,
  finish,
  printInside,
  foldProgress,
  castShadow = true,
  materialsOverride,
}: PackagingModelProps) {
  const invalidate = useThree((s) => s.invalidate);
  const appearance = typeof material === "string" ? boardAppearance(material) : material;
  const outsideMap = artworkTextures?.outside ?? null;
  const insideMap = artworkTextures?.inside ?? null;
  const showInside = printInside ?? !!insideMap;
  // sharp artwork on faces seen at an angle (renderer max, capped at 8×)
  useTextureQuality(outsideMap, insideMap);

  const ownMaterials = useMemo(
    () =>
      materialsOverride ? null : createBoardMaterials({ appearance, finish, outsideMap, insideMap, sheet: dieline.sheet, printInside: showInside }),
    // appearance is derived from `material`; compare its fields, not identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [materialsOverride, JSON.stringify(appearance), finish, outsideMap, insideMap, dieline.sheet.width, dieline.sheet.height, showInside],
  );
  useEffect(() => () => ownMaterials?.dispose(), [ownMaterials]);
  const materials = (materialsOverride ?? ownMaterials)!;

  const geometries = useMemo(() => new Map(dieline.panels.map((p) => [p.id, buildPanelGeometry(dieline, p)])), [dieline]);
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);

  // Window film (inside) and tear-strip perforations (outside), per panel.
  const extras = useMemo(() => {
    const films = new Map<string, BufferGeometry[]>();
    for (const f of dieline.films ?? []) {
      const panel = dieline.panels.find((p) => p.id === f.panelId);
      if (!panel) continue;
      films.set(panel.id, [...(films.get(panel.id) ?? []), buildFilmGeometry(dieline, panel, f.polygon)]);
    }
    const perfByPanel = new Map<string, Segment[]>();
    for (const s of dieline.perfLines ?? []) {
      const mid = { x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 };
      const panel = dieline.panels.find((p) => pointInPolygon(mid, p.polygon));
      if (panel) perfByPanel.set(panel.id, [...(perfByPanel.get(panel.id) ?? []), s]);
    }
    const perfs = new Map<string, BufferGeometry>();
    for (const [id, lines] of perfByPanel) perfs.set(id, buildPerfGeometry(dieline, dieline.panels.find((p) => p.id === id)!, lines));
    return { films, perfs };
  }, [dieline]);
  useEffect(
    () => () => {
      extras.films.forEach((list) => list.forEach((g) => g.dispose()));
      extras.perfs.forEach((g) => g.dispose());
    },
    [extras],
  );
  const extraMaterials = useMemo(
    () => ({
      film: new MeshPhysicalMaterial({ color: new Color("#ffffff"), transparent: true, opacity: 0.16, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, side: DoubleSide, depthWrite: false }),
      perf: new MeshBasicMaterial({ color: new Color("#1a1a1a"), transparent: true, opacity: 0.5, depthWrite: false }),
    }),
    [],
  );
  useEffect(() => () => {
    extraMaterials.film.dispose();
    extraMaterials.perf.dispose();
  }, [extraMaterials]);

  const children = useMemo(() => {
    const m = new Map<string, DielinePanel[]>();
    for (const p of dieline.panels) {
      if (!p.parentId) continue;
      const list = m.get(p.parentId) ?? [];
      list.push(p);
      m.set(p.parentId, list);
    }
    return m;
  }, [dieline]);

  // Ribbon pulls / bails (closed pose only): drawn in the resting frame, hidden while folding.
  const accessories = useMemo(
    () => (dieline.accessories ?? []).map((a) => ({ geometry: buildAccessoryGeometry(a), material: createAccessoryMaterial(a) })),
    [dieline],
  );
  useEffect(
    () => () =>
      accessories.forEach((a) => {
        a.geometry.dispose();
        a.material.dispose();
      }),
    [accessories],
  );
  const accessoryGroup = useRef<Group>(null);

  const groups = useRef(new Map<string, Group>());
  const centre = useRef<Group>(null);
  const applied = useRef<{ model: DielineModel | null; p: number }>({ model: null, p: NaN });

  const readProgress = () => (typeof foldProgress === "number" ? foldProgress : foldProgress.current);

  const apply = (p: number) => {
    const progress = Math.min(1, Math.max(0, p));
    const poses = computePoses(dieline, progress);
    for (const [id, pose] of poses) {
      const g = groups.current.get(id);
      if (!g) continue;
      g.matrix.fromArray(pose.local.elements);
      g.matrixWorldNeedsUpdate = true;
    }
    const box = boundsAt(dieline, progress, poses);
    const c = box.getCenter(new Vector3());
    centre.current?.position.set(-c.x, -box.min.y, -c.z);
    if (accessoryGroup.current) accessoryGroup.current.visible = progress > 0.995;
    // TK-04: through a window the closed carton's cavity is in its own shade. The renderer lights
    // the inside like the outside (no occlusion), so the window read as an opaque light patch:
    // dim the inside board as a windowed box closes (open / flat it is lit as before).
    if (dieline.films?.length) {
      const inside = materials.list[1] as Material & { color?: Color; userData: { baseColor?: Color; cavity?: number } };
      if (inside.color) {
        inside.userData.baseColor ??= inside.color.clone();
        const k = Math.min(1, Math.max(0, (progress - 0.8) / 0.2));
        inside.userData.cavity = 1 - 0.42 * k * k * (3 - 2 * k);
        inside.color.copy(inside.userData.baseColor).multiplyScalar(inside.userData.cavity);
      }
    }
    applied.current = { model: dieline, p };
  };

  useLayoutEffect(() => {
    apply(readProgress());
    invalidate();
  });

  useFrame(() => {
    const p = readProgress();
    if (applied.current.model !== dieline || applied.current.p !== p) apply(p);
  });

  const renderPanel = (panel: DielinePanel): ReactElement => (
    <group
      key={panel.id}
      name={panel.id}
      matrixAutoUpdate={false}
      ref={(g: Group | null) => {
        if (g) groups.current.set(panel.id, g);
        else groups.current.delete(panel.id);
      }}
    >
      <mesh geometry={geometries.get(panel.id)} material={materials.list} castShadow={castShadow} receiveShadow userData={{ panelId: panel.id }} />
      {extras.perfs.has(panel.id) ? <mesh geometry={extras.perfs.get(panel.id)} material={extraMaterials.perf} renderOrder={1} /> : null}
      {(extras.films.get(panel.id) ?? []).map((g, i) => (
        <mesh key={`film${i}`} geometry={g} material={extraMaterials.film} renderOrder={2} />
      ))}
      {(children.get(panel.id) ?? []).map(renderPanel)}
    </group>
  );

  // Main blank first, then extra pieces (lid, dividers): each is its own root group.
  const roots = rootIds(dieline)
    .map((id) => dieline.panels.find((p) => p.id === id))
    .filter((p): p is DielinePanel => !!p);
  return (
    <group scale={MM} userData={{ elbaModel: true, sheet: dieline.sheet }}>
      <group ref={centre}>{roots.map(renderPanel)}</group>
      {accessories.length ? (
        <group ref={accessoryGroup}>
          {accessories.map((a, i) => (
            <mesh key={i} geometry={a.geometry} material={a.material} castShadow={castShadow} />
          ))}
        </group>
      ) : null}
    </group>
  );
}
