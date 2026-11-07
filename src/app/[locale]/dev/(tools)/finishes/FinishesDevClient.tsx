"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { STRUCTURE_CODES, type Artwork, type ArtworkLayer, type FaceId, type StructureCode } from "@/types";
import { DEFAULT_DIMS, STRUCTURES, generateDieline, paintArtworkSurface, surfaceCanvasSize } from "@/lib/dieline";
import {
  BOX_BOARDS,
  FINISHES,
  defaultBoxConfig,
  evaluateConfig,
  sanitizeConfig,
  toPricingRequest,
  toStructureFeatures,
  type BoxBoardCode,
  type BoxConfig,
  type ConfigFinishCode,
  type FinishChoice,
} from "@/lib/configurator";
import { PackagingSceneLazy, ViewControls, type PackagingSceneHandle } from "@/components/three";
import { useArtworkTexture } from "@/components/three/hooks";
import type { StageContext } from "@/components/three/finishes/StudioStage";
import { configBoardAppearance } from "@/components/three/finishes/looks";
import styles from "../3d/dev3d.module.css";

/** Which sample artwork each masked finish uses. */
const MASK_TARGET: Partial<Record<ConfigFinishCode, string[]>> = {
  SPOT_UV: ["stripe-front", "stripe-top", "stripe-back"],
  FOIL_GOLD: ["logo-front", "logo-top", "logo-back"],
  FOIL_SILVER: ["logo-front", "logo-top", "logo-back"],
  FOIL_ROSE_GOLD: ["logo-front", "logo-top", "logo-back"],
  EMBOSS: ["badge-front", "badge-top"],
  DEBOSS: ["badge-front", "badge-top"],
};

function sampleArtwork(faces: Partial<Record<FaceId, { width: number; height: number }>>, printed: boolean): Artwork {
  const layers: ArtworkLayer[] = [];
  for (const face of ["front", "top", "back"] as FaceId[]) {
    const f = faces[face];
    if (!f) continue;
    const { width: w, height: h } = f;
    const m = Math.min(w, h);
    layers.push({ id: `stripe-${face}`, kind: "shape", shape: "rect", face, surface: "outside", x: w / 2, y: h * 0.82, width: w, height: h * 0.1, rotation: 0, fill: printed ? "#1f3b4d" : "#5a3d22", stroke: null, strokeWidthMm: 0 });
    layers.push({ id: `badge-${face}`, kind: "shape", shape: "ellipse", face, surface: "outside", x: w * 0.82, y: h * 0.25, width: m * 0.26, height: m * 0.26, rotation: 0, fill: printed ? "#c75b39" : "#6b4a2b", stroke: null, strokeWidthMm: 0 });
    layers.push({ id: `logo-${face}`, kind: "text", face, surface: "outside", x: w / 2, y: h * 0.45, width: w * 0.8, height: h * 0.3, rotation: 0, text: "Elba علبة", fontFamily: "Inter", fontSizePt: Math.max(8, m * 0.16 * 2.83), fontWeight: 700, color: printed ? "#1f3b4d" : "#3b2a1a", align: "center", direction: "auto" });
  }
  return { outside: { background: printed ? "#f3efe6" : null, layers }, inside: { background: null, layers: [] } };
}

function fromUrl(): Partial<{ code: StructureCode; board: BoxBoardCode; finishes: ConfigFinishCode[]; context: StageContext; dims: boolean; fold: number; print: boolean }> {
  if (typeof window === "undefined") return {};
  const q = new URLSearchParams(window.location.search);
  const code = q.get("code") as StructureCode | null;
  return {
    ...(code && STRUCTURE_CODES.includes(code) ? { code } : {}),
    ...(q.get("board") ? { board: q.get("board") as BoxBoardCode } : {}),
    ...(q.get("finishes") ? { finishes: q.get("finishes")!.split(",").filter(Boolean) as ConfigFinishCode[] } : {}),
    ...(q.get("context") ? { context: q.get("context") as StageContext } : {}),
    ...(q.has("dims") ? { dims: q.get("dims") !== "0" } : {}),
    ...(q.has("fold") ? { fold: Number(q.get("fold")) } : {}),
    ...(q.has("print") ? { print: q.get("print") !== "0" } : {}),
  };
}

