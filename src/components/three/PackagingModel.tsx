"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, type ReactElement } from "react";
import { Vector3, type Group, type Texture } from "three";
import type { FinishCode, MaterialCode } from "@/types";
import { boardAppearance, boundsAt, computePoses, type BoardAppearance, type DielineModel, type DielinePanel } from "@/lib/dieline";
import { createBoardMaterials } from "./boardMaterials";
import { buildPanelGeometry } from "./panelGeometry";

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
}: PackagingModelProps) {
  const invalidate = useThree((s) => s.invalidate);
  const appearance = typeof material === "string" ? boardAppearance(material) : material;
  const outsideMap = artworkTextures?.outside ?? null;
  const insideMap = artworkTextures?.inside ?? null;
  const showInside = printInside ?? !!insideMap;

  const materials = useMemo(
    () => createBoardMaterials({ appearance, finish, outsideMap, insideMap, sheet: dieline.sheet, printInside: showInside }),
    // appearance is derived from `material`; compare its fields, not identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(appearance), finish, outsideMap, insideMap, dieline.sheet.width, dieline.sheet.height, showInside],
  );
  useEffect(() => () => materials.dispose(), [materials]);

  const geometries = useMemo(() => new Map(dieline.panels.map((p) => [p.id, buildPanelGeometry(dieline, p)])), [dieline]);
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);

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
      g.matrix.copy(pose.local);
      g.matrixWorldNeedsUpdate = true;
    }
    const box = boundsAt(dieline, progress, poses);
    const c = box.getCenter(new Vector3());
    centre.current?.position.set(-c.x, -box.min.y, -c.z);
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
      <mesh geometry={geometries.get(panel.id)} material={materials.list} castShadow={castShadow} receiveShadow />
      {(children.get(panel.id) ?? []).map(renderPanel)}
    </group>
  );

  const root = dieline.panels.find((p) => p.id === dieline.rootId);
  return (
    <group scale={MM}>
      <group ref={centre}>{root ? renderPanel(root) : null}</group>
    </group>
  );
}
