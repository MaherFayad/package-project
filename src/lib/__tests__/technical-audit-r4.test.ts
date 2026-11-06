import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { vendorMoveAllowed } from "@/lib/orders/api-rules";
import { claimSampleCredit, sampleCreditInUse, type SampleCreditClient } from "@/lib/orders/sample-credit";

vi.mock("server-only", () => ({}));
const purged = vi.hoisted(() => ({ tags: [] as string[], paths: [] as string[], throwOutside: true }));
vi.mock("next/cache", () => ({
  revalidateTag: (t: string) => {
    if (purged.throwOutside) throw new Error("Invariant: static generation store missing in revalidateTag catalog");
    purged.tags.push(t);
  },
  revalidatePath: (p: string, type?: string) => {
    purged.paths.push(`${p}|${type}`);
  },
}));

/** Technical audit round 4 (docs/audit/technical.md, R4-xx). */

/** In-memory stand-in for the order table, with Postgres-like conditional updates. */
function fakeOrders(rows: { id: string; number: string; status: string; updatedAt: Date; notes: string[] }[]) {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const client: SampleCreditClient = {
    order: {
      count: async ({ where }) => rows.filter((r) => where.number.in.includes(r.number) && !where.status.notIn.includes(r.status)).length,
      findUnique: async ({ where }) => {
        const r = byId.get(where.id);
        return r ? { status: r.status, updatedAt: r.updatedAt, productionEvents: r.notes.filter((n) => n.startsWith("SAMPLE_CREDITED:")).map((note) => ({ note })) } : null;
      },
      updateMany: async ({ where, data }) => {
        const r = byId.get(where.id);
        if (!r || r.updatedAt.getTime() !== where.updatedAt.getTime()) return { count: 0 };
        r.updatedAt = data.updatedAt;
        return { count: 1 };
      },
    },
  };
  return { client, rows };
}

describe("R4-02 a sample credit is claimed once, inside the order transaction (ASVS V11.1.6)", () => {
  const t0 = new Date("2026-11-01T10:00:00Z");
  it("the first claim wins; a concurrent claim that read the same row version loses", async () => {
    const { client } = fakeOrders([{ id: "s1", number: "ELB-26302", status: "PAID", updatedAt: t0, notes: [] }]);
    // Both transactions read the sample before either writes (the race seen live: 1 credit on 3 orders).
    const readA = await client.order.findUnique({ where: { id: "s1" }, select: {} as never });
    const readB = await client.order.findUnique({ where: { id: "s1" }, select: {} as never });
    expect(readA?.updatedAt).toEqual(readB?.updatedAt);
    const a = await client.order.updateMany({ where: { id: "s1", updatedAt: readA!.updatedAt }, data: { updatedAt: new Date(t0.getTime() + 5) } });
    const b = await client.order.updateMany({ where: { id: "s1", updatedAt: readB!.updatedAt }, data: { updatedAt: new Date(t0.getTime() + 6) } });
    expect([a.count, b.count]).toEqual([1, 0]);
  });
  it("claimSampleCredit refuses a credit already used by a live order, frees it when that order is cancelled", async () => {
    const { client, rows } = fakeOrders([
      { id: "s1", number: "ELB-26302", status: "PAID", updatedAt: t0, notes: ["SAMPLE_CREDITED:ELB-26303"] },
      { id: "o1", number: "ELB-26303", status: "PENDING_PAYMENT", updatedAt: t0, notes: [] },
    ]);
    expect(await claimSampleCredit(client, "s1", new Date())).toBe(false);
    rows[1]!.status = "CANCELLED";
    expect(await claimSampleCredit(client, "s1", new Date(t0.getTime() + 10))).toBe(true);
  });
  it("serialised writers (SQLite): the second claim sees the first order and fails", async () => {
    const { client, rows } = fakeOrders([{ id: "s1", number: "ELB-26302", status: "DELIVERED", updatedAt: t0, notes: [] }]);
    expect(await claimSampleCredit(client, "s1", new Date(t0.getTime() + 1))).toBe(true);
    // what createOrderFromOffer writes in the same transaction
    rows.push({ id: "o1", number: "ELB-26303", status: "PENDING_PAYMENT", updatedAt: t0, notes: [] });
    rows[0]!.notes.push("SAMPLE_CREDITED:ELB-26303");
    expect(await claimSampleCredit(client, "s1", new Date(t0.getTime() + 2))).toBe(false);
  });
  it("no credit from a sample that is unpaid, cancelled, refunded or missing", async () => {
    for (const status of ["PENDING_PAYMENT", "CANCELLED", "REFUNDED"]) {
      const { client } = fakeOrders([{ id: "s1", number: "ELB-1", status, updatedAt: t0, notes: [] }]);
      expect(await claimSampleCredit(client, "s1", new Date())).toBe(false);
    }
    const { client } = fakeOrders([]);
    expect(await claimSampleCredit(client, "nope", new Date())).toBe(false);
    expect(await sampleCreditInUse(client, [])).toBe(false);
  });
  it("service.ts claims the credit inside the transaction and fails with QUOTE_EXPIRED", () => {
    const src = readFileSync(path.resolve(__dirname, "../orders/service.ts"), "utf8");
    const tx = src.indexOf("db.$transaction(async (tx) => {", src.indexOf("async function createOrderFromOffer"));
    const claim = src.indexOf("claimSampleCredit(tx", tx);
    expect(tx).toBeGreaterThan(0);
    expect(claim).toBeGreaterThan(tx);
    expect(claim - tx).toBeLessThan(400); // first statement of the transaction
    expect(src.slice(claim, claim + 200)).toContain('OrderError("QUOTE_EXPIRED")');
  });
});

