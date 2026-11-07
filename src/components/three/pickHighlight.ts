import { AdditiveBlending, Color,EdgesGeometry, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, type BufferGeometry, type Object3D } from "three";
import { MAT_INSIDE, MAT_OUTSIDE } from "./boardMaterials";

/**
 * Hover / drop-target glow for the 3D designer: a tinted copy of each picked panel's printed
 * surface plus an outline of its cut edges, so a side of the box reads as something you can
 * click. Overlays are children of the panel meshes (they fold with them) and never pickable.
 */
const TAG = "elbaHighlight";
const TINT = new Color("#1f6feb");

const hidden = new MeshBasicMaterial({ visible: false });
// additive: the side lights up (reads as "selected") instead of turning grey on brown board
const fill = new MeshBasicMaterial({
  color: new Color("#5b93ff"),
  transparent: true,
  opacity: 0.2,
  blending: AdditiveBlending,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -2,
  toneMapped: false,
});
const line = new LineBasicMaterial({ color: TINT, transparent: true, opacity: 0.95, toneMapped: false });
const edges = new WeakMap<BufferGeometry, EdgesGeometry>();
const noRaycast = () => {};

export function setHighlight(scene: Object3D, panelIds: readonly string[] | null, surface: "outside" | "inside") {
  const stale: Object3D[] = [];
  scene.traverse((o) => {
    if (o.userData?.[TAG]) stale.push(o);
  });
  for (const o of stale) o.removeFromParent();
  if (!panelIds?.length) return;

  const ids = new Set(panelIds);
  const slots = [hidden, hidden, hidden];
  slots[surface === "inside" ? MAT_INSIDE : MAT_OUTSIDE] = fill;
  const targets: Mesh[] = [];
  scene.traverse((o) => {
    if (o instanceof Mesh && ids.has(o.userData?.panelId)) targets.push(o);
  });
  for (const mesh of targets) {
    const geo = mesh.geometry as BufferGeometry;
    const overlay = new Mesh(geo, slots);
    overlay.userData[TAG] = true;
    overlay.raycast = noRaycast;
    overlay.renderOrder = 3;
    let outline = edges.get(geo);
    if (!outline) {
      outline = new EdgesGeometry(geo, 30);
      edges.set(geo, outline);
    }
    const lines = new LineSegments(outline, line);
    lines.userData[TAG] = true;
    lines.raycast = noRaycast;
    lines.renderOrder = 4;
    mesh.add(overlay, lines);
  }
}
