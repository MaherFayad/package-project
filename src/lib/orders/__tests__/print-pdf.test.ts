import { describe, expect, it } from "vitest";
import { PDFArray, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream, type PDFPage } from "pdf-lib";
import type { DesignDoc } from "@/types";
import { generatePrintPdf } from "../pdf/print";
import { isWinAnsi, parseColor } from "../pdf/canvas";

// 1×1 red PNG.
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";

const doc: DesignDoc = {
  v: 1,
  id: "d1",
  name: "Test",
  structureCode: "FEFCO_0427",
  dims: { L: 250, W: 180, H: 80 },
  materialCode: "E_FLUTE_KRAFT",
  finishCode: "MATTE_LAMINATION",
  printSides: "BOTH",
  artwork: {
    outside: {
      background: "#f4e9d8",
      layers: [
        { id: "s1", kind: "shape", face: "top", surface: "outside", x: 125, y: 90, width: 80, height: 40, rotation: 15, shape: "ellipse", fill: "#c8102e", stroke: "#000000", strokeWidthMm: 0.5 },
        { id: "t1", kind: "text", face: "front", surface: "outside", x: 125, y: 40, width: 120, height: 14, rotation: 0, text: "Bloom Candles", fontFamily: "Inter", fontSizePt: 24, fontWeight: 700, color: "#303030", align: "center", direction: "ltr" },
        { id: "i1", kind: "image", face: "top", surface: "outside", x: 60, y: 40, width: 30, height: 30, rotation: 0, src: PNG, pxWidth: 1, pxHeight: 1 },
      ],
    },
    inside: { background: "#ffffff", layers: [] },
  },
};

/** Decoded content stream(s) of a page. */
function contentOf(page: PDFPage): string {
  const c = page.node.Contents();
  const refs = c instanceof PDFArray ? c.asArray() : c ? [c] : [];
  return refs
    .map((r) => page.doc.context.lookup(r))
    .map((s) => (s instanceof PDFRawStream ? Buffer.from(decodePDFRawStream(s).decode()).toString("latin1") : ""))
    .join("\n");
}

describe("print-ready PDF", () => {
  it("builds one page per printed side with trim/bleed boxes, Dieline spot colour and layers", async () => {
    const r = await generatePrintPdf(doc, { orderNumber: "ELB-26002", itemId: "item1", quantity: 500, proofHash: "abc123", now: new Date("2026-11-05T10:00:00Z") });
    expect(r.pages).toBe(2);
    expect(r.warnings).toEqual([]);
    const text = Buffer.from(r.bytes).toString("latin1");
    expect(text.startsWith("%PDF-")).toBe(true);
    expect(text).toContain("/Separation /Dieline");
    expect(text).toContain("/OCProperties");
    expect(text).toContain("/TrimBox");
    expect(text).toContain("/BleedBox");

    const pdf = await PDFDocument.load(r.bytes);
    const ops = contentOf(pdf.getPage(0));
    expect(ops).toMatch(/\/OC \/Art BDC/);
    expect(ops).toMatch(/\/OC \/Die BDC/);
    expect(ops).toMatch(/\/Dieline CS/);
    expect(ops).toMatch(/\/OC \/Mrk BDC/);
    expect(ops).toMatch(/\/All CS/);
    expect(ops).toMatch(/ Tj/); // Latin text is vector
    expect(ops).toMatch(/ Do/); // image placed
    expect(pdf.getPageCount()).toBe(2);
    const page = pdf.getPage(0);
    const trim = page.getTrimBox();
    const bleed = page.getBleedBox();
    const mm = 72 / 25.4;
    // Bleed is 3 mm on every side of the trim.
    expect(trim.x - bleed.x).toBeCloseTo(3 * mm, 3);
    expect(bleed.width - trim.width).toBeCloseTo(6 * mm, 3);
    expect(trim.width / mm).toBeCloseTo(r.trimMm.width, 3);
    const ocgs = pdf.catalog.lookup(PDFName.of("OCProperties"));
    expect(String(ocgs)).toContain("OCGs");
  });

  it("makes a watermarked proof without crop marks", async () => {
    const r = await generatePrintPdf({ ...doc, printSides: "OUTSIDE" }, { watermark: "PROOF - NOT FOR PRINT" });
    expect(r.pages).toBe(1);
    const pdf = await PDFDocument.load(r.bytes);
    expect(contentOf(pdf.getPage(0))).not.toMatch(/\/OC \/Mrk BDC/);
  });

  it("handles Arabic text (raster via sharp) or reports it for prepress", async () => {
    const ar: DesignDoc = {
      ...doc,
      printSides: "OUTSIDE",
      artwork: {
        ...doc.artwork,
        outside: {
          background: null,
          layers: [{ id: "a1", kind: "text", face: "front", surface: "outside", x: 125, y: 40, width: 80, height: 14, rotation: 0, text: "شموع بلوم", fontFamily: "IBM Plex Sans Arabic", fontSizePt: 24, fontWeight: 700, color: "#303030", align: "center", direction: "rtl" }],
        },
      },
    };
    const r = await generatePrintPdf(ar, {});
    expect(r.pages).toBe(1);
    expect(r.warnings.every((w) => w.startsWith("TEXT_"))).toBe(true);
  }, 20_000);

  it("parses colours and detects WinAnsi text", () => {
    expect(parseColor("#ff0000")).toEqual([1, 0, 0, 1]);
    expect(parseColor("#0f0")).toEqual([0, 1, 0, 1]);
    expect(parseColor("rgba(0, 0, 255, 0.5)")).toEqual([0, 0, 1, 0.5]);
    expect(isWinAnsi("Bloom Candles – 2026")).toBe(true);
    expect(isWinAnsi("شموع")).toBe(false);
  });
});
