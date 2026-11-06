"use client";

import { memo, useLayoutEffect, useRef, type ComponentProps } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Material, Object3D, Texture } from "three";
import { EngineCanvas } from "@/components/three/EngineCanvas";
import { BoxContent } from "./Scene3D";
import { VesselContent } from "./VesselView";
import styles from "./designer.module.css";

/**
 * The editor's 3D stage: ONE WebGL canvas for every model (PERF-09). Switching between a box and
 * a container (or between two containers) swaps the scene content inside the same
 * `<EngineCanvas>`, so the WebGL context, the environment map and the compiled shader programs
 * survive the switch instead of being rebuilt. Loaded lazily (next/dynamic, ssr: false).
 */
export default memo(function DesignStage({
  box,
  vessel,
  modelCode,
  poster,
  onReady,
  ariaLabel,
  roleDescription,
  keyboardHint,
  fallback,
}: {
  /** Exactly one of `box` / `vessel`. */
  box?: ComponentProps<typeof BoxContent> | null;
  vessel?: ComponentProps<typeof VesselContent> | null;
  /** Library model code: a change is a model switch (shaders are warmed before it shows). */
  modelCode?: string;
  /** Shown until the first compiled frame (the model's picker thumbnail). */
  poster?: string;
  /** The canvas exists (the stage fades its own poster out). */
  onReady?: () => void;
  ariaLabel: string;
  roleDescription: string;
  keyboardHint: string;
  fallback: string;
}) {
  return (
    <EngineCanvas
      ariaLabel={ariaLabel}
      roleDescription={roleDescription}
      keyboardHint={keyboardHint}
      fallback={<p className={styles.sceneFallback}>{fallback}</p>}
      poster={poster}
      onReady={onReady}
      wrapperProps={{ "data-scene": vessel ? "vessel" : "box" }}
    >
      {vessel ? <VesselContent {...vessel} /> : box ? <BoxContent {...box} /> : null}
      <SwitchWarmup swapKey={modelCode ?? ""} />
    </EngineCanvas>
  );
});

/**
 * Model switches inside the shared canvas: the new scene's shaders would otherwise compile
 * synchronously on its first frame (0.8 to 1.6 s of blocked main thread under software WebGL).
 * Pause the frame loop, compile with `compileAsync` (KHR_parallel_shader_compile, off the main
 * thread), then resume; the previous frame stays on screen meanwhile. The first mount is warmed
 * by EngineCanvas's own ShaderWarmup.
 */
function SwitchWarmup({ swapKey }: { swapKey: string }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const setFrameloop = useThree((s) => s.setFrameloop);
  const invalidate = useThree((s) => s.invalidate);
  const prev = useRef(swapKey);
  // GPU resources the last drawn frame used: material textures and the PMREM target three built
  // from the environment (see the note in the effect below).
  const lastEnv = useRef<Texture | null>(null);
  const lastPmrem = useRef<{ dispose(): void } | null>(null);
  const lastTextures = useRef<Set<Texture>>(new Set());
  useFrame(() => {
    const env = scene.environment;
    if (env !== lastEnv.current) {
      lastEnv.current = env;
      lastPmrem.current = null;
    }
    const used = sceneTextures(scene);
    lastTextures.current = used;
    if (!env || lastPmrem.current) return;
    // three keeps the PMREM of a render-target environment out of reach; materials that use it
    // carry its texture, and that texture points back at its target.
    for (const m of sceneMaterials(scene)) {
      const tex = (gl.properties.get(m) as { envMap?: Texture | null }).envMap;
      const rt = (tex as (Texture & { renderTarget?: { dispose(): void } | null }) | null | undefined)?.renderTarget;
      if (tex && tex !== env && rt) {
        lastPmrem.current = rt;
        break;
      }
    }
  });
  useLayoutEffect(() => {
    if (prev.current === swapKey) return;
    prev.current = swapKey;
    // One canvas for every model means nothing is freed by throwing the WebGL context away any
    // more, so free what the previous content left on the GPU once the new content is mounted:
    // - its PMREM: each content brings its own drei <Environment>; drei disposes the cube render
    //   target, but three frees the PMREM built from it (768x1024 half float, ~6 MB) only on the
    //   texture's "dispose" event, which RenderTarget.dispose() never fires (70 MB after 20 switches);
    // - textures its materials used that the new scene does not (label / panel clones that share a
    //   canvas source outlive the original's dispose()). three re-uploads a disposed texture if it
    //   is ever drawn again, so this cannot break a shared one.
    if (lastEnv.current && lastEnv.current !== scene.environment) lastPmrem.current?.dispose();
    lastEnv.current = scene.environment;
    lastPmrem.current = null;
    const keep = sceneTextures(scene);
    for (const t of lastTextures.current) if (!keep.has(t) && t !== scene.environment) t.dispose();
    lastTextures.current = keep;
    setFrameloop("never");
    let alive = true;
    const resume = () => {
      if (!alive) return;
      alive = false;
      setFrameloop("demand");
      invalidate();
    };
    // never hold the view for long (no parallel compile, lost context…)
    const cap = setTimeout(resume, 2500);
    // one frame so materials the new content creates in effects exist
    const raf = requestAnimationFrame(() => {
      let p: Promise<unknown>;
      try {
        p = gl.extensions.has("KHR_parallel_shader_compile") ? gl.compileAsync(scene, camera) : Promise.resolve();
      } catch {
        p = Promise.resolve();
      }
      void p.catch(() => undefined).finally(resume);
    });
    return () => {
      clearTimeout(cap);
      cancelAnimationFrame(raf);
      resume();
    };
  }, [swapKey, gl, scene, camera, setFrameloop, invalidate]);
  return null;
}

function sceneMaterials(scene: Object3D): Material[] {
  const out: Material[] = [];
  scene.traverse((o) => {
    const m = (o as Object3D & { material?: Material | Material[] }).material;
    if (Array.isArray(m)) out.push(...m);
    else if (m) out.push(m);
  });
  return out;
}

/** Every texture a material in the scene points at (map, normalMap, custom uniforms…). */
function sceneTextures(scene: Object3D): Set<Texture> {
  const out = new Set<Texture>();
  const add = (v: unknown) => {
    if (v && (v as Texture).isTexture) out.add(v as Texture);
  };
  for (const m of sceneMaterials(scene)) {
    for (const v of Object.values(m)) add(v);
    const uniforms = (m as Material & { uniforms?: Record<string, { value: unknown }> }).uniforms;
    if (uniforms) for (const u of Object.values(uniforms)) add(u?.value);
  }
  return out;
}
