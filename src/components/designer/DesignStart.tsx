"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Footprints, Pause, Pizza, Play, Shirt, SprayCan } from "lucide-react";
import type { ArtworkSurface, Locale, MaterialCode } from "@/types";
import { BOARD_SPECS, boardAppearance, generateDieline, paintArtworkSurface, surfaceCanvasSize, type DielineModel } from "@/lib/dieline";
import { PackagingSceneLazy, type PackagingSceneHandle } from "@/components/three";
import { useArtworkTexture } from "@/components/three/hooks";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n/types";
import { Button, Icon } from "@/components/ui";
import { PRODUCT_PRESETS, designerPath, presetDims, type ProductPresetKey } from "./lib/catalog";
import { resolveFont } from "./fonts";
import styles from "./designer.module.css";

const ICONS = { tshirt: Shirt, shoe: Footprints, perfume50: SprayCan, pizza30: Pizza } as const;

/** Look of each product preview: board + a sample brand (our own words, never a real brand). */
const LOOK: Record<ProductPresetKey, { material: MaterialCode; bg: string | null; ink: string; slug: string }> = {
  tshirt: { material: "E_FLUTE_WHITE", bg: "#1f3d2b", ink: "#ffffff", slug: "mailer-box" },
  shoe: { material: "E_FLUTE_KRAFT", bg: null, ink: "#1a1a1a", slug: "mailer-box" },
  perfume50: { material: "SBS_350", bg: "#e4deff", ink: "#303030", slug: "reverse-tuck-end" },
  pizza30: { material: "E_FLUTE_KRAFT", bg: null, ink: "#c70a24", slug: "pizza-box" },
};

/** Degrees per second of the slow turntable. */
const SPEED = 16;

function sampleArtwork(model: DielineModel, locale: Locale, look: (typeof LOOK)[ProductPresetKey]): ArtworkSurface {
  const ar = locale === "ar";
  const font = ar ? "IBM Plex Sans Arabic" : "Inter";
  const layers: ArtworkSurface["layers"] = [];
  const top = model.faces.top;
  const front = model.faces.front;
  const brand = ar ? "علامتك" : "Your brand";
  const fit = (w: number, h: number, chars: number) => Math.max(8, Math.min(72, Math.min((w * 0.7) / (chars * 0.19), h * 0.45 * 2.83)));
  if (top && top.height > 40) {
    layers.push({
      id: "s-top", kind: "text", face: "top", surface: "outside", x: top.width / 2, y: top.height / 2, width: top.width * 0.8, height: top.height * 0.4,
      rotation: 0, text: brand, fontFamily: font, fontSizePt: fit(top.width, top.height, brand.length), fontWeight: 700, color: look.ink, align: "center", direction: ar ? "rtl" : "ltr",
    });
  }
  if (front) {
    const text = top && top.height > 40 ? (ar ? "صنع في مصر" : "Made in Egypt") : brand;
    layers.push({
      id: "s-front", kind: "text", face: "front", surface: "outside", x: front.width / 2, y: front.height / 2, width: front.width * 0.9, height: front.height * 0.5,
      rotation: 0, text, fontFamily: font, fontSizePt: fit(front.width, front.height, text.length), fontWeight: 600, color: look.ink, align: "center", direction: ar ? "rtl" : "ltr",
    });
  }
  return { background: look.bg, layers };
}

/**
 * Start page hero: a live, slowly turning 3D box that switches with the product shortcuts, so a
 * first-time visitor sees what they are about to make before choosing. The turntable pauses on
 * any interaction, can be paused with a button (WCAG 2.2.2) and starts paused under
 * prefers-reduced-motion (2.3.3). Vertical swipes and the mouse wheel scroll the page; a
 * horizontal drag turns the box (the viewer is a preview, not the editor).
 */
