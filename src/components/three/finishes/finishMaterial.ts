import { CanvasTexture, Color, MeshPhysicalMaterial, MeshStandardMaterial, NoColorSpace, SRGBColorSpace, Vector2, type Material, type Texture, type WebGLProgramParametersWithUniforms } from "three";
import type { BoardAppearance } from "@/lib/dieline";
import { MAT_EDGE, MAT_INSIDE, MAT_OUTSIDE, type BoardMaterialSet } from "../boardMaterials";
import { FOIL_LOOKS, RELIEF_BUMP_SCALE, SPOT_UV_LOOK, type SurfaceLook } from "./looks";
import type { FinishMapCanvases } from "./masks";
import { boardTileTexture, fluteEdgeTexture, grainTexture, solidDataTexture, solidEdgeTexture } from "./textures";

/**
 * Board materials with real finishes:
 *  - foil: metalness 1 + foil colour inside its mask (metallic PBR),
 *  - spot UV: clear coat 1 with near-mirror clear coat roughness inside its mask,
 *  - emboss / deboss: bump map from the relief mask,
 *  - soft-touch: high roughness + velvet sheen; lamination / varnish: clear coat,
 *  - kraft / paper fibre that shows through print (detail map),
 *  - corrugated flute edge (single or double wall) and solid board edge.
 *
 * Every scalar is a uniform or material field, so a finish or board change can tween (crossfade)
 * without recompiling. Masks fade in through `elbaMaskFade`. Textures are <= 2048 px.
 */

export interface FinishUniforms {
  elbaFinishMap: { value: Texture };
  elbaFoilMap: { value: Texture };
  elbaDetailMap: { value: Texture };
  elbaDetailRepeat: { value: Vector2 };
  elbaDetail: { value: number };
  elbaMaskFade: { value: number };
  elbaFoilRough: { value: number };
  elbaUvRough: { value: number };
  elbaInkTone: { value: number };
  /** 1 = transparent process ink printed straight on a coloured liner (kraft, no white underprint). */
  elbaInkOnBoard: { value: number };
  /** Liner colour (linear): what the artwork canvas uses for unprinted areas, and what the ink multiplies with. */
  elbaBoardColor: { value: Color };
  /** Reflection strength inside foil, independent of the coating's envIntensity (soft-touch dims the print, not the foil). */
  elbaFoilEnv: { value: number };
}

const DECL = /* glsl */ `
uniform sampler2D elbaFinishMap;
uniform sampler2D elbaFoilMap;
uniform sampler2D elbaDetailMap;
uniform vec2 elbaDetailRepeat;
uniform float elbaDetail;
uniform float elbaMaskFade;
uniform float elbaFoilRough;
uniform float elbaUvRough;
uniform float elbaInkTone;
uniform float elbaInkOnBoard;
uniform vec3 elbaBoardColor;
uniform float elbaFoilEnv;
`;

/**
 * Patch a MeshPhysicalMaterial with the finish layers. Needs `metalnessMap` set (any texture
 * with identity transform: it provides the sheet UV varying) and metalness 0.
 */
