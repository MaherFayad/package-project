# Live 3D view realism (2026-11-08)

Status: done (first pass). Screenshots and timing scripts are in the agent scratchpad
`live-realism/` (`before/`, `after/`, `after-dpr2/`, `swiftshader/`, `ab-ship-cmp.png`).

## Changes (src/components/three only; no dieline change, geometry snapshot untouched)
1. **Ambient occlusion**: `LiveAO.tsx`. Uses three's built-in GTAOPass, so there is no new dependency (n8ao 2 needs `postprocessing`).
   The AO buffer runs at CSS-pixel resolution (half the buffer on 2x screens), is denoised, and is multiplied over the
   normal MSAA frame, so there is no float beauty target and no output pass. The shadow map is not redrawn for the normal pass.
   Off on coarse pointer, <=4 cores, deviceMemory <4, SwiftShader/llvmpipe, or `?noao`. Mounted in the
   PackagingScene Rig when `shadows` is on; radius = 20 % of the largest closed dimension (10-90 mm).
   Flat faces are unchanged (pixel-identical). Inside corners, flap gaps and wall/floor contact darken.
2. **Paper tooth**: `paperNormalTexture()` (textures.ts) builds a procedural 256 px tileable normal map. It goes on board
   outside/inside in both material paths. The finished path uses normalScale 0.1 + 0.75 x detail, so kraft gets more, white less and laminates least.
   The fibre/emboss bump now adds on top of the normal map: three normally picks one of the two, and the finish shader patch combines them.
   Printed pixels are 20 % less rough than bare board (ink film), via the `elbaInkGloss` uniform. Program cache key is now v5.
3. **Edge highlight**: panelGeometry vertex normals on cut and fold edge strips lean 40 deg toward the adjacent face
   (rounded rim). This is shading only; positions are unchanged.
4. **Environment**: the synthetic studio is kept (no HDR download for phones). Softboxes get a soft diffuser falloff map, intensities
   are raised to compensate, and the light set is rotated 18 deg.
5. **Hero view**: when part-folded (progress < 0.97), the camera looks down at phi 50 deg (was 62) so the inside shows.

## Measurements
rAF frame time while orbiting 3 s, headed Chrome, RTX 5060 Ti, 180 Hz display: before 5.6 ms avg / 5.7 p95; after 5.6 / 5.7
at DPR 1 and DPR 2. This is vsync-capped, so it shows no regression but does not stand in for a mid laptop.
SwiftShader: renders correctly with AO auto-off (about 6 fps orbit, as expected for software GL).

## Open
- Check on a real mid laptop and iGPU with a GPU timer query. If needed, drop AO samples (12 -> 8) or turn AO off while dragging.
- AO darkens the bottom few mm of panels that touch the floor shadow plane (realistic contact, a bit strong on hanging flaps).
- The pale edge highlight is subtle at 1x; a stronger screen-space rim was not attempted.
- Photo/PNG export (`screenshot.ts`) renders without AO (gl.render directly).