export function DesignStart({ locale }: { locale: Locale }) {
  const { t } = useI18n();
  const [active, setActive] = useState<ProductPresetKey>("tshirt");
  const [mounted, setMounted] = useState(false);
  const [playing, setPlaying] = useState(true);
  const handle = useRef<PackagingSceneHandle>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const preset = PRODUCT_PRESETS.find((p) => p.key === active)!;
  const look = LOOK[active];

  const dieline = useMemo(
    () => generateDieline(preset.structureCode, presetDims(preset.structureCode, preset.presetId), { thicknessMm: BOARD_SPECS[look.material].thicknessMm }),
    [preset, look.material],
  );

  // three.js loads once the browser is idle, so the page paints fast on mid-range phones.
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) setPlaying(false);
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setMounted(true), { timeout: 1200 });
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(() => setMounted(true), 200);
    return () => window.clearTimeout(id);
  }, []);

  // The wheel scrolls the page instead of zooming the preview (stopped before the canvas sees it).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const stop = (e: WheelEvent) => e.stopPropagation();
    el.addEventListener("wheel", stop, { capture: true });
    return () => el.removeEventListener("wheel", stop, { capture: true });
  }, []);

  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    const c = document.createElement("canvas");
    const size = surfaceCanvasSize(dieline, 1024);
    c.width = size.width;
    c.height = size.height;
    const paint = () => {
      const ctx = c.getContext("2d");
      if (!ctx || cancelled) return;
      paintArtworkSurface(ctx, dieline, sampleArtwork(dieline, locale, look), {
        surface: "outside",
        pxPerMm: size.pxPerMm,
        boardColor: boardAppearance(look.material).outside,
        resolveFont,
      });
      setCanvas(c);
      setVersion((v) => v + 1);
    };
    paint();
    document.fonts?.ready.then(paint).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [mounted, dieline, locale, look]);
  const texture = useArtworkTexture(canvas, version);

  useEffect(() => {
    if (!playing || !mounted) return;
    let raf = 0;
    let last = performance.now();
    let visible = true;
    const io = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(([e]) => (visible = e.isIntersecting)) : null;
    if (wrapRef.current) io?.observe(wrapRef.current);
    const tick = (now: number) => {
      const dt = Math.min(now - last, 64);
      last = now;
      if (visible && document.visibilityState === "visible") handle.current?.rotate((SPEED * dt) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
    };
  }, [playing, mounted]);

  const href = designerPath(locale, preset.structureCode, { preset: preset.presetId });
  const productName = t(`designer.productPresets.${active}` as DictKey);

  return (
    <section className={styles.start} aria-labelledby="design-start-title">
      <div className={styles.startCopy}>
        <span className={styles.startEyebrow}>{t("designer.start.eyebrow")}</span>
        <h1 id="design-start-title" className={styles.startTitle}>
          {t("designer.start.title")}
        </h1>
        <p className={styles.startBody}>{t("designer.start.body")}</p>
        <ol className={styles.startSteps}>
          {(["step1", "step2", "step3"] as const).map((k, i) => (
            <li key={k}>
              <span className={styles.startStepNum} aria-hidden="true">
                {i + 1}
              </span>
              {t(`designer.start.${k}` as DictKey)}
            </li>
          ))}
        </ol>

      </div>

      <div className={styles.startStageCol}>
        <div className={styles.startStage} ref={wrapRef} onPointerDown={() => setPlaying(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {!mounted ? <img src={`/models/${look.slug}.svg`} alt="" className={styles.startPoster} /> : null}
          {mounted ? (
            <div className={styles.startViewer} onFocusCapture={() => setPlaying(false)}>
              <PackagingSceneLazy
                key={active}
                dieline={dieline}
                material={look.material}
                finish="MATTE_LAMINATION"
                foldProgress={1}
                animateFold={false}
                artworkTextures={{ outside: texture }}
                artworkVersion={version}
                handleRef={handle}
                ariaLabel={t("designer.start.viewerLabel", { product: productName })}
                roleDescription={t("viewer.roleDescription")}
                keyboardHint={t("viewer.keyboardHint")}
                fallback={<p className={styles.sceneFallback}>{t("viewer.unsupported")}</p>}
              />
            </div>
          ) : null}
          <div className={styles.startToggle}>
            <Button
              size="slim"
              icon={playing ? Pause : Play}
              onClick={() => setPlaying((v) => !v)}
              accessibilityLabel={playing ? t("designer.start.pause") : t("designer.start.play")}
            />
          </div>
        </div>
        <div className={styles.startCta}>
          <span className={styles.startCtaLabel} aria-live="polite">
            {productName}
          </span>
          <Link href={href} className={styles.startCtaLink}>
            {t("designer.start.cta")}
            <Icon source={ArrowRight} flipInRtl />
          </Link>
        </div>
      </div>
      <div className={styles.startPresets}>
        <h2 id="presets-heading" className={styles.startPresetsHeading}>
          {t("designer.picker.presetsHeading")}
        </h2>
        <p className={styles.startPresetsHint}>{t("designer.picker.presetsSubtitle")}</p>
        <ul className={styles.productGrid} aria-labelledby="presets-heading">
          {PRODUCT_PRESETS.map((p) => {
            const IconC = ICONS[p.key];
            return (
              <li key={p.key}>
                <Link
                  className={styles.productLink}
                  data-active={p.key === active ? "true" : undefined}
                  href={designerPath(locale, p.structureCode, { preset: p.presetId })}
                  onPointerEnter={() => setActive(p.key)}
                  onFocus={() => setActive(p.key)}
                >
                  <span className={styles.productIcon} aria-hidden="true">
                    <IconC size={20} />
                  </span>
                  <span className={styles.productText}>
                    <span className={styles.productName}>{t(`designer.productPresets.${p.key}` as DictKey)}</span>
                    <span className={styles.productMeta}>{t(`structures.${p.structureCode}` as DictKey)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
