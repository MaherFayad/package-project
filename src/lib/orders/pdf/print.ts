// Eager model library: doc helpers below read the registry (PERF-04).
import "@/lib/library";
import {
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  StandardFonts,
  degrees,
  popGraphicsState,
  pushGraphicsState,
  setDashPattern,
  setGraphicsState,
  setLineWidth,
  setFillingCmykColor,
  moveTo,
  lineTo,
  stroke,
  beginText,
  endText,
  setFontAndSize,
  setTextMatrix,
  showText,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  type PDFRef,
} from "pdf-lib";
import { docGeometry } from "@/lib/library/doc";
import type { DesignDoc, PrintSurface, TextLayer } from "@/types";
import { BOARD_SPECS, generateDieline, paintArtworkSurface, type DielineModel, type Ctx2D } from "@/lib/dieline";
import {
  MM_TO_PT,
  PdfCanvas,
  isWinAnsi,
  mul,
  apply,
  rawOps,
  textRasterKey,
  type Affine,
  type PdfImageHandle,
  type TextRaster,
} from "./canvas";

/**
 * Print-ready dieline PDF (server only, pdf-lib).
 *
 * - One page per printed surface (outside; plus inside when printSides = BOTH, mirrored for press).
 * - Artwork is placed on the dieline exactly like the 3D preview (same painter), clipped to the
 *   3 mm bleed on cut edges and kept off glue flaps.
 * - The dieline (cut solid, crease dashed) is stroked in a Separation spot colour named
 *   "Dieline" on its own optional-content layer "Dieline", set to overprint.
 * - Crop marks at the trim (die bounds) corners in registration colour ("All") on layer "Marks".
 * - TrimBox = die bounds, BleedBox = die bounds + bleed; a slug line names the job.
 * - `watermark` turns it into a low-trust proof: no marks, diagonal "PROOF" text.
 *
 * Images are embedded at their uploaded resolution. Latin text is vector (Helvetica); other
 * scripts (Arabic) are rendered once at 600 dpi with HarfBuzz through `sharp` when it is
 * available. Anything that could not be placed is reported in `warnings` for prepress.
 */
export interface PrintPdfOptions {
  orderNumber?: string;
  itemId?: string;
  quantity?: number;
  proofHash?: string;
  /** Proof mode: diagonal watermark, no crop marks. */
  watermark?: string;
  /** Override "now" (tests). */
  now?: Date;
}

export interface PrintPdfResult {
  bytes: Uint8Array;
  warnings: string[];
  pages: number;
  /** Trim size of the die (mm). */
  trimMm: { width: number; height: number };
}

const MARGIN_MM = 15;
const PT_TO_MM = 25.4 / 72;
const RASTER_DPI = 600;

type SharpLike = (input: Buffer, opts?: { density?: number }) => {
  trim: (o?: { threshold?: number }) => ReturnType<SharpLike>;
  png: () => ReturnType<SharpLike>;
  toBuffer: (o: { resolveWithObject: true }) => Promise<{ data: Buffer; info: { width: number; height: number } }>;
};

async function loadSharp(): Promise<SharpLike | null> {
  try {
    const mod = (await import("sharp")) as unknown as { default?: SharpLike };
    return (mod.default ?? (mod as unknown as SharpLike)) || null;
  } catch {
    return null;
  }
}

