"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CatmullRomCurve3, Matrix4, MeshStandardMaterial, TubeGeometry, Vector3 } from "three";
import type { Dims, MaterialCode } from "@/types";
import { BOARD_SPECS, boundsAt, type BoardAppearance, type DielineModel } from "@/lib/dieline";
import { modelByCode } from "@/lib/library/registry";
import { useLibraryModel } from "@/lib/library/useLibraryModel";
import { docGeometry } from "@/lib/library/doc";
import * as F02 from "@/lib/dieline/families/fefco-02";
import * as F09 from "@/lib/dieline/families/fefco-09";
import * as FOOD from "@/lib/dieline/families/foodservice";
import * as RT from "@/lib/dieline/families/rigid-tubes";
import * as COS from "@/lib/vessels/families/cosmetic-cans";
import { PackagingModel, PackagingScene, MM, type PackagingSceneHandle } from "@/components/three/engine";
import { DesignScene } from "@/components/designer/DesignScene";
import { createModelDoc } from "@/components/designer/lib/doc";
import { useArtworkCanvases } from "@/components/designer/useArtworkCanvases";
import type { CatalogueRender } from "@/data/catalogue/types";
import { useI18n } from "@/i18n/client";
import MeshStage from "./MeshStage";
import { meshPartsFor, type MeshKind } from "./meshes";

/**
 * 3D view of ANY catalogue model (code-split; load with next/dynamic, ssr: false):
 *
 * - library boxes and containers: the designer's own scene (same fold engine, materials, lathe
 *   and film renderers), plain board / container, no artwork;
 * - FEFCO 09 fittings: the fitting folded and placed by its placement matrix inside an open
 *   FEFCO 0200 host box of the fitting's host size (`host` overrides it);
 * - family dielines outside the library (paper bags, flat stock, envelopes, bulk bins): the box
 *   fold engine with the family's paper look;
 * - cups, lids, moulded pulp and blisters: plain meshes from the family geometry.
 *
 * Calls `onReady` once the first frame with the model is drawn (thumbnail script, e2e).
 */
export interface CatalogueViewerProps {
  code: string;
  render: CatalogueRender;
  source: string;
  /** Host inner size for FEFCO 09 fittings (defaults to the fitting's default host). */
  host?: Dims;
  onReady?: () => void;
  onError?: (e: Error) => void;
}

const KRAFT_PAPER: BoardAppearance = { outside: "#b98a57", inside: "#a87c4c", edge: "#b0865a", fluteColor: null, flutePitchMm: null, roughness: 0.85 };
const WHITE_PAPER: BoardAppearance = { outside: "#f7f6f2", inside: "#efede6", edge: "#ebe9e2", fluteColor: null, flutePitchMm: null, roughness: 0.6 };

function useLabels() {
  const { t } = useI18n();
  return { ariaLabel: t("viewer.label"), roleDescription: t("viewer.roleDescription"), keyboardHint: t("viewer.keyboardHint"), fallback: <p>{t("viewer.unsupported")}</p> };
}

/** Fire onReady after the canvas exists and two frames have been drawn. */
function useCanvasReady(ref: React.RefObject<HTMLDivElement | null>, onReady?: () => void, delayMs = 400) {
  useEffect(() => {
    if (!onReady || !ref.current) return;
    let done = false;
    const el = ref.current;
    const check = () => {
      if (done) return;
      if (el.querySelector("canvas")) {
        done = true;
        setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => onReady())), delayMs);
      }
    };
    const obs = new MutationObserver(check);
    obs.observe(el, { childList: true, subtree: true });
    check();
    return () => {
      done = true;
      obs.disconnect();
    };
  }, [ref, onReady, delayMs]);
}

/* ───────────────────────────── library models ───────────────────────────── */

function LibraryView({ code, onReady }: { code: string; onReady?: () => void }) {
  // Only this model's family pack is fetched (PERF-04).
  const ready = useLibraryModel(code);
  if (!ready) return null;
  return <LibraryScene code={code} onReady={onReady} />;
}

