"use client";

/**
 * R6 marketing capture stage (NOT shipped). scripts/marketing/render-assets.mjs copies this file to
 * src/app/[locale]/dev/r6-capture/page.tsx, starts `next dev`, drives it with Playwright and deletes
 * it again. It mounts the REAL editor stage (DesignScene, the same component the designer uses) with
 * a library model and sample artwork for a fictional Egyptian brand, and exposes window.__r6 so the
 * script can set the view, orbit the camera frame by frame and grab transparent PNGs.
 *
 *   /en/dev/r6-capture?shot=<id>&fold=1
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { ArtworkLayer, DesignDoc, FaceId } from "@/types";
import { modelByCode } from "@/lib/library";
import { docGeometry } from "@/lib/library/doc";
import type { PackagingSceneHandle, ViewName } from "@/components/three";
import { DesignScene } from "@/components/designer/DesignScene";
import { createModelDoc } from "@/components/designer/lib/doc";
import { useArtworkCanvases } from "@/components/designer/useArtworkCanvases";

type Pattern = "khatam" | "arches" | "waves" | "dots" | "stripes" | "lattice";
interface Brand {
  key: string;
  latin: string;
  arabic: string;
  tag: string;
  tagAr: string;
  bg: string;
  ink: string;
  accent: string;
  pattern: Pattern;
}

const BRANDS: Record<string, Brand> = {
  sahwa: { key: "sahwa", latin: "SAHWA", arabic: "صحوة", tag: "specialty coffee · cairo", tagAr: "قهوة مختصة", bg: "#2b1a12", ink: "#f3e3c7", accent: "#d08a3c", pattern: "waves" },
  attar: { key: "attar", latin: "ATTAR", arabic: "عطار", tag: "oud & amber · khan el khalili", tagAr: "عود وعنبر", bg: "#14161c", ink: "#e9cf8f", accent: "#b8913f", pattern: "khatam" },
  halawa: { key: "halawa", latin: "Halawa", arabic: "حلاوة", tag: "oriental sweets · since 1962", tagAr: "حلويات شرقية", bg: "#f1c9c2", ink: "#7a1f2b", accent: "#c8434f", pattern: "arches" },
  nada: { key: "nada", latin: "NADA", arabic: "ندى", tag: "botanical skin care", tagAr: "عناية بالبشرة", bg: "#e8efe6", ink: "#25443a", accent: "#7fa58e", pattern: "dots" },
  waraqa: { key: "waraqa", latin: "Waraqa", arabic: "ورقة", tag: "nile valley tea", tagAr: "شاي وادي النيل", bg: "#1f4d3a", ink: "#f4ead2", accent: "#e0b04a", pattern: "lattice" },
  nour: { key: "nour", latin: "NOUR", arabic: "نور", tag: "atelier · cairo", tagAr: "أتيليه القاهرة", bg: "#c9572f", ink: "#fff3e4", accent: "#f2c14e", pattern: "stripes" },
};

/** Every shot the render script knows: a library model code + a brand. */
const SHOTS: { id: string; code: string; brand: string; material?: string; vessel?: Partial<NonNullable<DesignDoc["vessel"]>> }[] = [
  { id: "mailer", code: "FEFCO_0427", brand: "nour" },
  { id: "rigid-box", code: "RIGID_BOX", brand: "attar" },
  { id: "drawer-box", code: "RIGID_DRAWER", brand: "halawa" },
  { id: "tuck-carton", code: "ECMA_RTE", brand: "waraqa" },
  { id: "perfume", code: "PERFUME_SQUARE", brand: "attar", vessel: { closureColor: "GOLD" } },
  { id: "bottle", code: "BOSTON_ROUND", brand: "nada" },
  { id: "jar", code: "WIDE_JAR", brand: "nada" },
  { id: "can", code: "CAN", brand: "sahwa" },
  { id: "tube", code: "SQUEEZE_TUBE", brand: "nada" },
  { id: "pouch", code: "STAND_UP_POUCH", brand: "sahwa" },
  { id: "coffee-bag", code: "FLEX_SIDE_GUSSET_BAG", brand: "sahwa" },
  { id: "cup", code: "CUP-ICE-PINT", brand: "halawa" },
  { id: "dropper", code: "DROPPER_BOTTLE", brand: "nada", vessel: { closureColor: "BLACK" } },
  { id: "tea-tin", code: "ROUND_TIN", brand: "waraqa" },
];

