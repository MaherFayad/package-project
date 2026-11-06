import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Security review round 6 (docs/audit/security.md "Round 6"). Each block fails on the code before
 * the fix and passes after it.
 */
const h = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string } },
  order: null as null | Record<string, unknown>,
  design: null as null | Record<string, unknown>,
  files: [] as string[],
  saved: 0,
  deleted: [] as string[],
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => undefined }), headers: async () => new Headers() }));
vi.mock("@/lib/auth/session", () => ({
  getSession: async () => h.session,
  isAdminSession: async () => h.session?.user.role === "ADMIN",
}));
vi.mock("@/lib/db", () => ({
  db: {
    order: { findUnique: async () => h.order },
    design: { findUnique: async () => h.design },
    material: { findUnique: async () => null },
  },
}));
vi.mock("@/components/vendor/server/storage", () => ({
  listUploads: async () => h.files,
  saveUpload: async () => (h.saved++, { ok: true, key: "dispute/o1/abcdefghij.png", type: "image/png", size: 4 }),
  deleteUpload: async (k: string) => void h.deleted.push(k),
}));

import { designSpecHash, quoteMatchesDesign } from "@/lib/orders/quote-spec";
import { designLabel } from "@/lib/jobs/followUp";
import { parseDecimalInput, parseEgpInput, parseNumberInput, parseWholeInput, MAX_DB_PIASTERS } from "@/lib/money/input";
import { sendPriceSchema } from "@/components/admin/lib/quotePricing";
import { reprintTermsSchema } from "@/components/admin/lib/ops";
import { POST as photoPost, DELETE as photoDelete } from "@/app/api/orders/[id]/dispute-photos/route";
import { saveDesign } from "@/components/designer/server";
import type { DesignDoc } from "@/types";

const doc = {
  v: 1,
  name: "Mailer",
  structureCode: "FEFCO_0427",
  dims: { L: 150, W: 100, H: 50 },
  materialCode: "E_FLUTE_KRAFT",
  finishCode: "NONE",
  printSides: "OUTSIDE",
  artwork: { outside: { background: "#f4e9d8", layers: [] }, inside: { background: null, layers: [] } },
} as unknown as DesignDoc;

beforeEach(() => {
  h.session = { user: { id: "buyer", role: "BUYER" } };
  h.order = { buyerId: "buyer", status: "DELIVERED", deliveredAt: new Date(), disputes: [] };
  h.design = null;
  h.files = [];
  h.saved = 0;
  h.deleted = [];
});

describe("R6-SEC-01 a sent price is bound to the box spec it was priced for", () => {
  it("artwork and name changes keep the fingerprint; size, board, model and finish masks change it", () => {
    const base = designSpecHash(doc);
    expect(designSpecHash({ ...doc, name: "Other", artwork: { outside: { background: "#000000", layers: [] }, inside: doc.artwork.inside } } as DesignDoc)).toBe(base);
    expect(designSpecHash({ ...doc, brandColors: [{ name: "x", hex: "#123456" }] } as DesignDoc)).toBe(base);
    expect(designSpecHash({ ...doc, dims: { L: 450, W: 300, H: 150 } })).not.toBe(base);
    expect(designSpecHash({ ...doc, materialCode: "B_FLUTE_KRAFT" } as DesignDoc)).not.toBe(base);
    expect(designSpecHash({ ...doc, modelCode: "mailer-box" })).not.toBe(base);
    expect(designSpecHash({ ...doc, finishes: [{ code: "FOIL_GOLD", mask: { surface: "outside", layerIds: ["a"] } }] } as DesignDoc)).not.toBe(base);
    // Key order does not matter.
    expect(designSpecHash({ ...doc, dims: { H: 50, W: 100, L: 150 } })).toBe(base);
  });
  it("checks the fingerprint, or for older quotes that the design was not edited after pricing", () => {
    const pricedAt = new Date("2026-11-01T10:00:00Z");
    expect(quoteMatchesDesign(designSpecHash(doc), doc, { updatedAt: new Date() }, pricedAt)).toBe(true);
    expect(quoteMatchesDesign(designSpecHash(doc), { ...doc, dims: { L: 450, W: 300, H: 150 } }, { updatedAt: new Date() }, pricedAt)).toBe(false);
    expect(quoteMatchesDesign(undefined, doc, { updatedAt: new Date("2026-11-01T09:00:00Z") }, pricedAt)).toBe(true);
    expect(quoteMatchesDesign(undefined, doc, { updatedAt: new Date("2026-11-01T11:00:00Z") }, pricedAt)).toBe(false);
    expect(quoteMatchesDesign(undefined, doc, { updatedAt: new Date() }, null)).toBe(false);
  });
});