function LibraryScene({ code, onReady }: { code: string; onReady?: () => void }) {
  const m = modelByCode(code)!;
  const doc = useMemo(() => createModelDoc(m, { name: m.name.en }), [m]);
  const geo = useMemo(() => docGeometry(doc), [doc]);
  const { canvases, version, images } = useArtworkCanvases(geo?.dieline ?? null, doc.artwork, doc.materialCode, false, 1024);
  const handle = useRef<PackagingSceneHandle | null>(null);
  const wrap = useRef<HTMLDivElement | null>(null);
  useCanvasReady(wrap, onReady, 900);
  if (!geo) throw new Error(`${code}: no geometry at the default size`);
  return (
    <div ref={wrap} style={{ position: "absolute", inset: 0 }}>
      <DesignScene doc={doc} geo={geo} canvases={canvases} version={version} images={images} fold={1} handleRef={handle} />
    </div>
  );
}

/* ───────────────────────────── FEFCO 09 inside a host ───────────────────────────── */

const HOST_DEF = F02.DEFINITION_BY_CODE.FEFCO_0200;

function FittingView({ code, host: hostDims, onReady }: { code: string; host?: Dims; onReady?: () => void }) {
  const labels = useLabels();
  const wrap = useRef<HTMLDivElement | null>(null);
  const handle = useRef<PackagingSceneHandle | null>(null);
  // Look further down into the open host so pads and liners on the floor read.
  const ready = useMemo(
    () => () => {
      handle.current?.rotate(0, 14);
      requestAnimationFrame(() => requestAnimationFrame(() => onReady?.()));
    },
    [onReady],
  );
  useCanvasReady(wrap, ready, 500);
  const built = useMemo(() => {
    const def = F09.FITTINGS[code as F09.FittingCode];
    const host = hostDims ?? def.defaultHost;
    const preset = def.presets.find((p) => p.dims.L === host.L && p.dims.W === host.W && p.dims.H === host.H);
    const material: MaterialCode = def.defaultMaterial;
    const t = BOARD_SPECS[material].thicknessMm;
    const fitting = F09.generateFitting(def.code, { host, ...(preset?.options ?? {}) }, { thicknessMm: t }) as unknown as DielineModel & { placement: { matrix: number[] } };
    const hostModel = F02.buildFefco02Dieline(HOST_DEF, host, { thicknessMm: t }) as unknown as DielineModel;
    // PackagingModel rests the fitting on y = 0, centred on x/z: undo that, apply the fitting's
    // placement (closed fitting -> host inner space), then move to the host's inner corner.
    const fb = boundsAt(fitting, 1);
    const fc = fb.getCenter(new Vector3());
    const innerMin = { x: -host.L / 2, y: t, z: -host.W / 2 };
    const mm = new Matrix4()
      .makeTranslation(innerMin.x, innerMin.y, innerMin.z)
      .multiply(new Matrix4().fromArray(fitting.placement.matrix))
      .multiply(new Matrix4().makeTranslation(fc.x, fb.min.y, fc.z));
    const world = new Matrix4().makeScale(MM, MM, MM).multiply(mm).multiply(new Matrix4().makeScale(1 / MM, 1 / MM, 1 / MM));
    return { fitting, hostModel, material, world };
  }, [code, hostDims]);
  return (
    <div ref={wrap} style={{ position: "absolute", inset: 0 }}>
      <PackagingScene dieline={built.hostModel} material="B_FLUTE_KRAFT" foldProgress={1} animateFold={false} handleRef={handle} {...labels}>
        <group matrixAutoUpdate={false} matrix={built.world}>
          <PackagingModel dieline={built.fitting} material={built.material === "B_FLUTE_KRAFT" ? WHITE_FITTING : built.material} foldProgress={1} />
        </group>
      </PackagingScene>
    </div>
  );
}

/** Fittings read against the kraft host in a lighter liner. */
const WHITE_FITTING: BoardAppearance = { outside: "#d9c3a0", inside: "#cfb690", edge: "#c9a476", fluteColor: "#8f6a42", flutePitchMm: 6.5, roughness: 0.9 };

/* ───────────────────────────── family dielines outside the library ───────────────────────────── */

function familyDieline(code: string, source: string): { model: DielineModel; look: BoardAppearance | MaterialCode } {
  if (source === "foodservice") {
    const def = FOOD.definitionByCode(code as FOOD.FoodserviceCode) as FOOD.FoodserviceDefinition & { defaultDims: Dims };
    const r = FOOD.buildFoodservice(def.code, def.defaultDims);
    if (r.kind !== "dieline") throw new Error(`${code} is not a dieline`);
    const mat = def.defaultMaterial;
    const look = mat.includes("KRAFT") && !mat.startsWith("WHITE") ? KRAFT_PAPER : WHITE_PAPER;
    return { model: r.model as unknown as DielineModel, look };
  }
  const def = RT.DEFINITIONS.find((d) => d.code === code)!;
  const model = def.generate(def.defaultDims) as unknown as DielineModel;
  const mat = def.defaultMaterial as string;
  const look: BoardAppearance | MaterialCode = mat.includes("FLUTE") || mat.includes("TRIPLE") ? "B_FLUTE_KRAFT" : mat.includes("KRAFT") ? KRAFT_PAPER : WHITE_PAPER;
  return { model, look };
}

