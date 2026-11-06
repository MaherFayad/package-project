"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pause, Play, Rotate3d } from "lucide-react";
import type { HeroScene3DProps } from "../HeroScene3D";
import { IconPill } from "../kit/Pill";
import styles from "./designer-page.module.css";

const loadScene = () => import("../HeroScene3D");
const HeroScene3D = dynamic<HeroScene3DProps>(loadScene, { ssr: false });

/**
 * The hero stage: the poster render (server-rendered child, the LCP image) with our floating
 * editor pieces around it. three.js never loads on first paint: the kit's HeroScene3D (the same
 * mailer, artwork and angle as the poster) mounts only on intent, i.e. the pointer entering the
 * box on a hover device, a tap or press on it, or the "Turn in 3D" button (keyboard users).
 * Booting it on view or idle blocked first taps on phones (INP, see HeroVisual), so phones keep
 * the poster until they ask. One pause button stops the floating pieces and the turntable
 * (WCAG 2.2.2); both start paused under prefers-reduced-motion.
 */
export function LiveBox({
  poster,
  pieces,
  labels,
}: {
  poster: ReactNode;
  pieces: ReactNode;
  labels: { viewer: string; roleDescription: string; keyboardHint: string; unsupported: string; turn: string; turnHint: string; pause: string; play: string };
}) {
  const [mount, setMount] = useState(false);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(true);
  const asked = useRef(false);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) setPlaying(false);
  }, []);

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
    if (e.pointerType === "mouse") intent();
  };

  return (
    <div className={styles.stage} data-paused={playing ? "false" : "true"}>
      {pieces}
      <div className={styles.box} data-live={ready ? "true" : "false"} onPointerEnter={hover} onPointerDown={intent}>
        {poster}
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
