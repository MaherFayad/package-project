import { describe, expect, it } from "vitest";
import { isBlankArtwork, safeImageSrc, summariseArtwork } from "../artwork";
import { addBusinessDays, payoutExpectation } from "../payouts";
import { replyBy } from "../jobs";
import { vendorStats } from "../stats";
import type { DesignDoc } from "@/types";

const png = "data:image/png;base64,iVBORw0KGgo=";

describe("P-01 artwork summary", () => {
  it("groups layers per face, keeps raster images, drops SVG and off-site URLs", () => {
    const doc = {
      artwork: {
        outside: {
          background: "#ffffff",
          layers: [
            { id: "1", face: "top", surface: "outside", kind: "image", src: png, pxWidth: 1, pxHeight: 1, x: 0, y: 0, width: 1, height: 1, rotation: 0 },
            { id: "2", face: "top", surface: "outside", kind: "text", text: "  ZAD   coffee ", x: 0, y: 0, width: 1, height: 1, rotation: 0 },
            { id: "3", face: "front", surface: "outside", kind: "image", src: "data:image/svg+xml;base64,PHN2Zz4=", x: 0, y: 0, width: 1, height: 1, rotation: 0 },
            { id: "4", face: "front", surface: "outside", kind: "image", src: "//evil.example/x.png", x: 0, y: 0, width: 1, height: 1, rotation: 0 },
            { id: "5", face: "back", surface: "outside", kind: "shape", hidden: true, x: 0, y: 0, width: 1, height: 1, rotation: 0 },
          ],
        },
        inside: { background: null, layers: [] },
      },
    } as unknown as DesignDoc;
    const s = summariseArtwork(doc);
    expect(s.faces.map((f) => f.face)).toEqual(["front", "top"]);
    expect(s.faces[1]).toMatchObject({ images: [png], texts: ["ZAD coffee"] });
    expect(s.faces[0]).toMatchObject({ images: [], moreImages: 2 });
    expect(s.backgrounds).toEqual({ outside: "#ffffff" });
    expect(isBlankArtwork(s)).toBe(false);
  });

  it("an empty design is blank; safeImageSrc accepts our own paths only", () => {
    expect(isBlankArtwork(summariseArtwork({ artwork: { outside: { background: null, layers: [] }, inside: { background: null, layers: [] } } } as unknown as DesignDoc))).toBe(true);
    expect(safeImageSrc("/api/orders/proofs/x/preview")).toBe("/api/orders/proofs/x/preview");
    expect(safeImageSrc("/seed/logo.svg")).toBeNull();
    expect(safeImageSrc("https://example.com/a.png")).toBeNull();
  });
});

describe("P-02 vendor stats", () => {
  it("shows no on-time figure and no rating for a printer with no history", () => {
    expect(vendorStats([], [], 5)).toEqual({ judged: 0, min: 5, onTimePct: null, rating: null, ratingCount: 0 });
  });
  it("shows the figure once the minimum is reached and averages real reviews", () => {
    const d = (due: string, del: string) => ({ dueDate: new Date(due), deliveredAt: new Date(del), notes: null });
    const rows = [d("2026-11-01", "2026-11-01T10:00Z"), d("2026-11-01", "2026-11-03")];
    expect(vendorStats(rows, [5, 4], 2)).toMatchObject({ judged: 2, onTimePct: 50, rating: 4.5, ratingCount: 2 });
    expect(vendorStats(rows, [5], 3).onTimePct).toBeNull();
  });
});

describe("P-03 payout expectation", () => {
  it("skips the Egyptian weekend (Friday, Saturday)", () => {
    // Thursday 2026-11-05 + 2 working days = Monday 2026-11-09.
    expect(addBusinessDays("2026-11-05T09:00:00Z", 2).toISOString().slice(0, 10)).toBe("2026-11-09");
  });
  it("an advance waits for Elba's review, with a target date, and turns late after it", () => {
    const r = { kind: "ADVANCE" as const, status: "PENDING" as const, date: "2026-11-01T08:00:00Z" };
    const e = payoutExpectation(r, { acceptedAt: "2026-11-01T08:00:00Z" }, new Date("2026-11-02T08:00:00Z"));
    expect(e.stage).toBe("ELBA_REVIEW");
    expect(e.expectedBy?.slice(0, 10)).toBe("2026-11-03");
    expect(e.late).toBe(false);
    expect(payoutExpectation(r, { acceptedAt: "2026-11-01T08:00:00Z" }, new Date("2026-11-08T08:00:00Z")).late).toBe(true);
  });
  it("a balance before delivery has no date; paid rows are never late", () => {
    expect(payoutExpectation({ kind: "BALANCE", status: "SCHEDULED", date: null }, {})).toEqual({ stage: "AFTER_DELIVERY", expectedBy: null, late: false });
    expect(payoutExpectation({ kind: "ADVANCE", status: "PAID", date: "2026-01-01" }, { acceptedAt: "2025-01-01" }).stage).toBe("PAID");
    expect(payoutExpectation({ kind: "BALANCE", status: "APPROVED", date: null }, { deliveredAt: "2026-11-01" }, new Date("2026-11-02")).stage).toBe("ON_ITS_WAY");
  });
});

describe("P-05 reply deadline", () => {
  it("is 24 hours after payment, only while the job waits for a reply", () => {
    const job = { status: "PAID", paidAt: "2026-11-07T10:00:00Z", events: [], qcPhotos: [] };
    expect(replyBy(job)).toBe("2026-11-08T10:00:00.000Z");
    expect(replyBy({ ...job, status: "ACCEPTED" })).toBeNull();
    expect(replyBy({ ...job, events: [{ type: "VENDOR_DECLINED", createdAt: "2026-11-07T11:00:00Z" }] })).toBeNull();
  });
});
