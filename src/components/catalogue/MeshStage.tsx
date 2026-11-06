"use client";

import { useEffect, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { Box3, Color, DoubleSide, MeshPhysicalMaterial, MeshStandardMaterial, Vector3, type Material, type PerspectiveCamera } from "three";
import type { MeshPart, PartLook } from "./meshes";

const MM = 0.001;

function lookMaterial(look: PartLook): Material {
  switch (look) {
    case "cupstock":
      return new MeshStandardMaterial({ color: new Color("#f7f5f0"), roughness: 0.55, side: DoubleSide });
    case "cupstockInner":
      return new MeshStandardMaterial({ color: new Color("#ece8df"), roughness: 0.6, side: DoubleSide });
    case "kraft":
      return new MeshStandardMaterial({ color: new Color("#b98a57"), roughness: 0.85, side: DoubleSide });
    case "plasticWhite":
      return new MeshPhysicalMaterial({ color: new Color("#f4f4f2"), roughness: 0.35, clearcoat: 0.4, side: DoubleSide });
    case "plasticClear":
    case "pvc":
      return new MeshPhysicalMaterial({ color: new Color("#e8f1f6"), roughness: 0.08, transparent: true, opacity: 0.38, clearcoat: 1, side: DoubleSide, depthWrite: false });
    case "pulp":
      return new MeshStandardMaterial({ color: new Color("#c9bba3"), roughness: 0.95, side: DoubleSide });
    case "foil":
      return new MeshStandardMaterial({ color: new Color("#d9dde2"), roughness: 0.28, metalness: 0.85 });
    case "pill":
      return new MeshStandardMaterial({ color: new Color("#fbfbfa"), roughness: 0.5 });
  }
}

function Fit({ size }: { size: Vector3 }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const controls = useThree((s) => s.controls) as unknown as { target: Vector3; update(): void } | null;
  useEffect(() => {
    const radius = Math.max(size.length() / 2, 0.01);
    const fov = (Math.min(camera.fov, 2 * Math.atan(Math.tan((camera.fov * Math.PI) / 360) * camera.aspect) * (180 / Math.PI)) * Math.PI) / 180;
    const d = (radius / Math.sin(fov / 2)) * 1.15;
    const theta = (32 * Math.PI) / 180;
    const phi = (58 * Math.PI) / 180;
    const target = new Vector3(0, size.y / 2, 0);
    camera.position.set(target.x + d * Math.sin(phi) * Math.sin(theta), target.y + d * Math.cos(phi), target.z + d * Math.sin(phi) * Math.cos(theta));
    camera.near = d / 100;
    camera.far = d * 20;
    camera.updateProjectionMatrix();
    camera.lookAt(target);
    if (controls) {
      controls.target.copy(target);
      controls.update();
    }
  }, [camera, controls, size]);
  return null;
}

/**
 * Small studio for mesh models (cups, lids, moulded pulp, blisters): same light rig as the box
 * viewer, transparent background, camera framed on the part's bounds, orbit on drag / keys.
 */
export default function MeshStage({ parts, ariaLabel, onReady }: { parts: MeshPart[]; ariaLabel: string; onReady?: () => void }) {
  const materials = useMemo(() => new Map<PartLook, Material>(), []);
  const mat = (l: PartLook) => {
    if (!materials.has(l)) materials.set(l, lookMaterial(l));
    return materials.get(l)!;
  };
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);
  useEffect(() => () => parts.forEach((p) => p.geometry.dispose()), [parts]);

  const { size, offset } = useMemo(() => {
    const box = new Box3();
    for (const p of parts) {
      p.geometry.computeBoundingBox();
      const b = p.geometry.boundingBox!.clone();
      if (p.matrix) b.applyMatrix4(p.matrix);
      box.union(b);
    }
    const c = box.getCenter(new Vector3());
    return { size: box.getSize(new Vector3()).multiplyScalar(MM), offset: new Vector3(-c.x, -box.min.y, -c.z) };
  }, [parts]);
  const extent = Math.max(size.x, size.z, 0.05);

  return (
    <Canvas
      role="img"
      aria-label={ariaLabel}
      dpr={[1, 2]}
      camera={{ fov: 32 }}
      gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
      onCreated={() => requestAnimationFrame(() => requestAnimationFrame(() => onReady?.()))}
      style={{ width: "100%", height: "100%" }}
    >
      <hemisphereLight args={["#ffffff", "#d9d4cc", 0.9]} />
      <directionalLight position={[2.5, 4, 3]} intensity={1.6} />
      <directionalLight position={[-3, 2, -2]} intensity={0.35} />
      <Environment resolution={64} frames={1} environmentIntensity={0.55}>
        <Lightformer form="rect" intensity={2} position={[0, 5, 2]} scale={[8, 4, 1]} />
        <Lightformer form="rect" intensity={1} position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[6, 2, 1]} />
        <Lightformer form="rect" intensity={1} position={[5, 1, 1]} rotation-y={-Math.PI / 2} scale={[6, 2, 1]} />
      </Environment>
      <group scale={MM}>
        <group position={offset}>
          {parts.map((p, i) => (
            <mesh key={i} geometry={p.geometry} material={mat(p.look)} matrixAutoUpdate={!p.matrix} matrix={p.matrix} castShadow receiveShadow />
          ))}
        </group>
      </group>
      <ContactShadows position={[0, -0.0005, 0]} scale={extent * 4} far={Math.max(size.y, extent) * 1.5} blur={2.2} opacity={0.45} resolution={512} color="#3a2e22" />
      <OrbitControls makeDefault enablePan={false} rotateSpeed={0.8} />
      <Fit size={size} />
    </Canvas>
  );
}
