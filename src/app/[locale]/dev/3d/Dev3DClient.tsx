"use client";

import { Camera } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FINISH_CODES, STRUCTURE_CODES, type Dims, type FinishCode, type Locale, type MaterialCode, type StructureCode } from "@/types";
import type { DictKey } from "@/i18n/types";
import { useI18n } from "@/i18n/client";
import {
  BOARD_SPECS,
  DEFAULT_DIMS,
  STRUCTURE_LIMITS,
  boardAppearance,
  defaultMaterialFor,
  dielineToSvg,
  materialFitsStructure,
  paintArtworkSurface,
  surfaceCanvasSize,
  testPatternArtwork,
  validateDims,
  generateDieline,
  type DimsIssue,
} from "@/lib/dieline";
import { PackagingSceneLazy, ViewControls, type PackagingSceneHandle } from "@/components/three";
import { downloadBlob } from "@/components/three/screenshot";
import { useArtworkTexture } from "@/components/three/hooks";
import styles from "./dev3d.module.css";

const MATERIALS = Object.keys(BOARD_SPECS) as MaterialCode[];
const fmt = (n: number, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toString();

function resolveFont(family: "Inter" | "IBM Plex Sans Arabic") {
  if (typeof document === "undefined") return "sans-serif";
  const v = getComputedStyle(document.documentElement).getPropertyValue(family === "Inter" ? "--font-inter" : "--font-plex-arabic").trim();
  return v ? `${v}, system-ui, sans-serif` : `"${family}", system-ui, sans-serif`;
}

export function Dev3DClient({ locale }: { locale: Locale }) {
  const { t } = useI18n();
  const [code, setCode] = useState<StructureCode>("FEFCO_0427");
  const [dims, setDims] = useState<Dims>(DEFAULT_DIMS.FEFCO_0427);
  const [material, setMaterial] = useState<MaterialCode>("E_FLUTE_KRAFT");
  const [finish, setFinish] = useState<FinishCode>("NONE");
  const [fold, setFold] = useState(1);
  const [animate, setAnimate] = useState(true);
  const [pattern, setPattern] = useState(true);
  const [inside, setInside] = useState(false);
  const viewRef = useRef<PackagingSceneHandle>(null);

  const validation = validateDims(code, dims);
  const issues: DimsIssue[] = validation.ok ? [] : validation.issues;
  // Keep the last valid model on screen while the user types.
  const lastValid = useRef<ReturnType<typeof generateDieline> | null>(null);
  const dieline = useMemo(() => {
    if (!validation.ok) return lastValid.current;
    const m = generateDieline(code, validation.dims, { thicknessMm: BOARD_SPECS[material].thicknessMm });
    lastValid.current = m;
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, dims.L, dims.W, dims.H, material, validation.ok]);

  // Paint test-pattern textures (outside + inside) in sheet space.
  const [canvases, setCanvases] = useState<{ outside: HTMLCanvasElement; inside: HTMLCanvasElement } | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    setCanvases({ outside: document.createElement("canvas"), inside: document.createElement("canvas") });
  }, []);
  useEffect(() => {
    if (!canvases || !dieline) return;
    const size = surfaceCanvasSize(dieline, 2048);
    const look = boardAppearance(material);
    for (const surface of ["outside", "inside"] as const) {
      const c = canvases[surface];
      c.width = size.width;
      c.height = size.height;
      const ctx = c.getContext("2d");
      if (!ctx) continue;
      paintArtworkSurface(ctx, dieline, testPatternArtwork(dieline, surface), {
        surface,
        pxPerMm: size.pxPerMm,
        boardColor: surface === "outside" ? look.outside : look.inside,
        resolveFont,
      });
    }
    setVersion((v) => v + 1);
  }, [canvases, dieline, material]);
  const outsideTex = useArtworkTexture(pattern ? canvases?.outside : null, version);
  const insideTex = useArtworkTexture(pattern && inside ? canvases?.inside : null, version);

  const svgMarkup = useMemo(() => (dieline ? dielineToSvg(dieline, { title: t(`structures.${code}` as DictKey) }) : ""), [dieline, code, t]);

  const selectStructure = (c: StructureCode) => {
    setCode(c);
    setDims(DEFAULT_DIMS[c]);
    if (!materialFitsStructure(material, c)) setMaterial(defaultMaterialFor(c));
  };

  const screenshot = async () => {
    const blob = await viewRef.current?.screenshot({ width: 2048, height: 2048 });
    if (blob) downloadBlob(blob, `elba-${code.toLowerCase()}.png`);
  };

  const limits = STRUCTURE_LIMITS[code];
  return (
    <div className={styles.page} lang="en" dir="ltr">
      <header className={styles.header}>
        <h1 className={styles.title}>3D engine: dev view</h1>
        <p className={styles.sub}>
          Every catalog structure, folded from its parametric dieline. Locale {locale}; this tool is English-only and not linked from the site.
        </p>
      </header>

      <div className={styles.layout}>
        <section className={styles.viewer} aria-label={t("viewer.label")}>
          {dieline ? (
            <PackagingSceneLazy
              dieline={dieline}
              material={material}
              finish={finish}
              foldProgress={fold}
              animateFold={animate}
              artworkTextures={{ outside: outsideTex, inside: insideTex }}
              artworkVersion={version}
              printInside={inside}
              handleRef={viewRef}
              ariaLabel={t("viewer.label")}
              roleDescription={t("viewer.roleDescription")}
              keyboardHint={t("viewer.keyboardHint")}
              fallback={<p>{t("viewer.unsupported")}</p>}
            />
          ) : null}
          <div className={styles.overlay}>
            <ViewControls
              handle={viewRef}
              labels={{
                group: t("viewer.controls"),
                rotateLeft: t("viewer.rotateLeft"),
                rotateRight: t("viewer.rotateRight"),
                tiltUp: t("viewer.tiltUp"),
                tiltDown: t("viewer.tiltDown"),
                zoomIn: t("viewer.zoomIn"),
                zoomOut: t("viewer.zoomOut"),
                reset: t("viewer.reset"),
              }}
            />
          </div>
        </section>

        <form className={styles.panel} onSubmit={(e) => e.preventDefault()}>
          <label className={styles.field}>
            <span>Structure</span>
            <select value={code} onChange={(e) => selectStructure(e.target.value as StructureCode)}>
              {STRUCTURE_CODES.map((c) => (
                <option key={c} value={c}>
                  {t(`structures.${c}` as DictKey)} ({c})
                </option>
              ))}
            </select>
          </label>

          <fieldset className={styles.dims}>
            <legend>Inner size (mm)</legend>
            {(["L", "W", "H"] as const).map((k) => (
              <label key={k} className={styles.field}>
                <span>
                  {k} ({limits[k].min}–{limits[k].max})
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={limits[k].min}
                  max={limits[k].max}
                  value={Number.isFinite(dims[k]) ? dims[k] : ""}
                  aria-invalid={issues.some((i) => i.path === k)}
                  onChange={(e) => setDims({ ...dims, [k]: e.target.value === "" ? NaN : Number(e.target.value) })}
                />
              </label>
            ))}
          </fieldset>
          {issues.length ? (
            <p className={styles.error} role="alert">
              {issues.map((i) => `${i.path}: ${i.code}${i.limit !== undefined ? ` (${i.limit})` : ""}${i.rule ? ` (${i.rule})` : ""}`).join(" · ")}
            </p>
          ) : null}

          <label className={styles.field}>
            <span>Material</span>
            <select value={material} onChange={(e) => setMaterial(e.target.value as MaterialCode)}>
              {MATERIALS.filter((m) => materialFitsStructure(m, code)).map((m) => (
                <option key={m} value={m}>
                  {t(`materials.${m}` as DictKey)}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>Finish</span>
            <select value={finish} onChange={(e) => setFinish(e.target.value as FinishCode)}>
              {FINISH_CODES.map((f) => (
                <option key={f} value={f}>
                  {t(`finishes.${f}` as DictKey)}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>Fold: {Math.round(fold * 100)}%</span>
            <input type="range" min={0} max={100} step={1} value={Math.round(fold * 100)} onChange={(e) => setFold(Number(e.target.value) / 100)} />
          </label>
          <div className={styles.row}>
            <button type="button" className={styles.button} onClick={() => setFold(0)}>
              Flat
            </button>
            <button type="button" className={styles.button} onClick={() => setFold(0.5)}>
              Half
            </button>
            <button type="button" className={styles.button} onClick={() => setFold(1)}>
              Closed
            </button>
          </div>

          <label className={styles.check}>
            <input type="checkbox" checked={animate} onChange={(e) => setAnimate(e.target.checked)} /> Animate fold (off when reduced motion is set)
          </label>
          <label className={styles.check}>
            <input type="checkbox" checked={pattern} onChange={(e) => setPattern(e.target.checked)} /> Face test pattern
          </label>
          <label className={styles.check}>
            <input type="checkbox" checked={inside} onChange={(e) => setInside(e.target.checked)} /> Print inside too
          </label>

          <div className={styles.row}>
            {(["iso", "front", "back", "left", "right", "top"] as const).map((v) => (
              <button key={v} type="button" className={styles.button} onClick={() => viewRef.current?.setView(v)}>
                {v}
              </button>
            ))}
          </div>

          <button type="button" className={styles.primary} onClick={screenshot}>
            <Camera size={18} aria-hidden="true" /> PNG 2048 × 2048
          </button>

          {dieline ? (
            <dl className={styles.metrics}>
              <dt>Closed outer</dt>
              <dd>
                <bdi>
                  {fmt(dieline.closedOuter.L)} × {fmt(dieline.closedOuter.W)} × {fmt(dieline.closedOuter.H)} mm
                </bdi>
              </dd>
              <dt>Blank</dt>
              <dd>
                <bdi>
                  {fmt(dieline.metrics.blankWidthMm)} × {fmt(dieline.metrics.blankHeightMm)} mm · {fmt(dieline.metrics.blankAreaM2, 4)} m²
                </bdi>
              </dd>
              <dt>Net board</dt>
              <dd>{fmt(dieline.metrics.netAreaM2, 4)} m²</dd>
              <dt>Cut / crease</dt>
              <dd>
                {fmt(dieline.metrics.cutLengthMm / 1000, 2)} m / {fmt(dieline.metrics.creaseLengthMm / 1000, 2)} m
              </dd>
              <dt>Panels</dt>
              <dd>{dieline.panels.length}</dd>
              <dt>Faces</dt>
              <dd>{Object.keys(dieline.faces).join(", ")}</dd>
            </dl>
          ) : null}
        </form>
      </div>

      <section className={styles.dieline} aria-label="Dieline">
        <h2 className={styles.h2}>Dieline</h2>
        <p className={styles.sub}>Cut: solid · crease: dashed blue · bleed: pink · safe zone: dotted green.</p>
        <div className={styles.svg} dangerouslySetInnerHTML={{ __html: svgMarkup }} />
      </section>
    </div>
  );
}
