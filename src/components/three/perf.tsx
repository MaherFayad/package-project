"use client";

import { useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { Object3D, Texture, ToneMapping, WebGLRenderer } from "three";

/**
 * Rendering-cost helpers shared by the box and vessel viewers (owner: 3D engine).
 * Budget: 50+ fps on a mid phone while orbiting, 0 frames while idle (frameloop "demand").
 */

/** Keyboard alternative to dragging (WCAG 2.5.7 / 2.1.1), announced via aria-keyshortcuts. */
export const KEY_SHORTCUTS = "ArrowLeft ArrowRight ArrowUp ArrowDown Shift+ArrowLeft Shift+ArrowRight + - PageUp PageDown 0 Home";

/** Visible-in-viewport flag (IntersectionObserver) as a ref plus a change subscription. */
export function useOnScreen(el: Element | null) {
  const state = useMemo(() => {
    const listeners = new Set<() => void>();
    const ref = {
      current: true,
      subscribe(cb: () => void) {
        listeners.add(cb);
        return () => void listeners.delete(cb);
      },
      emit() {
        for (const l of listeners) l();
      },
    };
    return ref;
  }, []);
  useEffect(() => {
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      const v = entries.some((e) => e.isIntersecting);
      if (v !== state.current) {
        state.current = v;
        state.emit();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [el, state]);
  return state;
}

/**
 * Adaptive pixel ratio: while the user drags / zooms (OrbitControls `regress`, keyboard API
 * calls) the canvas renders at 2/3 of its pixel ratio (never below 1 CSS px per px), then snaps
 * back to full sharpness 300 ms after the last input. Fill rate is the bottleneck on phones.
 */
export function InteractionDpr() {
  const current = useThree((s) => s.performance.current);
  const initial = useThree((s) => s.viewport.initialDpr);
  const setDpr = useThree((s) => s.setDpr);
  useEffect(() => {
    const floor = Math.min(1, initial);
    setDpr(Math.max(floor, Math.round(initial * current * 100) / 100));
  }, [current, initial, setDpr]);
  return null;
}

/**
 * Give the main thread back (R6-R1): `scheduler.yield()` where the browser has it (continuation
 * keeps its priority), else a MessageChannel task (no 4 ms clamp like setTimeout).
 */
export function yieldToMain(): Promise<void> {
  const sched = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (sched?.yield) return sched.yield();
  return new Promise((resolve) => {
    if (typeof MessageChannel === "undefined") return void setTimeout(resolve, 0);
    const ch = new MessageChannel();
    ch.port1.onmessage = () => {
      ch.port1.close();
      resolve();
    };
    ch.port2.postMessage(null);
  });
}

/** Per-slice budget while warming shaders without KHR_parallel_shader_compile (ms). */
const WARMUP_SLICE_MS = 40;

/**
 * Compile every material in the scene before the viewer is revealed, so the first frame and the
 * first drag do not stall on shader compilation.
 *  - With KHR_parallel_shader_compile: `compileAsync` (the driver links off the main thread).
 *  - Without it (R6-R1): one object per distinct material, yielding to the browser about every
 *    40 ms, so a tap during the mount is handled within one slice instead of after one ~400 ms
 *    task. The canvas does not render until this is done (EngineCanvas `frameloop="never"`), so
 *    the first render cannot link every program in one go either.
 * `onCompiled` fires when the programs exist (the canvas may start rendering), `onDone` two frames
 * after the first compiled frame was presented (reveal).
 */
export function ShaderWarmup({ onDone, onCompiled }: { onDone?: () => void; onCompiled?: () => void }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const done = useRef(onDone);
  done.current = onDone;
  const compiled = useRef(onCompiled);
  compiled.current = onCompiled;
  useEffect(() => {
    let alive = true;
    const sliced = async () => {
      const seen = new Set<unknown>();
      const objects: Object3D[] = [];
      scene.traverseVisible((o) => {
        const m = (o as Object3D & { material?: unknown }).material;
        if (!m) return;
        const key = Array.isArray(m) ? m.map((x) => (x as { uuid: string }).uuid).join() : (m as { uuid: string }).uuid;
        if (seen.has(key)) return;
        seen.add(key);
        objects.push(o);
      });
      let t0 = performance.now();
      for (const o of objects) {
        if (!alive) return;
        try {
          gl.compile(o, camera, scene);
          // three links lazily: the blocking wait for the driver (LINK_STATUS, info logs, uniform
          // locations) happens on a program's first use, i.e. all of them inside the first render.
          // Touch each new program here so that wait lands in this slice instead.
          const mats = (o as Object3D & { material: unknown }).material;
          for (const m of Array.isArray(mats) ? mats : [mats]) {
            const programs = (gl.properties.get(m as object) as { programs?: Map<unknown, { getUniforms(): unknown }> }).programs;
            programs?.forEach((pr) => pr.getUniforms());
          }
        } catch {
          /* a failed program is reported by three at render time */
        }
        if (performance.now() - t0 > WARMUP_SLICE_MS) {
          await yieldToMain();
          t0 = performance.now();
        }
      }
    };
    // wait one frame so lazily created children (materials, environment) exist
    const raf = requestAnimationFrame(() => {
      // compileAsync only pays off with KHR_parallel_shader_compile; without it three warns and
      // polls programs on a timer (which can outlive an unmounted renderer), so compile in slices.
      const parallel = gl.extensions.has("KHR_parallel_shader_compile") && typeof gl.compileAsync === "function";
      let p: Promise<unknown>;
      try {
        p = parallel ? gl.compileAsync(scene, camera) : sliced();
      } catch {
        p = Promise.resolve();
      }
      p.catch(() => undefined).finally(() => {
        if (!alive) return;
        compiled.current?.();
        // the canvas starts rendering now: let React apply the frameloop change, then draw
        requestAnimationFrame(() => {
          if (!alive) return;
          invalidate();
          // reveal after the compiled frame has been presented
          requestAnimationFrame(() => requestAnimationFrame(() => alive && done.current?.()));
        });
      });
    });
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [gl, scene, camera, invalidate]);
  return null;
}

/** Keep renderer tone mapping / exposure in sync with props after mount. */
export function RendererSettings({ toneMapping, exposure }: { toneMapping: ToneMapping; exposure: number }) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (gl.toneMapping === toneMapping && gl.toneMappingExposure === exposure) return;
    gl.toneMapping = toneMapping;
    gl.toneMappingExposure = exposure;
    invalidate();
  }, [gl, toneMapping, exposure, invalidate]);
  return null;
}

/** Anisotropic filtering for artwork (sharp type on faces seen at an angle), capped at 8×. */
export function maxAnisotropy(gl: WebGLRenderer): number {
  return Math.max(1, Math.min(8, gl.capabilities.getMaxAnisotropy?.() ?? 1));
}

/** Raise a texture's anisotropy to the renderer's capped maximum (re-uploads at most once). */
export function useTextureQuality(...textures: (Texture | null | undefined)[]) {
  const gl = useThree((s) => s.gl);
  const target = maxAnisotropy(gl);
  for (const t of textures) {
    if (t && t.anisotropy < target) {
      t.anisotropy = target;
      t.needsUpdate = true;
    }
  }
}

type DebugWindow = Window & { __elba3d?: WebGLRenderer[] };

/**
 * `?debug3d` in the URL exposes every live renderer as `window.__elba3d` so a profiler can read
 * `renderer.info` (geometries, textures, programs, draw calls). No-op otherwise.
 */
export function registerDebugRenderer(gl: WebGLRenderer) {
  if (typeof window === "undefined") return;
  try {
    if (!new URLSearchParams(window.location.search).has("debug3d")) return;
  } catch {
    return;
  }
  const w = window as DebugWindow;
  (w.__elba3d ??= []).push(gl);
  gl.info.autoReset = true;
}