export function patchFinishShader(mat: MeshPhysicalMaterial, uniforms: FinishUniforms) {
  mat.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${DECL}`)
      .replace(
        "#include <roughnessmap_fragment>",
        /* glsl */ `#include <roughnessmap_fragment>
  vec2 elbaUv = vMetalnessMapUv;
  vec4 elbaFoil = texture2D( elbaFoilMap, elbaUv );
  float elbaFoilA = elbaFoil.a * elbaMaskFade;
  float elbaUvA = texture2D( elbaFinishMap, elbaUv ).r * elbaMaskFade;
  roughnessFactor = mix( roughnessFactor, elbaFoilRough, elbaFoilA );`,
      )
      .replace(
        "#include <metalnessmap_fragment>",
        /* glsl */ `#include <metalnessmap_fragment>
  float elbaGrain = texture2D( elbaDetailMap, elbaUv * elbaDetailRepeat ).r;
  // ink on kraft: only printed pixels multiply with the liner (unprinted pixels already ARE the
  // liner colour in the artwork canvas, so multiplying everything would darken the board twice)
  float elbaInk = elbaInkOnBoard * smoothstep( 0.02, 0.1, distance( diffuseColor.rgb, elbaBoardColor ) );
  diffuseColor.rgb *= mix( vec3( 1.0 ), mix( vec3( 1.0 ), elbaBoardColor / max( max( elbaBoardColor.r, elbaBoardColor.g ), max( elbaBoardColor.b, 0.001 ) ), 0.85 ), elbaInk );
  diffuseColor.rgb *= elbaInkTone * mix( 1.0, 0.78 + 0.44 * elbaGrain, elbaDetail );
  diffuseColor.rgb = mix( diffuseColor.rgb, elbaFoil.rgb, elbaFoilA );
  metalnessFactor = mix( metalnessFactor, 1.0, elbaFoilA );`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        /* glsl */ `#include <normal_fragment_maps>
  // hot-foil is never optically flat: a faint crinkle (from the grain tile) breaks the reflection
  // into the glints that make foil read as metal instead of flat ochre ink
  vec2 elbaCrinkle = vec2( texture2D( elbaDetailMap, elbaUv * elbaDetailRepeat * 2.3 ).r, texture2D( elbaDetailMap, elbaUv * elbaDetailRepeat * 2.3 + 0.37 ).r ) - 0.5;
  normal = normalize( normal + elbaFoilA * 0.22 * vec3( elbaCrinkle, 0.0 ) );`,
      )
      .replace(
        "#include <lights_fragment_maps>",
        /* glsl */ `#include <lights_fragment_maps>
  #if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
    radiance *= mix( 1.0, elbaFoilEnv / max( envMapIntensity, 0.001 ), elbaFoilA );
  #endif`,
      )
      .replace(
        "#include <lights_physical_fragment>",
        /* glsl */ `#include <lights_physical_fragment>
  #ifdef USE_CLEARCOAT
    material.clearcoat = mix( material.clearcoat, 1.0, elbaUvA ) * ( 1.0 - 0.85 * elbaFoilA );
    material.clearcoatRoughness = max( mix( material.clearcoatRoughness, elbaUvRough, elbaUvA ), 0.0525 );
  #endif`,
      );
  };
  mat.customProgramCacheKey = () => "elba-finish-v4";
}

export interface FinishMapTextures {
  finish: Texture | null;
  foil: Texture | null;
  relief: Texture | null;
}

/** Upload mask canvases as textures (caller disposes). */
export function finishTextures(maps: FinishMapCanvases | null): FinishMapTextures {
  const make = (c: HTMLCanvasElement | null, srgb: boolean) => {
    if (!c) return null;
    const t = new CanvasTexture(c);
    t.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
    t.anisotropy = 4;
    return t;
  };
  return { finish: make(maps?.finish ?? null, false), foil: make(maps?.foil ?? null, true), relief: make(maps?.relief ?? null, false) };
}

export interface FinishedSurfaceState {
  look: SurfaceLook;
  /** Board colour multiplied over the tile when unprinted; white when artwork is mapped. */
  color: Color;
  maskFade: number;
  bumpScale: number;
}

export interface FinishedBoardMaterials extends BoardMaterialSet {
  outside: MeshPhysicalMaterial;
  inside: MeshPhysicalMaterial;
  edge: MeshStandardMaterial;
  uniforms: { outside: FinishUniforms; inside: FinishUniforms };
  /** Set the artwork map (null = bare board tile) for a side. */
  setArtwork(side: "outside" | "inside", map: Texture | null): void;
  /** Set finish masks for a side (null textures = none). Does not dispose the old ones. */
  setMasks(side: "outside" | "inside", maps: FinishMapTextures): void;
  /** Apply a (possibly mid-tween) look state to a side. */
  apply(side: "outside" | "inside", s: FinishedSurfaceState): void;
  /** Artwork printed straight on a coloured liner: tint printed pixels by the liner (boardHex = canvas background). */
  setInkOnBoard(side: "outside" | "inside", on: boolean, boardHex: string): void;
  /** Re-skin for another board without recreating materials (colours, tile, edge). */
  setBoard(app: BoardAppearance, fluteLayers: 0 | 1 | 2, detail: number): void;
}