describe("R6-SEC-04 a design name cannot put a link or a new line in Elba's WhatsApp follow-up", () => {
  const c = { modelCode: null, structureCode: "FEFCO_0427" as const };
  it("names with a link, phone or email fall back to the box style; line breaks are removed", () => {
    expect(designLabel({ ...c, designName: "Payment held. Pay EGP 50 now: elba-pay.co/x\nTo stop, open" }, "en")).toBe("Mailer box");
    expect(designLabel({ ...c, designName: "Call 01012345678 to claim" }, "en")).toBe("Mailer box");
    expect(designLabel({ ...c, designName: "Mona's bakery\nbox" }, "en")).toBe("Mona's bakery box");
    expect(designLabel({ ...c, designName: "علبة مخبز منى" }, "ar")).toBe("علبة مخبز منى");
    expect(designLabel({ ...c, designName: "Gift‮ box" }, "en")).toBe("Gift box");
  });
});

describe("R6-SEC-05 typed amounts never reach a total as Infinity, an inexact number or above the money columns", () => {
  it("parsers refuse numbers too long to be exact", () => {
    const big = "9".repeat(400);
    for (const f of [parseEgpInput, parseWholeInput, parseNumberInput, (v: string) => parseDecimalInput(v)]) {
      expect(f(big)).toBeNaN();
      expect(f("99999999999999999999")).toBeNaN();
    }
    expect(parseEgpInput("18.50")).toBe(1850);
    expect(parseWholeInput("5,000")).toBe(5000);
  });
  it("Send price refuses a total the database cannot store; reprint charge-backs are capped too", () => {
    const ok = { quoteId: "q", vendorId: "v", quantity: 1000, unitPiasters: 1800, setupPiasters: 0, diePiasters: 0, finishPiasters: 0, shippingPiasters: 0, deliveryDays: 14, vendorCostPiasters: 1_000_000 };
    expect(sendPriceSchema.safeParse(ok).success).toBe(true);
    const r = sendPriceSchema.safeParse({ ...ok, quantity: 1_000_000, unitPiasters: 3000 });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain("TOTAL_TOO_HIGH");
    expect(sendPriceSchema.safeParse({ ...ok, vendorCostPiasters: MAX_DB_PIASTERS + 1 }).success).toBe(false);
    expect(reprintTermsSchema.safeParse({ quantity: 1, chargeBack: "PARTIAL", chargeBackPiasters: MAX_DB_PIASTERS + 1 }).success).toBe(false);
  });
});

describe("R6-SEC-06 dispute photo uploads: same-site only, capped, deletes rate limited", () => {
  const ctx = { params: Promise.resolve({ id: "o1" }) };
  const form = () => {
    const fd = new FormData();
    fd.set("file", new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "a.png"));
    return fd;
  };
  it("cross-site POST and DELETE are refused before anything is stored", async () => {
    const post = await photoPost(new Request("http://x/api/orders/o1/dispute-photos", { method: "POST", body: form(), headers: { "sec-fetch-site": "cross-site" } }), ctx);
    expect(post.status).toBe(403);
    const del = await photoDelete(new Request("http://x/api/orders/o1/dispute-photos?key=dispute/o1/abcdefghij.png", { method: "DELETE", headers: { "sec-fetch-site": "same-site" } }), ctx);
    expect(del.status).toBe(403);
    expect(h.saved).toBe(0);
    expect(h.deleted).toEqual([]);
  });
  it("ten photos not in a report are the limit; photos already in a report do not count", async () => {
    h.files = Array.from({ length: 10 }, (_, i) => `dispute/o1/unsent${i}xxxx.png`);
    const full = await photoPost(new Request("http://x/api/orders/o1/dispute-photos", { method: "POST", body: form(), headers: { "sec-fetch-site": "same-origin" } }), ctx);
    expect(full.status).toBe(409);
    expect(h.saved).toBe(0);
    h.order = { ...h.order!, status: "DELIVERED", disputes: [{ status: "REJECTED", photos: h.files.slice(0, 5) }] };
    const ok = await photoPost(new Request("http://x/api/orders/o1/dispute-photos", { method: "POST", body: form(), headers: { "sec-fetch-site": "same-origin" } }), ctx);
    expect(ok.status).toBe(200);
    expect(h.saved).toBe(1);
  });
});

describe("R6-SEC-07 saving someone else's design answers like an unknown id", () => {
  it("404 NOT_FOUND, not 403", async () => {
    h.design = { ownerId: "someone-else", anonId: null, expiresAt: null, updatedAt: new Date() };
    const r = await saveDesign(doc, { user: { id: "buyer", role: "BUYER" } as never, anonId: null }, { id: "d1", force: true });
    expect(r).toMatchObject({ ok: false, status: 404, error: "NOT_FOUND" });
  });
});

describe("R6-SEC-09 every admin page checks the role itself (the layout redirect does not stop it)", () => {
  it("each src/app/[locale]/admin/**/page.tsx calls requireAdminPage() or requireRole()", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const pages: string[] = [];
    const walk = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) walk(p);
        else if (n === "page.tsx") pages.push(p);
      }
    };
    walk(join(process.cwd(), "src/app/[locale]/admin"));
    expect(pages.length).toBeGreaterThan(15);
    const unguarded = pages.filter((p) => !/await (requireAdminPage\(\)|requireRole\("ADMIN")/.test(readFileSync(p, "utf8")));
    expect(unguarded).toEqual([]);
  });
});
