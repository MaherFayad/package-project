"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Color } from "three";
import type { Artwork, TextLayer } from "@/types";
import { BOX_BOARDS, type BoxBoardCode, type FinishChoice } from "@/lib/configurator";
import { usePrefersReducedMotion } from "../hooks";
import { PackagingModel, type PackagingModelProps } from "../PackagingModel";
import { createFinishedBoardMaterials, finishTextures, type FinishMapTextures, type FinishedSurfaceState } from "./finishMaterial";
import { coatingLook, coatingOf, configBoardAppearance, fluteLayers, mixLook, type SurfaceLook } from "./looks";
import { finishMaskKey, paintFinishMaps } from "./masks";

export interface SurfaceFinishProps {
  /** Configurator board (includes boards without rate cards, e.g. BC double wall). */
  board: BoxBoardCode;
  /** ModelConfig.finishes: coatings plus masked foil / spot UV / emboss. */
  finishes: readonly FinishChoice[];
  /** The design's artwork: masks are painted from the layers each finish points at. */
  artwork?: Artwork | null;
  /** Decoded images keyed by ImageLayer.src (same map the artwork painter uses). */
  images?: Map<string, CanvasImageSource>;
  resolveFont?: (family: TextLayer["fontFamily"]) => string;
  /** Bump when artwork layers change (repaints masks). */
  version?: number | string;
}

export type FinishedPackagingModelProps = Omit<PackagingModelProps, "material" | "finish"> & { surfaceFinish: SurfaceFinishProps };

/** How much paper fibre shows through print (kraft a lot, film-laminated board barely). */
function detailFor(board: BoxBoardCode, coating: string | null): number {
  const s = BOX_BOARDS[board].surface;
  const base = s === "KRAFT_LINER" ? 0.34 : s === "WHITE_TOP_LINER" ? 0.16 : 0.05;
  if (coating === "SOFT_TOUCH_LAMINATION") return base * 0.6;
  if (coating?.endsWith("LAMINATION")) return base * 0.4;
  return base;
}

/** Tween time constant (s): ~95% settled after 3τ ≈ 360 ms. */
const TAU = 0.12;

/**
 * PackagingModel with real finishes (foil, spot UV, emboss/deboss, laminations, kraft fibre,
 * flute edges). Finish / board changes crossfade; new masks fade in. Respects reduced motion.
 */