describe("R4-01 admin refund claims each payment before calling the gateway (ASVS V11.1.6)", () => {
  const src = readFileSync(path.resolve(__dirname, "../../components/admin/server/actions.ts"), "utf8");
  const fn = src.slice(src.indexOf("async function refundOrderInternal"), src.indexOf("export async function refundOrderAction"));
  it("conditional PAID → REFUNDED claim comes before provider.refund, and a lost claim skips the call", () => {
    const claim = fn.indexOf('updateMany({ where: { id: p.id, status: "PAID" }, data: { status: "REFUNDED" } })');
    expect(claim).toBeGreaterThan(0);
    expect(fn.indexOf("provider.refund(")).toBeGreaterThan(claim);
    expect(fn.slice(claim, fn.indexOf("provider.refund("))).toContain("if (claim.count !== 1) continue;");
  });
  it("a declined refund releases the claim; nothing claimed means STALE, not a second REFUNDED move", () => {
    expect(fn).toContain('updateMany({ where: { id: p.id, status: "REFUNDED" }, data: { status: "PAID" } })');
    expect(fn).toContain('if (paid.length && !refs.length) throw new AdminActionError("STALE")');
    expect(fn).toContain("REFUND_UNCONFIRMED");
  });
});

describe("R4-03 vendors cannot mark an order delivered through the status API (ASVS V11.1.1)", () => {
  const job = (status: string) => ({ status, paidAt: new Date(), events: [], qcPhotos: [] });
  it("DELIVERED, CANCELLED and the admin-only QC steps are refused for vendors", () => {
    expect(vendorMoveAllowed(job("SHIPPED"), "DELIVERED")).toBe("NOT_ALLOWED");
    expect(vendorMoveAllowed(job("PAID"), "CANCELLED")).toBe("NOT_ALLOWED");
    expect(vendorMoveAllowed(job("QC_PENDING"), "READY_TO_SHIP")).toBe("NOT_ALLOWED");
  });
  it("the portal's own moves still pass", () => {
    expect(vendorMoveAllowed(job("PAID"), "ACCEPTED")).toBe("OK");
    expect(vendorMoveAllowed(job("ACCEPTED"), "IN_PRODUCTION")).toBe("OK");
    expect(vendorMoveAllowed(job("READY_TO_SHIP"), "SHIPPED")).toBe("OK");
  });
});

describe("R4-04 price edits purge the public catalogue cache", () => {
  it("purgeCatalogCache uses the store's tag and never throws outside a request", async () => {
    const { purgeCatalogCache, CATALOG_CACHE_TAG } = await import("@/lib/catalog-cache");
    expect(CATALOG_CACHE_TAG).toBe("catalog");
    expect(() => purgeCatalogCache()).not.toThrow();
    // In a request: the data-cache tag AND the ISR pages under the locale layout (built without the tag).
    purged.throwOutside = false;
    purgeCatalogCache();
    expect(purged.tags).toEqual(["catalog"]);
    expect(purged.paths).toEqual(["/[locale]|layout"]);
    const store = readFileSync(path.resolve(__dirname, "../../components/store/data.ts"), "utf8");
    expect(store).toContain('export const CATALOG_TAG = "catalog"');
  });
  it("admin margin/zones, FX index and vendor rate cards call it", () => {
    const admin = readFileSync(path.resolve(__dirname, "../../components/admin/server/actions.ts"), "utf8");
    for (const fn of ["savePricingSettingsAction", "applyIndexUpdateAction"]) {
      const body = admin.slice(admin.indexOf(`export async function ${fn}`), admin.indexOf("export async function", admin.indexOf(`export async function ${fn}`) + 10));
      expect(body).toContain("purgeCatalogCache()");
    }
    const vendor = readFileSync(path.resolve(__dirname, "../../components/vendor/server/actions.ts"), "utf8");
    const rc = vendor.slice(vendor.indexOf("export async function saveRateCard"), vendor.indexOf("export async function submitApplication"));
    expect(rc).toContain("purgeCatalogCache()");
  });
});

describe("R4-05 indexes for the new lookups", () => {
  const schema = readFileSync(path.resolve(__dirname, "../../../prisma/schema.prisma"), "utf8");
  const model = (name: string) => schema.slice(schema.indexOf(`model ${name} {`), schema.indexOf("\n}", schema.indexOf(`model ${name} {`)));
  it("quote-leads inbox and the monthly sample cap use an index", () => {
    expect(model("Quote")).toContain("@@index([status, createdAt])");
    expect(model("ProductionEvent")).toContain("@@index([note, createdAt])");
  });
});
