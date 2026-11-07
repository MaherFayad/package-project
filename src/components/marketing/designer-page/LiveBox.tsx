"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pause, Play, Rotate3d } from "lucide-react";
import type { HeroScene3DProps } from "../HeroScene3D";
import { IconPill } from "../kit/Pill";
import styles from "./designer-page.module.css";

const loadScene = () => import("../HeroScene3D");
const HeroScene3D = dynamic<HeroScene3DProps>(loadScene, { ssr: false });

export interface LoopSource {
  src: string;
  type: "video/webm" | "video/mp4";
  /** e.g. "(min-width: 900px)" for the 1080p files. */
  media?: string;
}

/**
 * The hero stage: the poster render (server-rendered child, the LCP image) with our floating
 * editor pieces around it.
 *
 * Motion, lightest first:
 * - With a turntable loop (ASSETS kit, muted 5 s video): it plays while the stage is in view,
 *   from `preload="none"`, so it never competes with the poster for first paint.
 * - three.js never loads on first paint. The kit's HeroScene3D (same mailer, artwork and angle as
 *   the poster) mounts only on intent: the "Turn in 3D" button (keyboard and touch), a press on
 *   the box, or, when there is no loop, the mouse entering the box. Booting it on view or idle
 *   blocked first taps on phones (INP, see HeroVisual).
 * One pause button stops the loop, the floating pieces and the turntable (WCAG 2.2.2); all start
 * paused under prefers-reduced-motion (WCAG 2.3.3).
 */
export function LiveBox({
  poster,
  pieces,
  loop,
  labels,
}: {
  poster: ReactNode;
  pieces: ReactNode;
  loop?: LoopSource[];
  labels: { viewer: string; roleDescription: string; keyboardHint: string; unsupported: string; turn: string; turnHint: string; pause: string; play: string };
}) {
  const [mount, setMount] = useState(false);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [inView, setInView] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const asked = useRef(false);
  const stage = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) setPlaying(false);
    const el = stage.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // The loop plays only while visible, wanted and not replaced by the live 3D box.
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (playing && inView && !ready) void v.play().catch(() => undefined);
    else v.pause();
  }, [playing, inView, ready]);

  const intent = () => {
    if (asked.current) return;
    asked.current = true;
    void loadScene()
      .catch(() => undefined)
      .then(() => {
        const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
        if (w.requestIdleCallback) w.requestIdleCallback(() => setMount(true), { timeout: 800 });
        else window.setTimeout(() => setMount(true), 50);
      });
  };
  const hover = (e: React.PointerEvent) => {
    if (!loop && e.pointerType === "mouse") intent();
  };

  return (
    <div ref={stage} className={styles.stage} data-paused={playing ? "false" : "true"}>
      {pieces}
      <div className={styles.box} data-live={ready ? "true" : "false"} data-video={videoReady && !ready ? "true" : "false"} onPointerEnter={hover} onPointerDown={intent}>
        {poster}
        {loop ? (
          <video
            ref={video}
            className={styles.boxVideo}
            muted
            loop
            playsInline
            preload="none"
            aria-hidden="true"
            tabIndex={-1}
            disablePictureInPicture
            onPlaying={() => setVideoReady(true)}
          >
            {loop.map((s) => (
              <source key={s.src} src={s.src} type={s.type} media={s.media} />
            ))}
          </video>
        ) : null}
        {mount ? (
          <div className={styles.boxCanvas} data-ready={ready ? "true" : "false"}>
            <HeroScene3D
              playing={playing}
              labels={{ viewer: labels.viewer, roleDescription: labels.roleDescription, keyboardHint: labels.keyboardHint, unsupported: labels.unsupported }}
              onReady={() => setReady(true)}
              onInteract={() => setPlaying(false)}
            />
          </div>
        ) : null}
        <div className={styles.boxControls}>
          {!mount ? (
            <button type="button" className={styles.turn} onClick={intent} title={labels.turnHint}>
              <Rotate3d size={18} aria-hidden />
              {labels.turn}
            </button>
          ) : null}
          <IconPill className={styles.iconBtn} onClick={() => setPlaying((p) => !p)} aria-label={playing ? labels.pause : labels.play}>
            {playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
          </IconPill>
        </div>
      </div>
    </div>
  );
}
