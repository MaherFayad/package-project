import { CanvasTexture, Color, Mesh, MeshStandardMaterial, SRGBColorSpace, type Material, type Object3D, type Texture } from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import type { BoardAppearance } from "@/lib/dieline";

/**
 * The box as a binary glTF (.glb) for 3D viewers, AR, Blender or a website. The live scene uses
 * custom finish shaders a glTF reader cannot run, so the export swaps them for plain PBR
 * materials: the printed artwork sheet on the outside (and inside when it is printed), the board
 * colour elsewhere. Panel UVs are sheet coordinates, so one texture wraps the whole box as in
 * the designer. Metres, Y up, resting on the floor (glTF conventions).
 */
export async function exportGlb(
  root: Object3D,
  opts: { outside: HTMLCanvasElement | null; inside: HTMLCanvasElement | null; board: BoardAppearance; name?: string },
): Promise<Blob> {
  const owned: (Material | Texture)[] = [];
  const tex = (canvas: HTMLCanvasElement | null) => {
    if (!canvas) return null;
    // a copy: the live canvas is repainted and its texture belongs to the 3D view
    const c = document.createElement("canvas");
    c.width = canvas.width;
    c.height = canvas.height;
    c.getContext("2d")?.drawImage(canvas, 0, 0);
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    owned.push(t);
    return t;
  };
  const mat = (map: Texture | null, color: string, roughness: number) => {
    const m = new MeshStandardMaterial({ map, color: new Color(map ? "#ffffff" : color), roughness, metalness: 0 });
    owned.push(m);
    return m;
  };
  const outside = mat(tex(opts.outside), opts.board.outside, 0.7);
  const inside = mat(tex(opts.inside), opts.board.inside, 0.9);
  const edge = mat(null, opts.board.edge, 0.95);

  const copy = root.clone(true);
  copy.name = opts.name?.trim() || "Elba box";
  root.updateWorldMatrix(true, true);
  // keep the model where it sits in the scene (centred, on the floor), in metres
  copy.matrixAutoUpdate = false;
  copy.matrix.copy(root.matrixWorld);
  // drop the hover glow, if any
  const glow: Object3D[] = [];
  copy.traverse((o) => {
    if (o.userData?.elbaHighlight) glow.push(o);
  });
  for (const o of glow) o.removeFromParent();
  copy.traverse((o) => {
    if (o instanceof Mesh && o.userData?.panelId) {
      // slots match the panel geometry groups: outside, inside, cut edge (three/boardMaterials)
      o.material = [outside, inside, edge];
      o.castShadow = o.receiveShadow = false;
    } else if (o instanceof Mesh) {
      // perforation dashes, window film, ribbons: keep a plain copy of their colour
      const src = (Array.isArray(o.material) ? o.material[0] : o.material) as MeshStandardMaterial;
      const m = new MeshStandardMaterial({ color: src?.color?.clone() ?? new Color("#ffffff"), transparent: !!src?.transparent, opacity: src?.opacity ?? 1, roughness: 0.6 });
      owned.push(m);
      o.material = m;
    }
  });

  try {
    const exporter = new GLTFExporter();
    const result = await exporter.parseAsync(copy, { binary: true, onlyVisible: true, maxTextureSize: 4096 });
    return new Blob([result as ArrayBuffer], { type: "model/gltf-binary" });
  } finally {
    for (const o of owned) o.dispose();
  }
}
