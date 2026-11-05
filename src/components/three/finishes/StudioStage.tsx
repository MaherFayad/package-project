"use client";

import { useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, Html, Lightformer, Line } from "@react-three/drei";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { CanvasTexture, Color, DoubleSide, LatheGeometry, MeshPhysicalMaterial, MeshStandardMaterial, Vector2, type Texture } from "three";
import { woodTexture } from "./textures";

/**
 * Studio set for packaging shots: a softbox environment generated in the scene (no HDRI files,
 * no hotlinking), soft contact shadow, optional context (table, shelf, a hand-scale reference
 * can) and a size overlay with dimension lines in mm. All sizes are metres (1 mm = 0.001).
 */
export type StageContext = "none" | "table" | "shelf" | "reference";

export interface StageOptions {
  context?: StageContext;
  /** Show L / W / H dimension lines (outer mm) when the box is closed. */
  dimensions?: boolean;
  /** Format a length for the overlay (localise it; keep Western digits). Default "250 mm". */
  formatMm?: (mm: number) => string;
  /** Overall environment strength (default 1). */
  intensity?: number;
}

export interface StudioStageProps extends StageOptions {
  /** Closed box size in metres (x = L, y = H, z = W), model centred on x/z, resting on y = 0. */
  size: { x: number; y: number; z: number };
  /** Outer mm for the labels (defaults to size × 1000). */
  outerMm?: { L: number; W: number; H: number };
  shadows?: boolean;
  /** Fold progress (0 flat … 1 closed): the overlay shows only when closed. */
  progressRef?: { readonly current: number };
}

/* A 330 ml standard can, Ø66.2 × 115.2 mm (Crown / Ardagh standard can): everyone knows its size. */
const CAN_R = 0.0331;
const CAN_H = 0.1152;

function radialFade(): Texture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(128, 128, 30, 128, 128, 128);
  g.addColorStop(0, "#fff");
  g.addColorStop(0.6, "#fff");
  g.addColorStop(1, "#000");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new CanvasTexture(c);
}

function StudioLights({ intensity = 1 }: { intensity?: number }) {
  return (
    <>
      <hemisphereLight args={["#ffffff", "#e3ddd3", 0.55 * intensity]} />
      <directionalLight position={[2.2, 4, 3]} intensity={1.35 * intensity} />
      <directionalLight position={[-3, 1.8, -2.5]} intensity={0.35 * intensity} color="#dfe8ff" />
      <Environment resolution={256} frames={1} environmentIntensity={0.85 * intensity}>
        {/* overhead softbox */}
        <Lightformer form="rect" intensity={2.4} position={[0, 5, 0.5]} rotation-x={Math.PI / 2} scale={[7, 5, 1]} />
        {/* key strip front-left: the long highlight that sells foil and gloss */}
        <Lightformer form="rect" intensity={3.2} position={[-3.2, 1.6, 2.8]} rotation-y={Math.PI / 4} scale={[1.2, 5, 1]} />
        {/* rim strip back-right */}
        <Lightformer form="rect" intensity={1.8} position={[3.4, 1.4, -2.2]} rotation-y={(-3 * Math.PI) / 4} scale={[1, 4, 1]} />
        {/* broad front fill */}
        <Lightformer form="rect" intensity={0.8} position={[0, 1, 5]} scale={[10, 3, 1]} />
        {/* warm floor bounce */}
        <Lightformer form="rect" intensity={0.35} color="#f2e6d6" position={[0, -2, 0]} rotation-x={-Math.PI / 2} scale={[10, 10, 1]} />
        {/* soft cyclorama so reflections never go black */}
        <Lightformer form="ring" intensity={0.25} position={[0, 0, -6]} scale={[12, 12, 1]} />
      </Environment>
    </>
  );
}

function Table({ extent }: { extent: number }) {
  const wood = useMemo(() => woodTexture(), []);
  const fade = useMemo(() => radialFade(), []);
  useEffect(() => () => (wood?.dispose(), fade?.dispose()), [wood, fade]);
  const s = Math.max(0.6, extent * 5);
  if (wood) wood.repeat.set(s / 0.6, s / 0.6);
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.0012, 0]} receiveShadow>
      <planeGeometry args={[s, s]} />
      <meshStandardMaterial map={wood} alphaMap={fade} transparent roughness={0.55} metalness={0} depthWrite={false} />
    </mesh>
  );
}

function Shelf({ size }: { size: { x: number; y: number; z: number } }) {
  const t = 0.018;
  const depth = Math.max(size.z * 1.6, 0.18);
  const width = Math.max(size.x * 3.2, 0.5);
  const wallH = Math.max(size.y * 2.4, 0.3);
  const back = -(size.z / 2 + 0.03);
  return (
    <group>
      <mesh position={[0, -t / 2 - 0.0012, back + depth / 2]} receiveShadow>
        <boxGeometry args={[width, t, depth]} />
        <meshStandardMaterial color="#ebe7df" roughness={0.6} />
      </mesh>
      <mesh position={[0, wallH / 2 - t, back - 0.006]}>
        <boxGeometry args={[width, wallH, 0.012]} />
        <meshStandardMaterial color="#d9d4ca" roughness={0.85} />
      </mesh>
      {/* price-rail lip */}
      <mesh position={[0, -t / 2, back + depth + 0.004]}>
        <boxGeometry args={[width, t + 0.012, 0.008]} />
        <meshStandardMaterial color="#cfc9be" roughness={0.5} />
      </mesh>
    </group>
  );
}