/** Paper carrier-bag handles (HandleSpec): a loop glued inside the front and back panels. */
function bagHandles(model: DielineModel, look: BoardAppearance | MaterialCode) {
  const h = (model as DielineModel & { handle?: FOOD.HandleSpec }).handle;
  if (!h) return null;
  const { L, W, H } = model.closedOuter;
  const colour = typeof look === "string" ? "#b98a57" : look.outside;
  const material = new MeshStandardMaterial({ color: colour, roughness: 0.8 });
  const geos = [1, -1].map((side) => {
    const z = side * (W / 2 - 3);
    const s = h.spanMm / 2;
    const pts = [
      new Vector3(-s, H - h.anchorMm, z),
      new Vector3(-s, H, z),
      new Vector3(-s * 0.85, H + h.heightMm * 0.75, z),
      new Vector3(0, H + h.heightMm, z),
      new Vector3(s * 0.85, H + h.heightMm * 0.75, z),
      new Vector3(s, H, z),
      new Vector3(s, H - h.anchorMm, z),
    ].map((p) => p.multiplyScalar(MM));
    return new TubeGeometry(new CatmullRomCurve3(pts), 48, (h.widthMm / 2) * MM * (h.kind === "flat" ? 0.6 : 1), 8, false);
  });
  void L;
  return {
    meshes: geos.map((g, i) => <mesh key={i} geometry={g} material={material} castShadow />),
    dispose: () => {
      geos.forEach((g) => g.dispose());
      material.dispose();
    },
  };
}

function DielineView({ code, source, onReady }: { code: string; source: string; onReady?: () => void }) {
  const labels = useLabels();
  const wrap = useRef<HTMLDivElement | null>(null);
  useCanvasReady(wrap, onReady, 500);
  const { model, look } = useMemo(() => familyDieline(code, source), [code, source]);
  const handles = useMemo(() => bagHandles(model, look), [model, look]);
  useEffect(() => () => handles?.dispose(), [handles]);
  return (
    <div ref={wrap} style={{ position: "absolute", inset: 0 }}>
      <PackagingScene dieline={model} material={look} foldProgress={1} animateFold={false} {...labels}>
        {handles ? handles.meshes : null}
      </PackagingScene>
    </div>
  );
}

/* ───────────────────────────── meshes ───────────────────────────── */

function MeshView({ code, kind, onReady }: { code: string; kind: MeshKind; onReady?: () => void }) {
  const { t } = useI18n();
  const parts = useMemo(() => {
    if (kind === "blister") {
      const def = COS.DEFINITIONS_BY_CODE[code];
      const p = def.presets.find((x) => x.id === def.defaultPresetId) ?? def.presets[0];
      return meshPartsFor(kind, code, p.dims as unknown as Record<string, number>);
    }
    const def = FOOD.definitionByCode(code as FOOD.FoodserviceCode) as unknown as { defaultDims: Record<string, number> };
    return meshPartsFor(kind, code, def.defaultDims);
  }, [code, kind]);
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <MeshStage parts={parts} ariaLabel={t("viewer.label")} onReady={onReady} />
    </div>
  );
}

/* ───────────────────────────── entry ───────────────────────────── */

export default function CatalogueViewer({ code, render, source, host, onReady, onError }: CatalogueViewerProps) {
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    if (error) onError?.(error);
  }, [error, onError]);
  try {
    if (error) return null;
    if (source === "fefco-09") return <FittingView code={code} host={host} onReady={onReady} />;
    if (render === "box" || render === "vessel") return <LibraryView code={code} onReady={onReady} />;
    if (render === "dieline") return <DielineView code={code} source={source} onReady={onReady} />;
    if (render === "cup" || render === "lid" || render === "pulp" || render === "blister") return <MeshView code={code} kind={render} onReady={onReady} />;
    if (render === "fitting") return <FittingView code={code} host={host} onReady={onReady} />;
  } catch (e) {
    queueMicrotask(() => setError(e as Error));
  }
  return null;
}
