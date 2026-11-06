/**
 * Bottles, jars, cans, tins, pouches and tubes in 3D (owner: vessels). Client-only.
 *
 *   const d = describeVessel({ kind: "WIDE_JAR", dims, surfaces: ["WRAP", "LID"] }); // @/lib/vessels
 *   <VesselSceneLazy kind="WIDE_JAR" dims={dims} profile={d.profile} envelope={d.envelope}
 *     material="GLASS_CLEAR" closure="LUG_LID" closureColor="GOLD" liquid="HONEY" fill={0.9}
 *     labels={[{ spec: d.labels[0], texture, stock: "PAPER_SEMIGLOSS", finish: "MATTE_VARNISH" }]}
 *     handleRef={viewRef} />
 *   <ViewControls handle={viewRef} />    // from "@/components/three"
 *
 * Paint label textures with `paintLabel` (flat print space; same UV contract as the meshes).
 */
export type { VesselSceneHandle, VesselSceneProps } from "./VesselScene";
export type { VesselLabel, VesselModelProps } from "./VesselModel";
export type { VesselQuality } from "./materials";
export type { ClosureStyle } from "./closures";
export { VesselSceneLazy } from "./LazyVesselScene";
export { paintLabel, labelCanvasSize, type LabelArtStyle, type PaintLabelOptions } from "./labelArt";