/** Generic, unbranded 330 ml can: brushed aluminium with a plain colour band. */
function ReferenceCan({ x, z }: { x: number; z: number }) {
  const { geo, body, band } = useMemo(() => {
    const pts = [
      [0, 0],
      [0.025, 0],
      [0.0322, 0.004],
      [CAN_R, 0.009],
      [CAN_R, 0.103],
      [0.0296, 0.1115],
      [0.0272, 0.114],
      [0.0272, CAN_H],
      [0, CAN_H - 0.002],
    ].map(([r, y]) => new Vector2(r, y));
    const geo = new LatheGeometry(pts, 48);
    const body = new MeshPhysicalMaterial({ color: new Color("#cfd3d8"), metalness: 1, roughness: 0.28, clearcoat: 0.6, clearcoatRoughness: 0.15 });
    const band = new MeshStandardMaterial({ color: new Color("#2f6f73"), roughness: 0.35, metalness: 0.4, side: DoubleSide });
    return { geo, body, band };
  }, []);
  useEffect(() => () => (geo.dispose(), body.dispose(), band.dispose()), [geo, body, band]);
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={geo} material={body} castShadow />
      <mesh position={[0, 0.056, 0]} material={band}>
        <cylinderGeometry args={[CAN_R + 0.0002, CAN_R + 0.0002, 0.07, 48, 1, true]} />
      </mesh>
    </group>
  );
}

const LABEL_STYLE: CSSProperties = {
  padding: "2px 8px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.92)",
  color: "#303030",
  font: "600 12px/1.4 var(--font-inter, Inter), system-ui, sans-serif",
  boxShadow: "0 1px 2px rgba(0,0,0,0.18)",
  whiteSpace: "nowrap",
  pointerEvents: "none",
  direction: "ltr",
  unicodeBidi: "isolate",
};

function DimLine({ a, b, tick, label }: { a: [number, number, number]; b: [number, number, number]; tick: [number, number, number]; label: string }) {
  const mid: [number, number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  const t = (p: [number, number, number], s: number): [number, number, number] => [p[0] + tick[0] * s, p[1] + tick[1] * s, p[2] + tick[2] * s];
  return (
    <group>
      <Line points={[a, b]} color="#303030" lineWidth={1.25} transparent opacity={0.85} />
      <Line points={[t(a, -1), t(a, 1)]} color="#303030" lineWidth={1.25} />
      <Line points={[t(b, -1), t(b, 1)]} color="#303030" lineWidth={1.25} />
      <Html position={mid} center zIndexRange={[5, 0]} style={LABEL_STYLE}>
        {label}
      </Html>
    </group>
  );
}

function DimensionOverlay({ size, outerMm, formatMm }: { size: StudioStageProps["size"]; outerMm: { L: number; W: number; H: number }; formatMm: (mm: number) => string }) {
  const gap = 0.012 + Math.max(size.x, size.z) * 0.04;
  const tk = 0.004 + Math.max(size.x, size.y, size.z) * 0.012;
  const hx = size.x / 2;
  const hz = size.z / 2;
  const y = 0.0015;
  return (
    <group>
      <DimLine a={[-hx, y, hz + gap]} b={[hx, y, hz + gap]} tick={[0, 0, tk]} label={formatMm(outerMm.L)} />
      <DimLine a={[hx + gap, y, hz]} b={[hx + gap, y, -hz]} tick={[tk, 0, 0]} label={formatMm(outerMm.W)} />
      <DimLine a={[hx + gap, 0, hz + gap]} b={[hx + gap, size.y, hz + gap]} tick={[tk * 0.7, 0, tk * 0.7]} label={formatMm(outerMm.H)} />
    </group>
  );
}

const defaultFormat = (mm: number) => `${Math.round(mm)} mm`;

export function StudioStage({ size, outerMm, shadows = true, context = "none", dimensions = false, formatMm = defaultFormat, intensity, progressRef }: StudioStageProps) {
  const extent = Math.max(size.x, size.z, 0.05);
  const [closed, setClosed] = useState(() => (progressRef ? progressRef.current > 0.98 : true));
  useFrame(() => {
    if (!progressRef) return;
    const c = progressRef.current > 0.98;
    if (c !== closed) setClosed(c);
  });
  const mm = outerMm ?? { L: size.x * 1000, W: size.z * 1000, H: size.y * 1000 };
  const canX = size.x / 2 + CAN_R + Math.max(0.02, extent * 0.12);
  return (
    <>
      <StudioLights intensity={intensity} />
      {shadows ? (
        <ContactShadows
          position={[0, -0.0005, 0]}
          scale={extent * 4 + (context === "reference" ? 0.25 : 0)}
          far={Math.max(size.y, extent) * 1.5}
          blur={2.4}
          opacity={context === "none" ? 0.45 : 0.55}
          resolution={512}
          color="#2e241a"
        />
      ) : null}
      {context === "table" ? <Table extent={extent} /> : null}
      {context === "shelf" ? <Shelf size={size} /> : null}
      {context === "reference" ? <ReferenceCan x={canX} z={0} /> : null}
      {dimensions && closed ? <DimensionOverlay size={size} outerMm={mm} formatMm={formatMm} /> : null}
    </>
  );
}