export function FinishesDevClient() {
  const [cfg, setCfg] = useState<BoxConfig>(() => defaultBoxConfig("FEFCO_0427"));
  const [context, setContext] = useState<StageContext>("none");
  const [dimsOn, setDimsOn] = useState(true);
  const [autoRotate, setAutoRotate] = useState(false);
  const [fold, setFold] = useState(1);
  const [printed, setPrinted] = useState(true);
  const [notes, setNotes] = useState<string[]>([]);
  const handle = useRef<PackagingSceneHandle>(null);

  useEffect(() => {
    const u = fromUrl();
    const code = u.code ?? "FEFCO_0427";
    const base = defaultBoxConfig(code);
    const finishes: FinishChoice[] = (u.finishes ?? []).map((c) => (FINISHES[c]?.masked ? { code: c, mask: { surface: "outside", layerIds: MASK_TARGET[c] ?? [] } } : { code: c }));
    setCfg({ ...base, material: u.board ?? base.material, finishes });
    if (u.context) setContext(u.context);
    if (u.dims !== undefined) setDimsOn(u.dims);
    if (u.fold !== undefined && Number.isFinite(u.fold)) setFold(u.fold);
    if (u.print !== undefined) setPrinted(u.print);
  }, []);

  const ev = useMemo(() => evaluateConfig(cfg), [cfg]);
  const dims = ev.size.box ?? DEFAULT_DIMS[cfg.model.code];
  const board = BOX_BOARDS[cfg.material];
  const features = useMemo(() => toStructureFeatures(cfg), [cfg]);
  const model = useMemo(() => generateDieline(cfg.model.code, dims, { thicknessMm: board.thicknessMm, features }), [cfg.model.code, dims, board.thicknessMm, features]);
  const artwork = useMemo(() => sampleArtwork(model.faces, printed), [model, printed]);

  // Paint the artwork canvas (sheet space).
  const canvas = useMemo(() => (typeof document === "undefined" ? null : document.createElement("canvas")), []);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!canvas) return;
    const s = surfaceCanvasSize(model);
    canvas.width = s.width;
    canvas.height = s.height;
    const ctx = canvas.getContext("2d")!;
    paintArtworkSurface(ctx, model, artwork.outside, { surface: "outside", pxPerMm: s.pxPerMm, boardColor: configBoardAppearance(cfg.material).outside });
    setVersion((v) => v + 1);
  }, [canvas, model, artwork, cfg.material]);
  const outside = useArtworkTexture(canvas, version);

  const update = (next: BoxConfig) => {
    const r = sanitizeConfig(next);
    setNotes(r.removed.map((x) => x.message.en));
    setCfg(r.config as BoxConfig);
  };
  const toggleFinish = (code: ConfigFinishCode) => {
    const has = cfg.finishes.some((f) => f.code === code);
    const finishes = has
      ? cfg.finishes.filter((f) => f.code !== code)
      : [...cfg.finishes, FINISHES[code].masked ? { code, mask: { surface: "outside" as const, layerIds: MASK_TARGET[code] ?? [] } } : { code }];
    update({ ...cfg, finishes });
  };
  const pricing = toPricingRequest(cfg);

  return (
    <div className={styles.page} lang="en" dir="ltr">
      <header className={styles.header}>
        <h1 className={styles.title}>Finishes and configurator</h1>
        <p className={styles.sub}>Rules engine, finish masks (foil, spot UV, emboss), studio stage and motion. Developer page.</p>
      </header>
      <div className={styles.layout}>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ blockSize: "min(70vh, 560px)", borderRadius: 12, background: "linear-gradient(180deg,#f7f7f7,#ececec)", overflow: "hidden" }} data-testid="finishes-viewer">
            <PackagingSceneLazy
              dieline={model}
              material={board.pricingMaterial ?? "E_FLUTE_KRAFT"}
              foldProgress={fold}
              artworkTextures={{ outside }}
              artworkVersion={version}
              handleRef={handle}
              surfaceFinish={{ board: cfg.material, finishes: cfg.finishes, artwork, version }}
              stage={{ context, dimensions: dimsOn }}
              autoRotate={autoRotate}
              ariaLabel="3D preview with finishes"
            />
          </div>
          <ViewControls handle={handle} />
        </div>
        <aside style={{ display: "grid", gap: 12, alignContent: "start" }}>
          <label>
            Structure{" "}
            <select value={cfg.model.code} onChange={(e) => update({ ...defaultBoxConfig(e.target.value as StructureCode), finishes: cfg.finishes, material: cfg.material })}>
              {STRUCTURE_CODES.map((c) => (
                <option key={c} value={c}>
                  {STRUCTURES[c].name.en}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>Board</legend>
            {ev.options.materials.map((m) => (
              <label key={m.value} style={{ display: "block" }} title={m.reason?.en ?? m.warning?.en}>
                <input type="radio" name="board" checked={cfg.material === m.value} disabled={!m.enabled} onChange={() => update({ ...cfg, material: m.value as BoxBoardCode })} /> {m.name.en}
                {m.reason ? <small style={{ display: "block", color: "#8e1f0b" }}>{m.reason.en}</small> : null}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Finishes</legend>
            {ev.options.finishes.map((f) => {
              const on = cfg.finishes.some((x) => x.code === f.value);
              return (
                <label key={f.value} style={{ display: "block" }}>
                  <input type="checkbox" checked={on} disabled={!f.enabled && !on} onChange={() => toggleFinish(f.value)} /> {f.name.en}
                  {!f.enabled && !on && f.reason ? <small style={{ display: "block", color: "#8e1f0b" }}>{f.reason.en}</small> : null}
                  {f.warning ? <small style={{ display: "block", color: "#5e4200" }}>{f.warning.en}</small> : null}
                </label>
              );
            })}
          </fieldset>
          <label>
            Context{" "}
            <select value={context} onChange={(e) => setContext(e.target.value as StageContext)}>
              <option value="none">Studio</option>
              <option value="table">Table</option>
              <option value="shelf">Shelf</option>
              <option value="reference">330 ml can for scale</option>
            </select>
          </label>
          <label>
            <input type="checkbox" checked={dimsOn} onChange={(e) => setDimsOn(e.target.checked)} /> Dimension lines
          </label>
          <label>
            <input type="checkbox" checked={autoRotate} onChange={(e) => setAutoRotate(e.target.checked)} /> Idle turntable
          </label>
          <label>
            <input type="checkbox" checked={printed} onChange={(e) => setPrinted(e.target.checked)} /> Printed background
          </label>
          <label>
            Fold <input type="range" min={0} max={1} step={0.01} value={fold} onChange={(e) => setFold(Number(e.target.value))} />
          </label>
          {notes.length ? (
            <ul role="status" style={{ color: "#5e4200" }}>
              {notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : null}
          <ul>
            {ev.issues.map((i) => (
              <li key={i.path + i.code} style={{ color: i.severity === "error" ? "#8e1f0b" : "#303030" }}>
                [{i.severity}] {i.message.en}
              </li>
            ))}
          </ul>
          <pre style={{ fontSize: 11, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify({ instant: pricing.instant, manual: pricing.manual.map((m) => m.code), input: pricing.kind === "box" ? pricing.input : null }, null, 2)}</pre>
        </aside>
      </div>
    </div>
  );
}