const PT_PER_MM = 72 / 25.4;

function patternSvg(p: Pattern, c: string): string {
  const s = 120;
  let body = "";
  if (p === "khatam") {
    // eight-point star (two squares) tiling
    const st = (x: number, y: number, r: number) =>
      `<rect x="${x - r}" y="${y - r}" width="${2 * r}" height="${2 * r}" fill="none" stroke="${c}" stroke-width="3"/><rect x="${x - r}" y="${y - r}" width="${2 * r}" height="${2 * r}" transform="rotate(45 ${x} ${y})" fill="none" stroke="${c}" stroke-width="3"/>`;
    body = st(60, 60, 30) + st(0, 0, 18) + st(120, 0, 18) + st(0, 120, 18) + st(120, 120, 18);
  } else if (p === "arches") {
    body = `<path d="M10 120 V60 a50 50 0 0 1 100 0 V120" fill="none" stroke="${c}" stroke-width="4"/><path d="M30 120 V66 a30 30 0 0 1 60 0 V120" fill="none" stroke="${c}" stroke-width="3"/><circle cx="60" cy="22" r="5" fill="${c}"/>`;
  } else if (p === "waves") {
    body = [15, 45, 75, 105].map((y) => `<path d="M0 ${y} q15 -14 30 0 t30 0 t30 0 t30 0" fill="none" stroke="${c}" stroke-width="3.5"/>`).join("");
  } else if (p === "dots") {
    body = `<circle cx="30" cy="30" r="9" fill="${c}"/><circle cx="90" cy="90" r="9" fill="${c}"/><circle cx="90" cy="30" r="3.5" fill="${c}"/><circle cx="30" cy="90" r="3.5" fill="${c}"/>`;
  } else if (p === "stripes") {
    body = `<path d="M-30 30 L30 -30 M-30 90 L90 -30 M-30 150 L150 -30 M30 150 L150 30 M90 150 L150 90" stroke="${c}" stroke-width="14"/>`;
  } else {
    body = `<path d="M60 0 L120 60 L60 120 L0 60 Z" fill="none" stroke="${c}" stroke-width="3"/><path d="M60 24 L96 60 L60 96 L24 60 Z" fill="none" stroke="${c}" stroke-width="2"/><circle cx="60" cy="60" r="6" fill="${c}"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200"><defs><pattern id="p" width="${s}" height="${s}" patternUnits="userSpaceOnUse">${body}</pattern></defs><rect width="1200" height="1200" fill="url(#p)"/></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

let n = 0;
const id = () => `r6-${++n}`;

/** Strong sample artwork: brand colour, a pattern, a framed panel with latin + arabic wordmark on the main faces. */
function brandArtwork(faces: Partial<Record<FaceId, { width: number; height: number }>>, b: Brand): DesignDoc["artwork"]["outside"] {
  const entries = Object.entries(faces) as [FaceId, { width: number; height: number }][];
  const maxArea = Math.max(...entries.map(([, f]) => f.width * f.height));
  const layers: ArtworkLayer[] = [];
  const pat = patternSvg(b.pattern, b.accent);
  for (const [face, f] of entries) {
    const { width: w, height: h } = f;
    const main = w * h >= maxArea * 0.55;
    layers.push({ id: id(), kind: "image", face, surface: "outside", x: w / 2, y: h / 2, width: Math.max(w, h), height: Math.max(w, h), rotation: 0, src: pat, pxWidth: 1200, pxHeight: 1200, fit: "cover", opacity: main ? 0.32 : 0.5 });
    if (!main) {
      const sz = Math.min(h * 0.32, w / (b.latin.length * 0.75)) * PT_PER_MM;
      if (sz > 6) layers.push({ id: id(), kind: "text", face, surface: "outside", x: w / 2, y: h / 2, width: w * 0.9, height: h * 0.5, rotation: 0, text: b.latin, fontFamily: "Inter", fontSizePt: sz, fontWeight: 700, color: b.ink, align: "center", direction: "ltr" });
      continue;
    }
    const pw = w * 0.78, ph = Math.min(h * 0.7, pw * 1.05);
    layers.push({ id: id(), kind: "shape", face, surface: "outside", shape: "rect", x: w / 2, y: h / 2, width: pw, height: ph, rotation: 0, fill: b.bg, stroke: b.accent, strokeWidthMm: Math.max(0.6, w * 0.008) });
    const latinMm = Math.min(pw * 0.86 / (b.latin.length * 0.64), ph * 0.26);
    layers.push({ id: id(), kind: "text", face, surface: "outside", x: w / 2, y: h / 2 - ph * 0.1, width: pw * 0.95, height: latinMm * 1.4, rotation: 0, text: b.latin, fontFamily: "Inter", fontSizePt: latinMm * PT_PER_MM, fontWeight: 700, color: b.ink, align: "center", direction: "ltr" });
    const arMm = latinMm * 0.78;
    layers.push({ id: id(), kind: "text", face, surface: "outside", x: w / 2, y: h / 2 + ph * 0.13, width: pw * 0.9, height: arMm * 1.6, rotation: 0, text: b.arabic, fontFamily: "IBM Plex Sans Arabic", fontSizePt: arMm * PT_PER_MM, fontWeight: 600, color: b.accent, align: "center", direction: "rtl" });
    const tagMm = Math.min(latinMm * 0.2, pw * 0.9 / (b.tag.length * 0.55));
    layers.push({ id: id(), kind: "text", face, surface: "outside", x: w / 2, y: h / 2 + ph * 0.33, width: pw * 0.95, height: tagMm * 1.6, rotation: 0, text: b.tag.toUpperCase(), fontFamily: "Inter", fontSizePt: tagMm * PT_PER_MM, fontWeight: 500, color: b.ink, align: "center", direction: "ltr" });
  }
  return { background: b.bg, layers };
}

function shotDoc(shotId: string): DesignDoc | null {
  const s = SHOTS.find((x) => x.id === shotId);
  const m = s ? modelByCode(s.code) : null;
  if (!s || !m) return null;
  const doc = createModelDoc(m, { name: s.id });
  const geo = docGeometry(doc);
  const faces = geo?.dieline.faces ?? {};
  const vessel = doc.vessel && s.vessel ? { ...doc.vessel, ...s.vessel } : doc.vessel;
  return { ...doc, ...(vessel ? { vessel } : {}), finishCode: "MATTE_LAMINATION", artwork: { ...doc.artwork, outside: brandArtwork(faces, BRANDS[s.brand]) } };
}

interface R6Api {
  ready: boolean;
  shots: typeof SHOTS;
  brands: typeof BRANDS;
  view(v: ViewName): void;
  rotate(az: number, polar?: number): void;
  zoom(f: number): void;
  shot(w: number, h: number, bg?: string | null): Promise<string>;
}

export default function R6CapturePage() {
  const [doc, setDoc] = useState<DesignDoc | null>(null);
  const [fold, setFold] = useState(1);
  const [size, setSize] = useState({ w: 900, h: 900 });
  const ref = useRef<PackagingSceneHandle | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    document.fonts.ready.then(() => setDoc(shotDoc(q.get("shot") ?? "mailer")));
    setFold(Number(q.get("fold") ?? 1));
    setSize({ w: Number(q.get("w") ?? 900), h: Number(q.get("h") ?? 900) });
  }, []);
  const geo = useMemo(() => (doc ? docGeometry(doc) : null), [doc]);
  const { canvases, version, images } = useArtworkCanvases(geo?.dieline ?? null, doc?.artwork ?? { outside: { background: null, layers: [] }, inside: { background: null, layers: [] } }, doc?.materialCode ?? "SBS_300", false);

  const ver = useRef(0);
  ver.current = version;
  useEffect(() => {
    const api: R6Api = {
      get ready() {
        return !!(ref.current && ver.current > 0);
      },
      shots: SHOTS,
      brands: BRANDS,
      view: (v) => ref.current?.setView(v),
      rotate: (az, polar = 0) => ref.current?.rotate(az, polar),
      zoom: (f) => ref.current?.zoom(f),
      async shot(w, h, bg = null) {
        const blob = await ref.current!.screenshot({ width: w, height: h, background: bg });
        const buf = new Uint8Array(await blob.arrayBuffer());
        let s = "";
        for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        return btoa(s);
      },
    };
    (window as unknown as { __r6: R6Api }).__r6 = api;
  });

  return (
    <div style={{ width: size.w, height: size.h, position: "relative", background: "transparent" }} data-version={version}>
      {doc && geo ? <DesignScene doc={doc} geo={geo} canvases={canvases} version={version} images={images} fold={fold} handleRef={ref} /> : null}
    </div>
  );
}