const xmlEscape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function decodeDataUrl(src: string): { mime: string; bytes: Buffer } | null {
  const m = /^data:([\w/+.-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(src);
  if (!m) return null;
  return { mime: m[1].toLowerCase(), bytes: Buffer.from(m[2], "base64") };
}

/** Render one line of non-Latin text to a tightly trimmed PNG (mm size from 600 dpi). */
async function rasterText(
  sharp: SharpLike,
  text: string,
  layer: Pick<TextLayer, "fontFamily" | "fontWeight" | "color">,
  sizeMm: number,
): Promise<{ png: Buffer; widthMm: number; heightMm: number } | null> {
  const dpmm = RASTER_DPI / 25.4;
  const fontPx = sizeMm * dpmm;
  const W = Math.ceil(Math.max(1, [...text].length) * fontPx * 1.1 + fontPx * 2);
  const H = Math.ceil(fontPx * 2.2);
  const rtl = /[֐-ࣿיִ-ﻼ]/.test(text);
  const family =
    layer.fontFamily === "Inter"
      ? "Inter, 'DejaVu Sans', sans-serif"
      : "'IBM Plex Sans Arabic', 'Noto Sans Arabic', 'DejaVu Sans', sans-serif";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" dominant-baseline="central" direction="${rtl ? "rtl" : "ltr"}" ` +
    `font-family="${xmlEscape(family)}" font-weight="${layer.fontWeight}" font-size="${fontPx.toFixed(2)}" fill="${xmlEscape(layer.color)}">${xmlEscape(text)}</text></svg>`;
  try {
    const { data, info } = await sharp(Buffer.from(svg)).trim({ threshold: 0 }).png().toBuffer({ resolveWithObject: true });
    if (!info.width || !info.height) return null;
    return { png: data, widthMm: info.width / dpmm, heightMm: info.height / dpmm };
  } catch {
    return null;
  }
}

interface Prepared {
  images: Map<string, PDFImage>;
  texts: Map<string, { image: PDFImage; widthMm: number; heightMm: number }>;
}

async function prepareAssets(pdf: PDFDocument, doc: DesignDoc, surfaces: PrintSurface[], warnings: string[]): Promise<Prepared> {
  const images = new Map<string, PDFImage>();
  const texts = new Map<string, { image: PDFImage; widthMm: number; heightMm: number }>();
  let sharp: SharpLike | null | undefined;
  const getSharp = async () => (sharp === undefined ? (sharp = await loadSharp()) : sharp);

  for (const surface of surfaces) {
    for (const layer of doc.artwork[surface].layers) {
      if (layer.hidden || layer.surface !== surface) continue;
      if (layer.kind === "image" && !images.has(layer.src)) {
        const d = decodeDataUrl(layer.src);
        if (!d) {
          warnings.push(`IMAGE_NOT_EMBEDDED:${layer.id}`);
          continue;
        }
        try {
          if (d.mime === "image/png") images.set(layer.src, await pdf.embedPng(d.bytes));
          else if (d.mime === "image/jpeg" || d.mime === "image/jpg") images.set(layer.src, await pdf.embedJpg(d.bytes));
          else {
            const s = await getSharp();
            if (!s) throw new Error("no converter");
            const { data } = await s(d.bytes).png().toBuffer({ resolveWithObject: true });
            images.set(layer.src, await pdf.embedPng(data));
          }
        } catch {
          warnings.push(`IMAGE_NOT_EMBEDDED:${layer.id}`);
        }
      }
      if (layer.kind === "text") {
        const sizeMm = layer.fontSizePt * PT_TO_MM;
        for (const line of layer.text.split("\n")) {
          if (!line || isWinAnsi(line)) continue;
          const key = textRasterKey(layer.fontWeight, sizeMm, layer.color, line);
          if (texts.has(key)) continue;
          const s = await getSharp();
          const r = s ? await rasterText(s, line, layer, sizeMm) : null;
          if (!r) {
            warnings.push(`TEXT_NOT_RENDERED:${layer.id}`);
            continue;
          }
          texts.set(key, { image: await pdf.embedPng(r.png), widthMm: r.widthMm, heightMm: r.heightMm });
        }
      }
    }
  }
  return { images, texts };
}

function trimRect(model: DielineModel, mirrored: boolean) {
  const b = model.dieBounds;
  return { x: mirrored ? model.sheet.width - b.x - b.width : b.x, y: b.y, width: b.width, height: b.height };
}

/** Generate the print-ready (or watermarked proof) PDF for a design snapshot. */
export async function generatePrintPdf(doc: DesignDoc, opts: PrintPdfOptions = {}): Promise<PrintPdfResult> {
  // Library models (family styles, containers) print from their own dieline / label sheet.
  const model = docGeometry(doc)?.dieline ?? generateDieline(doc.structureCode, doc.dims, { thicknessMm: BOARD_SPECS[doc.materialCode].thicknessMm });
  const surfaces: PrintSurface[] = doc.printSides === "BOTH" ? ["outside", "inside"] : ["outside"];
  const warnings: string[] = [];
  const now = opts.now ?? new Date();

  const pdf = await PDFDocument.create();
  pdf.setTitle(opts.watermark ? `Proof ${opts.orderNumber ?? ""}`.trim() : `Print file ${opts.orderNumber ?? ""}`.trim());
  pdf.setSubject(`${doc.structureCode} ${doc.dims.L}x${doc.dims.W}x${doc.dims.H} mm, ${doc.materialCode}, ${doc.finishCode}, ${doc.printSides}`);
  pdf.setCreator("Elba");
  pdf.setProducer("Elba print pipeline (pdf-lib)");
  pdf.setCreationDate(now);
  pdf.setModificationDate(now);

  const ctx = pdf.context;
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const helvB = await pdf.embedFont(StandardFonts.HelveticaBold);
  const prepared = await prepareAssets(pdf, doc, surfaces, warnings);

  // Spot colours: "Dieline" (magenta alternate) and registration "All".
  const tint = (c1: number[]) => ctx.register(ctx.obj({ FunctionType: 2, Domain: [0, 1], C0: [0, 0, 0, 0], C1: c1, N: 1 }));
  const dielineCs = ctx.register(ctx.obj([PDFName.of("Separation"), PDFName.of("Dieline"), PDFName.of("DeviceCMYK"), tint([0, 1, 0, 0])]));
  const allCs = ctx.register(ctx.obj([PDFName.of("Separation"), PDFName.of("All"), PDFName.of("DeviceCMYK"), tint([1, 1, 1, 1])]));

  // Optional content groups (layers).
  const ocg = (name: string) => ctx.register(ctx.obj({ Type: "OCG", Name: PDFHexString.fromText(name) }));
  const layers = { Art: ocg("Artwork"), Die: ocg("Dieline"), Mrk: ocg("Marks") };
  const layerRefs: PDFRef[] = opts.watermark ? [layers.Art, layers.Die] : [layers.Art, layers.Die, layers.Mrk];
  pdf.catalog.set(
    PDFName.of("OCProperties"),
    ctx.obj({ OCGs: layerRefs, D: { Name: PDFHexString.fromText("Elba"), Order: layerRefs, ON: layerRefs, OFF: [] } }),
  );
  const overprint = ctx.register(ctx.obj({ Type: "ExtGState", OP: true, op: true, OPM: 1 }));

  const sheetW = model.sheet.width;
  const sheetH = model.sheet.height;
  const pageW = (sheetW + MARGIN_MM * 2) * MM_TO_PT;
  const pageH = (sheetH + MARGIN_MM * 2) * MM_TO_PT;
  const K = MM_TO_PT;

  for (const surface of surfaces) {
    const mirrored = surface === "inside";
    const page = pdf.addPage([pageW, pageH]);
    const base: Affine = [K, 0, 0, -K, MARGIN_MM * K, pageH - MARGIN_MM * K];
    const toPage: Affine = mirrored ? mul(base, [-1, 0, 0, 1, sheetW, 0]) : base;

    // Page boxes.
    const trim = trimRect(model, mirrored);
    const boxPt = (x: number, y: number, w: number, h: number) => [(MARGIN_MM + x) * K, pageH - (MARGIN_MM + y + h) * K, w * K, h * K] as const;
    page.setTrimBox(...boxPt(trim.x, trim.y, trim.width, trim.height));
    page.setBleedBox(...boxPt(trim.x - model.bleedMm, trim.y - model.bleedMm, trim.width + model.bleedMm * 2, trim.height + model.bleedMm * 2));

    // Resources.
    const res = page.node.normalizedEntries().Resources;
    res.set(PDFName.of("ColorSpace"), ctx.obj({ Dieline: dielineCs, All: allCs }));
    res.set(PDFName.of("Properties"), ctx.obj(layers));
    const F1 = page.node.newFontDictionary("F", helv.ref);
    const F2 = page.node.newFontDictionary("F", helvB.ref);
    const OP = page.node.newExtGState("GS", overprint);
    const alphaCache = new Map<string, PDFName>();
    const alphaState = (a: number) => {
      const k = a.toFixed(3);
      let n = alphaCache.get(k);
      if (!n) {
        n = page.node.newExtGState("GS", ctx.obj({ Type: "ExtGState", ca: PDFNumber.of(a), CA: PDFNumber.of(a) }));
        alphaCache.set(k, n);
      }
      return n;
    };
    const handle = (img: PDFImage): PdfImageHandle => ({ __pdfImage: true, name: page.node.newXObject("Im", img.ref), width: img.width, height: img.height });
    const imageHandles = new Map<string, CanvasImageSource>();
    for (const [src, img] of prepared.images) imageHandles.set(src, handle(img) as unknown as CanvasImageSource);
    const textRasters = new Map<string, TextRaster>();
    for (const [k, t] of prepared.texts) textRasters.set(k, { image: handle(t.image), widthMm: t.widthMm, heightMm: t.heightMm });

    // 1) Artwork layer — the same painter as the 3D preview.
    const canvas = new PdfCanvas({
      toPage,
      alphaState,
      fonts: { regular: { font: helv, name: F1 }, bold: { font: helvB, name: F2 } },
      textRasters,
      onSkippedText: () => warnings.push(`TEXT_SKIPPED:${surface}`),
    });
    canvas.push(rawOps.beginLayer(PDFName.of("Art")), pushGraphicsState());
    paintArtworkSurface(canvas as unknown as Ctx2D, model, doc.artwork[surface], {
      surface,
      pxPerMm: 1,
      boardColor: "transparent",
      images: imageHandles,
      resolveFont: () => "sans-serif",
    });
    canvas.push(popGraphicsState(), rawOps.endLayer());
    page.pushOperators(...canvas.ops);

    // 2) Dieline layer: Separation "Dieline", overprinting, cut solid + crease dashed.
    const seg = (s: { a: { x: number; y: number }; b: { x: number; y: number } }) => {
      const a = apply(toPage, s.a.x, s.a.y);
      const b = apply(toPage, s.b.x, s.b.y);
      return [moveTo(a[0], a[1]), lineTo(b[0], b[1])];
    };
    page.pushOperators(
      rawOps.beginLayer(PDFName.of("Die")),
      pushGraphicsState(),
      setGraphicsState(OP),
      rawOps.strokeColorSpace(PDFName.of("Dieline")),
      rawOps.strokeTint(1),
      setLineWidth(0.5),
      ...model.cutLines.flatMap(seg),
      stroke(),
      setDashPattern([4, 3], 0),
      ...model.creaseLines.flatMap(seg),
      stroke(),
      popGraphicsState(),
      rawOps.endLayer(),
    );

    // 3) Crop marks + slug (print file only).
    if (!opts.watermark) {
      const [x0, y0] = apply(base, trim.x, trim.y + trim.height); // bottom-left (pt)
      const [x1, y1] = apply(base, trim.x + trim.width, trim.y); // top-right (pt)
      const off = (model.bleedMm + 2) * K;
      const len = 5 * K;
      const marks = [
        // [x, y, dx, dy] for each corner: horizontal then vertical
        [x0, y0, -1, -1],
        [x1, y0, 1, -1],
        [x0, y1, -1, 1],
        [x1, y1, 1, 1],
      ].flatMap(([x, y, sx, sy]) => [
        moveTo(x + sx * off, y),
        lineTo(x + sx * (off + len), y),
        moveTo(x, y + sy * off),
        lineTo(x, y + sy * (off + len)),
      ]);
      const slug = [
        "Elba print file",
        opts.orderNumber ? `Order ${opts.orderNumber}` : null,
        opts.itemId ? `Item ${opts.itemId}` : null,
        `${doc.structureCode} ${doc.dims.L} x ${doc.dims.W} x ${doc.dims.H} mm (inner)`,
        doc.materialCode,
        doc.finishCode,
        `${surface.toUpperCase()}${mirrored ? " (mirrored for press)" : ""}`,
        opts.quantity ? `Qty ${opts.quantity}` : null,
        opts.proofHash ? `Proof ${opts.proofHash.slice(0, 12)}` : null,
        now.toISOString().slice(0, 16).replace("T", " ") + " UTC",
        "Spot: Dieline (do not print)",
      ]
        .filter(Boolean)
        .join("  |  ");
      // Brand colours (designer): the buyer's CMYK / spot references, for the printer to match.
      const colours = (doc.brandColors ?? [])
        .map((c) => [c.hex.toUpperCase(), c.cmyk ? `CMYK ${c.cmyk.join("/")}` : null, c.spot ? `ref ${c.spot}` : null].filter(Boolean).join(" "))
        .join("; ");
      const colourLine = colours ? `Buyer colour references (match, not guaranteed): ${colours}` : null;
      page.pushOperators(
        rawOps.beginLayer(PDFName.of("Mrk")),
        pushGraphicsState(),
        rawOps.strokeColorSpace(PDFName.of("All")),
        rawOps.strokeTint(1),
        setLineWidth(0.25),
        ...marks,
        stroke(),
        setFillingCmykColor(0, 0, 0, 1),
        beginText(),
        setFontAndSize(F1, 6),
        setTextMatrix(1, 0, 0, 1, 6 * K, 5 * K),
        showText(helv.encodeText(slug.replace(/[^ -~]/g, "?"))),
        endText(),
        ...(colourLine
          ? [beginText(), setFontAndSize(F1, 6), setTextMatrix(1, 0, 0, 1, 6 * K, 1.8 * K), showText(helv.encodeText(colourLine.replace(/[^ -~]/g, "?").slice(0, 400))), endText()]
          : []),
        popGraphicsState(),
        rawOps.endLayer(),
      );
    } else {
      drawWatermark(page, helvB, opts.watermark, alphaState);
    }
  }

  const bytes = await pdf.save({ useObjectStreams: false });
  return { bytes, warnings: [...new Set(warnings)], pages: surfaces.length, trimMm: { width: model.dieBounds.width, height: model.dieBounds.height } };
}

function drawWatermark(page: PDFPage, font: PDFFont, text: string, alphaState: (a: number) => PDFName) {
  const { width, height } = page.getSize();
  const safe = text.replace(/[^ -~]/g, "");
  const size = Math.max(18, Math.min(width, height) / 8);
  const w = font.widthOfTextAtSize(safe, size);
  const angle = Math.atan2(height, width);
  page.pushOperators(pushGraphicsState(), setGraphicsState(alphaState(0.18)));
  page.drawText(safe, {
    x: width / 2 - (Math.cos(angle) * w) / 2,
    y: height / 2 - (Math.sin(angle) * w) / 2,
    size,
    font,
    rotate: degrees((angle * 180) / Math.PI),
  });
  page.pushOperators(popGraphicsState());
}
