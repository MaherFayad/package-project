"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Footprints, Pause, Pizza, Play, Shirt, SprayCan } from "lucide-react";
import type { Locale } from "@/types";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n/types";
import { Button, Icon } from "@/components/ui";
import { loadEngineStack } from "@/components/three";
import { PRODUCT_PRESETS, designerPathLite, type ProductPresetKey } from "./lib/paths";
import styles from "./designer.module.css";

// No loading poster here: DesignStart keeps one poster <img> until the first frame (R4-11).
// R6-R1: three.js, the React renderer and the viewer load in steps with yields between them
const StartViewer = dynamic(() => loadEngineStack().then(() => import("./StartViewer")), { ssr: false, loading: () => null });

const ICONS = { tshirt: Shirt, shoe: Footprints, perfume50: SprayCan, pizza30: Pizza } as const;
/** Poster (the model's thumbnail) shown until the 3D chunk is ready. */
const POSTER: Record<ProductPresetKey, string> = { tshirt: "mailer-box", shoe: "mailer-box", perfume50: "reverse-tuck-end", pizza30: "pizza-box" };

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
  const wrapRef = useRef<HTMLDivElement>(null);
  const preset = PRODUCT_PRESETS.find((p) => p.key === active)!;
  // The viewer remounts per product (key={active}); the poster covers it until its first frame.
  const [viewerReady, setViewerReady] = useState(false);
  const onViewerReady = useCallback(() => setViewerReady(true), []);
  useEffect(() => setViewerReady(false), [active]);

  // R4-24: the hero turns for one bounded turn (≤ 8 s), then rests. Hovering or focusing the stage
  // or a product shortcut starts another turn; Pause, a drag or focus inside the viewer stops it
  // until Play. Under prefers-reduced-motion it never starts by itself (WCAG 2.2.2, 2.3.3).
  const [turn, setTurn] = useState<number | null>(0);
  const quietRef = useRef(false);
  const mountedRef = useRef(false);
  mountedRef.current = mounted;
  const kick = useCallback(() => {
    // Phones before Play: nothing is loaded, so there is nothing to turn (R6-01).
    if (quietRef.current || !mountedRef.current) return;
    setTurn((n) => (n ?? 0) + 1);
    setPlaying(true);
  }, []);
  const stopForGood = useCallback(() => {
    quietRef.current = true;
    setPlaying(false);
  }, []);
  const onTurnDone = useCallback(() => setPlaying(false), []);

  // three.js loads once the browser is idle, so the page paints fast on mid-range phones.
  // R6-01: phones and touch screens keep the poster until the visitor presses Play. Mounting the
  // viewer was an ~800 ms main-thread task (4x CPU) that landed right when the visitor first
  // tapped, so that tap waited ~450 ms (INP 640 ms, budget 200 ms); it also saves battery.
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      quietRef.current = true;
      setPlaying(false);
    }
    if (window.matchMedia?.("(max-width: 767px), (pointer: coarse)").matches) {
      setPlaying(false);
      return;
    }
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



  const href = designerPathLite(locale, preset.structureCode, { preset: preset.presetId });
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
        <div className={styles.startStage} ref={wrapRef} onPointerDown={stopForGood} onPointerEnter={(e) => e.pointerType === "mouse" && kick()}>
          {mounted ? (
            <div className={styles.startViewer} onFocusCapture={stopForGood}>
              <StartViewer
                active={active}
                locale={locale}
                playing={playing}
                wrapRef={wrapRef}
                onReady={onViewerReady}
                turn={turn}
                onTurnDone={onTurnDone}
                labels={{
                  viewer: t("designer.start.viewerLabel", { product: productName }),
                  roleDescription: t("viewer.roleDescription"),
                  keyboardHint: t("viewer.keyboardHint"),
                  unsupported: t("viewer.unsupported"),
                }}
              />
            </div>
          ) : null}
          {/*
            R4-11: one poster element from the first paint until the 3D view has drawn a frame,
            then it fades out. The engine's own poster (passed before) was a second, larger
            element painted seconds later, so it became the page's LCP (about 6 s on a throttled
            phone instead of about 2 s).
          */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/models/${POSTER[active]}.svg`} alt="" className={styles.startPoster} data-hidden={mounted && viewerReady ? "true" : undefined} />
          <div className={styles.startToggle}>
            <Button
              size="slim"
              icon={playing ? Pause : Play}
              onClick={() => {
                if (playing) stopForGood();
                else {
                  // An explicit Play turns until Pause (and, on phones, loads the 3D view first).
                  setMounted(true);
                  quietRef.current = false;
                  setTurn(null);
                  setPlaying(true);
                }
              }}
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
                  href={designerPathLite(locale, p.structureCode, { preset: p.presetId })}
                  onPointerEnter={() => {
                    setActive(p.key);
                    kick();
                  }}
                  onFocus={() => {
                    setActive(p.key);
                    kick();
                  }}
                >
                  <span className={styles.productIcon} aria-hidden="true">
                    <IconC size={20} strokeWidth={1.75} />
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
