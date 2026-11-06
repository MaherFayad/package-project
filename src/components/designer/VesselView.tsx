"use client";

import { useEffect, useMemo, type Ref } from "react";
import { CanvasTexture, SRGBColorSpace, type Texture } from "three";
import type { DesignDoc } from "@/types";
import { buildProfile, type ClosureColorCode, type ClosureKind, type LiquidCode, type VesselMaterialCode } from "@/lib/vessels";
import type { VesselModelDef } from "@/lib/library";
import type { DocGeometry } from "@/lib/library/doc";
import { buildFlexibleGroup, type FlexConfig, type FlexPanelId } from "@/lib/vessels/families/flexible";
import { VesselScene, VesselSceneContent } from "@/components/three/vessels/VesselScene";
import type { ClosureStyle, VesselLabel } from "@/components/three/vessels";
import type { PackagingSceneHandle } from "@/components/three";
import { labelFinishOf, labelStockOf } from "./lib/config";
import styles from "./designer.module.css";

/**
 * 3D view of a container design: the artwork painted on the print-area sheet is cut into one
 * canvas per label / panel and wrapped on the real container (lathe) or film pack (flexible).
 * Loaded lazily (three.js), like Scene3D.
 */
export default function VesselView({
  model,
  doc,
  geo,
  sheet,
  version,
  handleRef,
  turntable,
  open,
  ariaLabel,
  roleDescription,
  keyboardHint,
  fallback,
  onReady,
  embedded = false,
}: {
  model: VesselModelDef;
  doc: DesignDoc;
  geo: DocGeometry;
  sheet: HTMLCanvasElement | null;
  version: number;
  handleRef: Ref<PackagingSceneHandle | null>;
  turntable: boolean;
  open: boolean;
  ariaLabel: string;
  roleDescription: string;
  keyboardHint: string;
  fallback: string;
  /** First frame rendered (the stage fades its poster out). */
  onReady?: () => void;
  /** Render only the scene content, inside a parent `<EngineCanvas>` (PERF-09). */
  embedded?: boolean;
}) {
  const v = doc.vessel!;
  const desc = geo.vessel!;

  // One canvas per print area (trim + bleed), cropped from the painted sheet.
  const areaCanvases = useMemo(() => {
    const out = new Map<string, HTMLCanvasElement>();
    if (typeof document === "undefined") return out;
    for (const a of desc.areas) out.set(a.id, document.createElement("canvas"));
    return out;
  }, [desc.areas]);
  useEffect(() => {
    if (!sheet) return;
    const pxPerMm = sheet.width / geo.dieline.sheet.width;
    for (const a of desc.areas) {
      const c = areaCanvases.get(a.id);
      const panel = geo.dieline.panels.find((p) => p.id === a.id);
      if (!c || !panel) continue;
      const b = a.bleedMm;
      const sx = (panel.bbox.x - b) * pxPerMm;
      const sy = (panel.bbox.y - b) * pxPerMm;
      const sw = (panel.bbox.width + 2 * b) * pxPerMm;
      const sh = (panel.bbox.height + 2 * b) * pxPerMm;
      // Labels stay <= 2048 px on their long side.
      const scale = Math.min(1, 2048 / Math.max(sw, sh));
      c.width = Math.max(2, Math.round(sw * scale));
      c.height = Math.max(2, Math.round(sh * scale));
      const ctx = c.getContext("2d");
      if (!ctx) continue;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(sheet, sx, sy, sw, sh, 0, 0, c.width, c.height);
    }
  }, [sheet, version, desc.areas, areaCanvases, geo.dieline]);

  const containerCore = (model.containers.find((c) => c.code === v.container)?.core ?? model.containers[0]?.core ?? "HDPE_WHITE") as VesselMaterialCode;
  const closureCore = (model.closures.find((c) => c.code === v.closure)?.core ?? model.closures[0]?.core ?? "SCREW_CAP") as ClosureKind;
  // Added by 3D engine (X-01): real colour and closure style when the core renderer code is only the nearest match.
  const containerTint = model.containers.find((c) => c.code === v.container)?.tint ?? null;
  const closureStyle = (model.closures.find((c) => c.code === v.closure)?.closureStyle ?? null) as ClosureStyle | null;

  // Flexible packs: their own film model, textured per panel.
  const flexTextures = useMemo(() => {
    if (model.render !== "flexible") return null;
    const map: Partial<Record<FlexPanelId, Texture>> = {};
    for (const a of desc.areas) {
      const c = areaCanvases.get(a.id);
      if (!c || !a.panel) continue;
      const tex = new CanvasTexture(c);
      tex.colorSpace = SRGBColorSpace;
      tex.anisotropy = 4;
      map[a.panel as FlexPanelId] = tex;
    }
    return map;
  }, [model.render, desc.areas, areaCanvases]);
  useEffect(() => {
    if (!flexTextures) return;
    for (const t of Object.values(flexTextures)) if (t) t.needsUpdate = true;
  }, [flexTextures, version, sheet]);
  useEffect(() => () => Object.values(flexTextures ?? {}).forEach((t) => t?.dispose()), [flexTextures]);

  const flexGroup = useMemo(() => {
    if (model.render !== "flexible" || !desc.flex) return null;
    const cfg = { ...(desc.flex as FlexConfig), material: v.container as FlexConfig["material"] };
    try {
      return buildFlexibleGroup(cfg, { artwork: flexTextures ?? {} }).group;
    } catch {
      return buildFlexibleGroup(desc.flex as FlexConfig, { artwork: flexTextures ?? {} }).group;
    }
  }, [model.render, desc.flex, v.container, flexTextures]);
  useEffect(
    () => () => {
      flexGroup?.traverse((o) => {
        const mesh = o as unknown as { geometry?: { dispose(): void }; material?: { dispose(): void } | { dispose(): void }[] };
        mesh.geometry?.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
        for (const m of mats) {
          // Maps the group made itself (the crimp normal map) are freed with it; artwork maps
          // are freed by their own effect (a second dispose is a no-op).
          for (const v of Object.values(m as unknown as Record<string, unknown>)) if (v && (v as { isTexture?: boolean }).isTexture) (v as { dispose(): void }).dispose();
          m.dispose();
        }
      });
    },
    [flexGroup],
  );

  const labels: VesselLabel[] = useMemo(
    () =>
      desc.areas
        .filter((a) => a.spec)
        .map((a) => ({ spec: a.spec!, canvas: areaCanvases.get(a.id) ?? null, stock: labelStockOf(doc.materialCode), finish: labelFinishOf(doc) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [desc.areas, areaCanvases, doc.materialCode, doc.finishes],
  );

  const profile = desc.profile ?? buildProfile(model.coreKind, v.dims);
  if (embedded)
    return (
      <VesselSceneContent
        key={model.render === "flexible" ? `flex-${model.code}` : model.code}
        kind={model.coreKind}
        dims={v.dims}
        profile={profile}
        envelope={desc.envelope}
        material={containerCore}
        closure={closureCore}
        tint={containerTint}
        closureStyle={closureStyle}
        closureColor={(v.closureColor as ClosureColorCode) ?? "WHITE"}
        liquid={(v.content as LiquidCode) ?? model.defaultLiquid}
        fill={v.fill}
        labels={labels}
        artworkVersion={`${version}:${sheet ? 1 : 0}`}
        open={open}
        turntable={turntable}
        customObject={flexGroup}
        handleRef={handleRef as Ref<never>}
      />
    );
  return (
    <VesselScene
      key={model.render === "flexible" ? `flex-${model.code}` : model.code}
      kind={model.coreKind}
      dims={v.dims}
      profile={profile}
      envelope={desc.envelope}
      material={containerCore}
      closure={closureCore}
      tint={containerTint}
      closureStyle={closureStyle}
      closureColor={(v.closureColor as ClosureColorCode) ?? "WHITE"}
      liquid={(v.content as LiquidCode) ?? model.defaultLiquid}
      fill={v.fill}
      labels={labels}
      artworkVersion={`${version}:${sheet ? 1 : 0}`}
      open={open}
      turntable={turntable}
      customObject={flexGroup}
      handleRef={handleRef as Ref<never>}
      ariaLabel={ariaLabel}
      roleDescription={roleDescription}
      keyboardHint={keyboardHint}
      fallback={<p className={styles.sceneFallback}>{fallback}</p>}
      onReady={onReady}
    />
  );
}
