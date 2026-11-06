"use client";

import type { ComponentProps } from "react";
import { EngineCanvas } from "@/components/three/engine";
import Scene3D from "./Scene3D";
import VesselView from "./VesselView";
import styles from "./designer.module.css";

type BoxProps = Omit<ComponentProps<typeof Scene3D>, "ariaLabel" | "roleDescription" | "keyboardHint" | "fallback" | "poster" | "onReady" | "embedded">;
type VesselProps = Omit<ComponentProps<typeof VesselView>, "ariaLabel" | "roleDescription" | "keyboardHint" | "fallback" | "onReady" | "embedded">;

/**
 * The editor's 3D stage: one persistent WebGL canvas (PERF-09). Switching models swaps only the
 * scene content, so the context, environment map and compiled shaders are kept. Lazy chunk
 * (three.js) loaded by DesignerApp.
 */
export default function Stage3D({
  box,
  vessel,
  ariaLabel,
  roleDescription,
  keyboardHint,
  fallback,
  poster,
  onReady,
}: {
  /** Exactly one of `box` / `vessel`. */
  box?: BoxProps;
  vessel?: VesselProps;
  ariaLabel: string;
  roleDescription: string;
  keyboardHint: string;
  fallback: string;
  poster?: string;
  onReady?: () => void;
}) {
  return (
    <EngineCanvas
      // Box ↔ box switches keep the canvas. A container visit on a shared canvas still leaves one
      // texture behind (1.6 MB bottle, 4 MB pouch per visit, measured after the engine's PMREM fix;
      // reported), so a box ↔ container switch remounts and frees it with the context. Remove
      // this key once the remaining vessel texture is disposed on unmount.
      key={vessel ? "vessel" : "box"}
      ariaLabel={ariaLabel}
      roleDescription={roleDescription}
      keyboardHint={keyboardHint}
      fallback={<p className={styles.sceneFallback}>{fallback}</p>}
      poster={poster}
      onContentReady={onReady}
    >
      {vessel ? (
        <VesselView {...vessel} embedded ariaLabel={ariaLabel} roleDescription={roleDescription} keyboardHint={keyboardHint} fallback={fallback} />
      ) : box ? (
        <Scene3D {...box} embedded ariaLabel={ariaLabel} roleDescription={roleDescription} keyboardHint={keyboardHint} fallback={fallback} />
      ) : null}
    </EngineCanvas>
  );
}
