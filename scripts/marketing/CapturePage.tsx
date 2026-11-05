"use client";

/**
 * Render capture page for marketing stills (NOT shipped: copy it to
 * src/app/[locale]/capture/page.tsx in a scratch copy of the app, then run
 * scripts/marketing/capture-renders.cjs). It renders every box structure and a few
 * bottles/jars with sample artwork through the real 3D engine, and exposes
 * window.__capture(id) -> PNG data URL with a transparent background.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { StructureCode } from "@/types";
import { STRUCTURE_THEME, sampleArtwork } from "@/components/marketing/sampleArtwork";
import { STRUCTURE_CODES } from "@/types";
import { DEFAULT_DIMS, boardAppearance, defaultMaterialFor, generateDielineForMaterial, paintArtworkSurface, surfaceCanvasSize } from "@/lib/dieline";
import { describeVessel, presetFor, VESSELS, type VesselKind } from "@/lib/vessels";
import { PackagingSceneLazy, VesselSceneLazy, paintLabel, type PackagingSceneHandle, type VesselLabel, type VesselSceneHandle } from "@/components/three";
import { useArtworkTexture } from "@/components/three/hooks";

const VESSEL_SHOTS: { id: string; kind: VesselKind; closureColor: "GOLD" | "WHITE" | "BLACK" | "BLUE" | "SILVER" }[] = [
  { id: "jar", kind: "WIDE_JAR", closureColor: "GOLD" },
  { id: "bottle", kind: "ROUND_BOTTLE", closureColor: "BLUE" },
  { id: "dropper", kind: "DROPPER_BOTTLE", closureColor: "BLACK" },
  { id: "pump", kind: "PUMP_BOTTLE", closureColor: "WHITE" },
  { id: "can", kind: "CAN", closureColor: "SILVER" },
];

function BoxShot({ code, onHandle }: { code: StructureCode; onHandle: (h: PackagingSceneHandle | null) => void }) {
  const material = defaultMaterialFor(code);
  const model = useMemo(() => generateDielineForMaterial(code, DEFAULT_DIMS[code], material), [code, material]);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [v, setV] = useState(0);
  useEffect(() => {
    const c = document.createElement("canvas");
    const s = surfaceCanvasSize(model, 1536);
    c.width = s.width;
    c.height = s.height;
    const paint = () => {
      paintArtworkSurface(c.getContext("2d")!, model, sampleArtwork(model, STRUCTURE_THEME[code]), {
        surface: "outside", pxPerMm: s.pxPerMm, boardColor: boardAppearance(material).outside,
        resolveFont: () => "Inter, system-ui, sans-serif",
      });
      setCanvas(c);
      setV((x) => x + 1);
    };
    document.fonts.ready.then(paint);
  }, [model, code, material]);
  const tex = useArtworkTexture(canvas, v);
  const ref = useRef<PackagingSceneHandle | null>(null);
  return (
    <div style={{ width: 800, height: 600 }}>
      <PackagingSceneLazy
        dieline={model} material={material} finish="MATTE_LAMINATION" foldProgress={1} animateFold={false}
        artworkTextures={{ outside: tex }} artworkVersion={v} maxDpr={1}
        handleRef={(h: PackagingSceneHandle | null) => { ref.current = h; onHandle(h); }}
      />
    </div>
  );
}

function VesselShot({ kind, closureColor, onHandle }: { kind: VesselKind; closureColor: (typeof VESSEL_SHOTS)[number]["closureColor"]; onHandle: (h: VesselSceneHandle | null) => void }) {
  const def = VESSELS[kind];
  const preset = presetFor(kind);
  const d = useMemo(() => describeVessel({ kind, dims: preset.dims, neck: preset.neck, surfaces: def.defaultSurfaces }), [kind, preset, def]);
  const [labels, setLabels] = useState<VesselLabel[]>([]);
  useEffect(() => {
    document.fonts.ready.then(() => {
      setLabels(d.labels.map((spec) => {
        const c = document.createElement("canvas");
        paintLabel(c, spec, { style: "sample", kind, preDistort: true, font: "Inter, system-ui, sans-serif", maxPx: 2048 });
        return { spec, canvas: c, stock: spec.defaultStock, finish: spec.kind === "SHRINK_SLEEVE" ? "NONE" : "GLOSS_VARNISH" } as VesselLabel;
      }));
    });
  }, [d, kind]);
  return (
    <div style={{ width: 600, height: 800 }}>
      <VesselSceneLazy
        kind={kind} dims={preset.dims} profile={d.profile} envelope={d.envelope} material={def.defaultMaterial}
        closure={def.defaultClosure} closureColor={closureColor} liquid={def.defaultLiquid} fill={def.defaultFill}
        labels={labels} artworkVersion={labels.length} quality="high" turntable={false} animate={false} maxDpr={1}
        handleRef={(h: VesselSceneHandle | null) => onHandle(h)}
      />
    </div>
  );
}

export default function CapturePage() {
  const handles = useRef(new Map<string, { screenshot: (o: object) => Promise<Blob> }>());
  useEffect(() => {
    (window as unknown as { __capture: (id: string, w: number, h: number) => Promise<string> }).__capture = async (id, w, h) => {
      const hd = handles.current.get(id);
      if (!hd) throw new Error(`no handle ${id}`);
      const blob = await hd.screenshot({ width: w, height: h, background: null });
      const buf = new Uint8Array(await blob.arrayBuffer());
      let s = "";
      for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
      return btoa(s);
    };
  }, []);
  const q = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("only") : null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, background: "transparent" }}>
      {STRUCTURE_CODES.filter((c) => !q || q === c).map((c) => (
        <BoxShot key={c} code={c} onHandle={(h) => (h ? handles.current.set(c, h) : handles.current.delete(c))} />
      ))}
      {VESSEL_SHOTS.filter((s) => !q || q === s.id).map((s) => (
        <VesselShot key={s.id} kind={s.kind} closureColor={s.closureColor} onHandle={(h) => (h ? handles.current.set(s.id, h) : handles.current.delete(s.id))} />
      ))}
    </div>
  );
}