export function FinishedPackagingModel({ surfaceFinish, ...model }: FinishedPackagingModelProps) {
  const { board, finishes, artwork, images, resolveFont, version } = surfaceFinish;
  const invalidate = useThree((s) => s.invalidate);
  const reduced = usePrefersReducedMotion();
  const { dieline } = model;
  const appearance = useMemo(() => configBoardAppearance(board), [board]);
  const coating = coatingOf(finishes);
  const layers = fluteLayers(board);
  const detail = detailFor(board, coating);
  // Process inks are transparent and there is no white: on uncoated kraft (and the brown inside
  // liner of corrugated) print multiplies with the board, so "white" artwork shows brown.
  const inkOnBoard = useMemo(
    () => ({ outside: BOX_BOARDS[board].surface === "KRAFT_LINER", inside: BOX_BOARDS[board].family === "CORRUGATED" }),
    [board],
  );

  const mats = useMemo(
    () => createFinishedBoardMaterials(dieline.sheet, appearance, layers, detail),
    // materials survive board / finish changes (they tween); only a new sheet size rebuilds them
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dieline.sheet.width, dieline.sheet.height],
  );
  useEffect(() => () => mats.dispose(), [mats]);
  useEffect(() => {
    mats.setBoard(appearance, layers, detail);
    invalidate();
  }, [mats, appearance, layers, detail, invalidate]);

  const outsideMap = model.artworkTextures?.outside ?? null;
  const insideMapRaw = model.artworkTextures?.inside ?? null;
  const showInside = model.printInside ?? !!insideMapRaw;
  const insideMap = showInside ? insideMapRaw : null;
  useEffect(() => {
    mats.setArtwork("outside", outsideMap);
    mats.setArtwork("inside", insideMap);
    invalidate();
  }, [mats, outsideMap, insideMap, invalidate]);

  // Finish masks per printed surface.
  const keyOut = finishMaskKey(finishes, "outside", artwork);
  const keyIn = finishMaskKey(finishes, "inside", artwork);
  const masks = useMemo(() => {
    const paint = (side: "outside" | "inside"): FinishMapTextures =>
      artwork ? finishTextures(paintFinishMaps(dieline, artwork, finishes, side, { images, resolveFont })) : { finish: null, foil: null, relief: null };
    return { outside: paint("outside"), inside: paint("inside") };
    // keys capture finishes + the referenced layers; version catches image loads
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dieline, keyOut, keyIn, version, images]);
  useEffect(
    () => () => {
      for (const side of [masks.outside, masks.inside]) for (const t of [side.finish, side.foil, side.relief]) t?.dispose();
    },
    [masks],
  );

  // Tween state (current → target).
  const anim = useRef<Record<"outside" | "inside", FinishedSurfaceState> | null>(null);
  const targets = useMemo(() => {
    const out: FinishedSurfaceState = {
      look: coatingLook(coating, appearance),
      color: new Color(outsideMap && !inkOnBoard.outside ? "#ffffff" : appearance.outside),
      maskFade: 1,
      bumpScale: masks.outside.relief ? 1 : 0,
    };
    const inLook: SurfaceLook = insideMap ? { ...coatingLook(null, appearance) } : { ...coatingLook(null, appearance), roughness: 0.95, envIntensity: 0.4 };
    const inn: FinishedSurfaceState = { look: inLook, color: new Color(insideMap && !inkOnBoard.inside ? "#ffffff" : appearance.inside), maskFade: 1, bumpScale: masks.inside.relief ? 1 : 0 };
    return { outside: out, inside: inn };
  }, [coating, appearance, outsideMap, insideMap, masks, inkOnBoard]);

  useEffect(() => {
    mats.setMasks("outside", masks.outside);
    mats.setMasks("inside", masks.inside);
    if (anim.current && !reduced) {
      // new masks fade in instead of popping
      anim.current.outside.maskFade = 0;
      anim.current.inside.maskFade = 0;
    }
    invalidate();
  }, [mats, masks, reduced, invalidate]);

  useEffect(() => {
    if (!anim.current || reduced) {
      anim.current = {
        outside: { ...targets.outside, look: { ...targets.outside.look }, color: targets.outside.color.clone() },
        inside: { ...targets.inside, look: { ...targets.inside.look }, color: targets.inside.color.clone() },
      };
      mats.apply("outside", anim.current.outside);
      mats.apply("inside", anim.current.inside);
    }
    invalidate();
  }, [targets, mats, reduced, invalidate]);

  useFrame((_, rawDelta) => {
    const a = anim.current;
    if (!a) return;
    const k = reduced ? 1 : 1 - Math.exp(-Math.min(rawDelta, 0.1) / TAU);
    let busy = false;
    for (const side of ["outside", "inside"] as const) {
      const cur = a[side];
      const tgt = targets[side];
      const d =
        Math.abs(cur.look.roughness - tgt.look.roughness) +
        Math.abs(cur.look.clearcoat - tgt.look.clearcoat) +
        Math.abs(cur.look.sheen - tgt.look.sheen) +
        Math.abs(cur.maskFade - tgt.maskFade) +
        Math.abs(cur.bumpScale - tgt.bumpScale) +
        Math.abs(cur.color.r - tgt.color.r) +
        Math.abs(cur.color.g - tgt.color.g) +
        Math.abs(cur.color.b - tgt.color.b);
      if (d < 1e-3) {
        if (d > 0) {
          cur.look = { ...tgt.look };
          cur.color.copy(tgt.color);
          cur.maskFade = tgt.maskFade;
          cur.bumpScale = tgt.bumpScale;
          mats.apply(side, cur);
        }
        continue;
      }
      cur.look = mixLook(cur.look, tgt.look, k);
      cur.color.lerp(tgt.color, k);
      cur.maskFade += (tgt.maskFade - cur.maskFade) * k;
      cur.bumpScale += (tgt.bumpScale - cur.bumpScale) * k;
      mats.apply(side, cur);
      busy = true;
    }
    if (busy) invalidate();
  });

  return <PackagingModel {...model} material={appearance} materialsOverride={mats} />;
}
