import { CanvasTexture, DataTexture, LinearSRGBColorSpace, NoColorSpace, RepeatWrapping, RGBAFormat, SRGBColorSpace, type Texture } from "three";

/**
 * Procedural textures for board realism, generated on the client (no image files, no
 * hotlinking). Every texture is small (<= 512 px) and tiling; callers own and dispose them.
 */

function canvas(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** Deterministic PRNG so every load looks identical (and screenshots are stable). */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 0x100000000);
}

/**
 * Neutral paper / kraft grain (luminance around 0.5, tiling). Sampled in the finish shader to
 * modulate ink and board colour, so the fibre shows through print like it does on real kraft.
 * Long fibres run mostly along one direction (machine direction of the liner).
 */
export function grainTexture(size = 256, seed = 7): Texture | null {
  const c = canvas(size, size);
  const ctx = c?.getContext("2d");
  if (!c || !ctx) return null;
  const rnd = lcg(seed);
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (rnd() - 0.5) * 70;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // fibres, drawn three times with offsets so they wrap seamlessly
  const fibres: { x: number; y: number; a: number; l: number; light: boolean; w: number }[] = [];
  for (let i = 0; i < 420; i++) {
    fibres.push({ x: rnd() * size, y: rnd() * size, a: (rnd() - 0.5) * 0.9, l: 6 + rnd() * 26, light: rnd() > 0.55, w: 0.6 + rnd() * 1.1 });
  }
  for (const f of fibres) {
    ctx.strokeStyle = f.light ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.2)";
    ctx.lineWidth = f.w;
    for (const dx of [-size, 0, size])
      for (const dy of [-size, 0, size]) {
        ctx.beginPath();
        ctx.moveTo(f.x + dx, f.y + dy);
        ctx.quadraticCurveTo(f.x + dx + Math.cos(f.a) * f.l * 0.5, f.y + dy + Math.sin(f.a) * f.l * 0.5 + 1.5, f.x + dx + Math.cos(f.a) * f.l, f.y + dy + Math.sin(f.a) * f.l);
        ctx.stroke();
      }
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = NoColorSpace; // data, not colour
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/** Near-white tile with gentle grain, multiplied by the board colour (lets colour tween). */
export function boardTileTexture(strength: number, sheet: { width: number; height: number }, seed = 1234567): Texture | null {
  const size = 128;
  const c = canvas(size, size);
  const ctx = c?.getContext("2d");
  if (!c || !ctx) return null;
  const rnd = lcg(seed);
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * 2 * strength;
    img.data[i] = Math.max(0, Math.min(255, 238 + n));
    img.data[i + 1] = Math.max(0, Math.min(255, 238 + n * 0.95));
    img.data[i + 2] = Math.max(0, Math.min(255, 238 + n * 0.9));
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(sheet.width / 40, sheet.height / 40);
  tex.anisotropy = 4;
  return tex;
}

/**
 * Corrugated cut edge: outer liner, flute wave(s), inner liner. Double wall (BC) has a middle
 * liner and two waves. Edge UVs: u = mm along the edge / flute pitch (one wave per repeat),
 * v = 0 at the printed side … 1 at the inside.
 */
export function fluteEdgeTexture(colors: { liner: string; flute: string; edge: string; inner: string }, layers: 1 | 2): Texture | null {
  const w = 64;
  const h = layers === 2 ? 64 : 32;
  const c = canvas(w, h);
  const ctx = c?.getContext("2d");
  if (!c || !ctx) return null;
  const liner = 3;
  ctx.fillStyle = colors.edge;
  ctx.fillRect(0, 0, w, h);
  const band = (y0: number, y1: number) => {
    // shadowed cavities between the flute and the liners
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, "rgba(40,25,10,0.55)");
    g.addColorStop(0.5, "rgba(40,25,10,0.25)");
    g.addColorStop(1, "rgba(40,25,10,0.55)");
    ctx.fillStyle = g;
    ctx.fillRect(0, y0, w, y1 - y0);
    ctx.strokeStyle = colors.flute;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    const amp = (y1 - y0) / 2 - 1.5;
    const mid = (y0 + y1) / 2;
    for (let x = 0; x <= w; x++) {
      const y = mid + Math.sin((x / w) * Math.PI * 2) * amp;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };
  if (layers === 1) band(liner, h - liner);
  else {
    band(liner, h / 2 - 1.5);
    band(h / 2 + 1.5, h - liner);
    ctx.fillStyle = colors.inner;
    ctx.fillRect(0, h / 2 - 1.5, w, 3);
  }
  ctx.fillStyle = colors.liner;
  ctx.fillRect(0, 0, w, liner);
  ctx.fillStyle = colors.inner;
  ctx.fillRect(0, h - liner, w, liner);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.anisotropy = 2;
  return tex;
}

/** Solid board edge (SBS / greyboard): coated top skin, fibrous core, faint ply lines. */
export function solidEdgeTexture(colors: { top: string; core: string; bottom: string }): Texture | null {
  const w = 64;
  const h = 16;
  const c = canvas(w, h);
  const ctx = c?.getContext("2d");
  if (!c || !ctx) return null;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, colors.top);
  g.addColorStop(0.12, colors.top);
  g.addColorStop(0.2, colors.core);
  g.addColorStop(0.85, colors.core);
  g.addColorStop(1, colors.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const rnd = lcg(99);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.04 + rnd() * 0.05})`;
    ctx.fillRect(rnd() * w, 3 + rnd() * (h - 6), 1 + rnd() * 5, 0.6);
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = RepeatWrapping;
  return tex;
}

/** 1×1 data texture (default for an unused finish map slot). */
export function solidDataTexture(r: number, g: number, b: number, a: number, srgb = false): Texture {
  const t = new DataTexture(new Uint8Array([r, g, b, a]), 1, 1, RGBAFormat);
  t.colorSpace = srgb ? SRGBColorSpace : LinearSRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/** Warm oak table top (context scene), tiling along the grain. */
export function woodTexture(): Texture | null {
  const w = 512;
  const h = 256;
  const c = canvas(w, h);
  const ctx = c?.getContext("2d");
  if (!c || !ctx) return null;
  const rnd = lcg(42);
  ctx.fillStyle = "#b48a62";
  ctx.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 1) {
    const v = Math.sin(y * 0.09 + Math.sin(y * 0.013) * 4) * 0.5 + 0.5;
    ctx.fillStyle = `rgba(90,55,30,${0.05 + v * 0.12})`;
    ctx.fillRect(0, y, w, 1);
  }
  for (let i = 0; i < 160; i++) {
    const y = rnd() * h;
    ctx.strokeStyle = `rgba(70,40,20,${0.05 + rnd() * 0.12})`;
    ctx.lineWidth = 0.5 + rnd() * 1.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= w; x += 32) ctx.lineTo(x, y + Math.sin(x * 0.01 + i) * 2.5);
    ctx.stroke();
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}