/**
 * Create the [outside, inside, edge] materials (matches panel geometry groups). Call
 * `dispose()` when done; textures passed in via setArtwork/setMasks are NOT owned.
 */
export function createFinishedBoardMaterials(sheet: { width: number; height: number }, app: BoardAppearance, fluteLayers: 0 | 1 | 2, detail: number): FinishedBoardMaterials {
  const owned = new Set<Texture | Material>();
  const own = <T extends Texture | Material | null>(x: T): T => {
    if (x) owned.add(x);
    return x;
  };
  const black = own(solidDataTexture(0, 0, 0, 255));
  const clear = own(solidDataTexture(0, 0, 0, 0, true));
  const grain = own(grainTexture()) ?? own(solidDataTexture(128, 128, 128, 255));
  let tile = own(boardTileTexture(app.fluteColor ? 12 : 4, sheet));
  let insideTile = own(boardTileTexture(app.fluteColor ? 12 : 4, sheet, 7654321));
  const detailRepeat = new Vector2(sheet.width / 60, sheet.height / 60);
  // Fibre relief: the same grain tile as a low-strength bump map, so light rakes across the paper
  // (strongest on kraft, almost nothing under film laminates). Replaced by an emboss mask if any.
  const fibre = grain ? own(grain.clone()) : null;
  if (fibre) {
    fibre.repeat.copy(detailRepeat);
    fibre.needsUpdate = true;
  }
  const fibreScale = { outside: detail * 1.8, inside: detail * 2.2 };
  const relief: Record<"outside" | "inside", Texture | null> = { outside: null, inside: null };

  const makeUniforms = (): FinishUniforms => ({
    elbaFinishMap: { value: black },
    elbaFoilMap: { value: clear },
    elbaDetailMap: { value: grain },
    elbaDetailRepeat: { value: detailRepeat },
    elbaDetail: { value: detail },
    elbaMaskFade: { value: 1 },
    elbaFoilRough: { value: FOIL_LOOKS.FOIL_GOLD.roughness },
    elbaUvRough: { value: SPOT_UV_LOOK.clearcoatRoughness },
    elbaInkTone: { value: 1 },
    elbaInkOnBoard: { value: 0 },
    elbaBoardColor: { value: new Color("#ffffff") },
    // the studio sweep is mid-grey (~0.25 linear); a light tent around real foil is near white, so foil
    // reflections get ~2.6× to read as polished metal next to diffuse paper
    elbaFoilEnv: { value: 2.6 },
  });

  // clearcoat / sheen stay > 0 so their shader paths compile once and tweens never recompile
  const makeSide = (map: Texture | null, color: string, u: FinishUniforms) => {
    const m = new MeshPhysicalMaterial({
      color: new Color(color),
      map,
      roughness: app.roughness,
      metalness: 0,
      metalnessMap: black,
      clearcoat: 0.001,
      clearcoatRoughness: 0.3,
      sheen: 0.001,
      sheenRoughness: 0.8,
      sheenColor: new Color("#ffffff"),
      envMapIntensity: 0.7,
    });
    patchFinishShader(m, u);
    return m;
  };
  const uOut = makeUniforms();
  const uIn = makeUniforms();
  const outside = own(makeSide(tile, app.outside, uOut));
  const inside = own(makeSide(insideTile, app.inside, uIn));
  inside.roughness = 0.95;

  const edge = own(new MeshStandardMaterial({ color: new Color("#ffffff"), roughness: 0.95, metalness: 0 }));
  let edgeTex: Texture | null = null;
  const setEdge = (a: BoardAppearance, layers: 0 | 1 | 2) => {
    if (edgeTex) {
      edgeTex.dispose();
      owned.delete(edgeTex);
    }
    edgeTex = own(
      layers && a.fluteColor
        ? fluteEdgeTexture({ liner: a.outside, flute: a.fluteColor, edge: a.edge, inner: a.inside }, layers as 1 | 2)
        : solidEdgeTexture({ top: a.outside, core: a.edge, bottom: a.inside }),
    );
    edge.map = edgeTex;
    edge.color.set(edgeTex ? "#ffffff" : a.edge);
    edge.needsUpdate = true;
  };
  setEdge(app, fluteLayers);

  const artwork: Record<"outside" | "inside", Texture | null> = { outside: null, inside: null };

  return {
    list: [outside, inside, edge] as [Material, Material, Material],
    outside,
    inside,
    edge,
    uniforms: { outside: uOut, inside: uIn },
    setArtwork(side, map) {
      const m = side === "outside" ? outside : inside;
      artwork[side] = map;
      const next = map ?? (side === "outside" ? tile : insideTile);
      if (m.map !== next) {
        m.map = next;
        m.needsUpdate = true;
      }
    },
    setInkOnBoard(side, on, boardHex) {
      const u = side === "outside" ? uOut : uIn;
      u.elbaInkOnBoard.value = on ? 1 : 0;
      u.elbaBoardColor.value.set(boardHex);
    },
    setMasks(side, maps) {
      const m = side === "outside" ? outside : inside;
      const u = side === "outside" ? uOut : uIn;
      u.elbaFinishMap.value = maps.finish ?? black;
      u.elbaFoilMap.value = maps.foil ?? clear;
      relief[side] = maps.relief;
      const next = maps.relief ?? fibre;
      if (m.bumpMap !== next) {
        m.bumpMap = next;
        m.needsUpdate = true;
      }
    },
    apply(side, s) {
      const m = side === "outside" ? outside : inside;
      const u = side === "outside" ? uOut : uIn;
      m.roughness = s.look.roughness;
      m.clearcoat = Math.max(0.001, s.look.clearcoat);
      m.clearcoatRoughness = s.look.clearcoatRoughness;
      m.sheen = Math.max(0.001, s.look.sheen);
      m.sheenRoughness = s.look.sheenRoughness;
      m.envMapIntensity = s.look.envIntensity;
      m.color.copy(s.color);
      m.bumpScale = relief[side] ? s.bumpScale * RELIEF_BUMP_SCALE : fibreScale[side];
      u.elbaInkTone.value = s.look.inkTone;
      u.elbaMaskFade.value = s.maskFade;
    },
    setBoard(a, layers, d) {
      setEdge(a, layers);
      uOut.elbaDetail.value = d;
      fibreScale.outside = d * 1.8;
      fibreScale.inside = d * 2.2;
      if (!relief.outside) outside.bumpScale = fibreScale.outside;
      if (!relief.inside) inside.bumpScale = fibreScale.inside;
      uIn.elbaDetail.value = d * 1.2;
      // tiles are neutral; only the strength changes between corrugated and solid board
      const strength = a.fluteColor ? 12 : 4;
      if ((tile?.userData.strength ?? strength) !== strength) {
        for (const old of [tile, insideTile]) {
          if (!old) continue;
          old.dispose();
          owned.delete(old);
        }
        tile = own(boardTileTexture(strength, sheet));
        insideTile = own(boardTileTexture(strength, sheet, 7654321));
        if (!artwork.outside) outside.map = tile;
        if (!artwork.inside) inside.map = insideTile;
        outside.needsUpdate = inside.needsUpdate = true;
      }
      if (tile) tile.userData.strength = strength;
      if (insideTile) insideTile.userData.strength = strength;
    },
    dispose() {
      for (const o of owned) o.dispose();
      owned.clear();
    },
  };
}

/** Index helpers re-exported for callers that build their own groups. */
export const FINISH_SLOTS = { outside: MAT_OUTSIDE, inside: MAT_INSIDE, edge: MAT_EDGE } as const;
