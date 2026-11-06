import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Security review round 5 (docs/audit/security.md, R5-SEC-xx). Every test here failed on the code
 * before its fix. No database: `@/lib/db` is an in-memory stand-in per test.
 */

const h = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string; vendorId: string | null; phone: string } },
  order: null as null | Record<string, unknown>,
  design: null as null | { ownerId: string | null; shareToken: string | null },
  updates: [] as unknown[],
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => undefined }), headers: async () => new Headers() }));
vi.mock("@/lib/auth/session", () => ({
  getSession: async () => h.session,
  apiRequireRole: async () => (h.session ? h.session.user : Response.json({ error: "UNAUTHENTICATED" }, { status: 401 })),
}));
vi.mock("@/lib/auth", () => ({
  apiRequireRole: async () => (h.session ? h.session.user : Response.json({ error: "UNAUTHENTICATED" }, { status: 401 })),
}));
vi.mock("@/lib/db", () => ({
  db: {
    order: { findFirst: async () => h.order },
    design: {
      findUnique: async () => h.design,
      updateMany: async (a: unknown) => (h.updates.push(a), { count: 1 }),
    },
    user: { findUnique: async () => null },
    dataRequest: { findMany: async () => [], create: async () => ({}) },
  },
}));

import { canViewBuyerOrder, canViewOrder } from "@/lib/orders/state";
import { getOrderForViewer } from "@/lib/orders/service";
import { scrubAuditSnapshot, scrubErasedUserTraces, scrubQuoteLines, type ErasureClient } from "@/lib/auth/erasure";
import { buildDataExport } from "@/components/store/account-logic";
import { devPagesEnabled } from "@/lib/env";
import { GET as exportGet } from "@/app/[locale]/(store)/account/export/route";
import { DELETE as unshare } from "@/app/api/designs/[id]/share/route";
import { POST as whatsappPost } from "@/app/api/webhooks/whatsapp/route";

const BUYER = { id: "buyer_1", role: "BUYER", vendorId: null, phone: "+201000000002" };
const STAFF = { id: "staff_1", role: "VENDOR", vendorId: "vendor_1", phone: "+201000000010" };
const ADMIN = { id: "admin_1", role: "ADMIN", vendorId: null, phone: "+201000000001" };

beforeEach(() => {
  h.session = null;
  h.order = null;
  h.design = null;
  h.updates = [];
});

describe("R5-SEC-01 buyer-side order pages are the buyer's and admin's only", () => {
  const paidJob = { id: "o1", number: "ELB-26001", buyerId: BUYER.id, vendorId: "vendor_1", paidAt: new Date() };

  it("vendor staff of the job keep the production files but not the buyer pages", () => {
    expect(canViewOrder(paidJob, STAFF as never)).toBe(true); // proof / dieline / print PDF
    expect(canViewBuyerOrder(paidJob, STAFF as never)).toBe(false);
    expect(canViewBuyerOrder(paidJob, BUYER as never)).toBe(true);
    expect(canViewBuyerOrder(paidJob, ADMIN as never)).toBe(true);
    expect(canViewBuyerOrder(paidJob, { id: "buyer_2", role: "BUYER" })).toBe(false);
  });

  it("getOrderForViewer (order page, receipt, pay page) returns nothing to the job's vendor staff", async () => {
    h.order = paidJob;
    expect(await getOrderForViewer("o1", STAFF as never)).toBeNull();
    expect(await getOrderForViewer("o1", BUYER as never)).toEqual(paidJob);
    expect(await getOrderForViewer("o1", ADMIN as never)).toEqual(paidJob);
  });
});

describe("R5-SEC-02 erasure scrubs the user's phone, IP and notes outside their own rows", () => {
  it("pure scrubbers keep the product spec and drop personal fields", () => {
    const after = { designId: null, quantity: 500, note: "Call 01055500001, Villa 3", phone: "+201055500001", spec: { name: "Shipping box", modelCode: "FEFCO_0201" } };
    expect(scrubAuditSnapshot(after)).toEqual({ designId: null, quantity: 500, spec: { name: "Shipping box", modelCode: "FEFCO_0201" } });
    expect(scrubAuditSnapshot(null)).toBeNull();
    const lines = [{ type: "CATALOGUE_REQUEST", modelCode: "FEFCO_0201", name: { en: "Shipping box" }, quantity: 500, notes: "Villa 3 Street 9 Maadi" }];
    expect(scrubQuoteLines(lines)).toEqual([{ type: "CATALOGUE_REQUEST", modelCode: "FEFCO_0201", name: { en: "Shipping box" }, quantity: 500 }]);
  });

  it("scrubErasedUserTraces rewrites audit rows, quotes and privacy requests of that user", async () => {
    const audits = [{ id: "a1", actorId: "u1", actorPhone: "+201055500001", ip: "127.0.0.1", before: null, after: { note: "x", phone: "+201055500001", quantity: 1 } as Record<string, unknown> | null }];
    const quotes = [{ id: "q1", userId: "u1", lines: [{ quantity: 1, notes: "my address" }] as unknown }];
    const requests = [{ userId: "u1", ip: "127.0.0.1" as string | null }];
    const tx = {
      auditLog: {
        findMany: async ({ where }: { where: { actorId: string } }) => audits.filter((a) => a.actorId === where.actorId),
        update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => Object.assign(audits.find((a) => a.id === where.id)!, data),
      },
      quote: {
        findMany: async ({ where }: { where: { userId: string } }) => quotes.filter((q) => q.userId === where.userId),
        update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => Object.assign(quotes.find((q) => q.id === where.id)!, data),
      },
      dataRequest: {
        updateMany: async ({ where, data }: { where: { userId: string }; data: { ip: null } }) => {
          const rows = requests.filter((r) => r.userId === where.userId);
          rows.forEach((r) => Object.assign(r, data));
          return { count: rows.length };
        },
      },
    } as unknown as ErasureClient;
    expect(await scrubErasedUserTraces(tx, "u1")).toEqual({ audit: 1, quotes: 1, requests: 1 });
    const dump = JSON.stringify({ audits, quotes, requests });
    expect(dump).not.toContain("+201055500001");
    expect(dump).not.toContain("127.0.0.1");
    expect(dump).not.toContain("my address");
    expect(audits[0].after).toEqual({ quantity: 1 });
  });
});

describe("R5-SEC-03 the self-service export carries every category of the user's data", () => {
  it("includes price requests with the buyer's notes, disputes and signed-in devices, never vendor costs", () => {
    const d = new Date("2026-11-06T10:00:00Z");
    const doc = buildDataExport(
      {
        user: { id: "u", phone: "+201", name: null, email: null, role: "BUYER", locale: "en", marketingConsent: false, createdAt: d },
        consents: [],
        designs: [],
        orders: [],
        reviews: [],
        requests: [],
        quotes: [{ status: "REQUESTED", lines: [{ type: "CATALOGUE_REQUEST", quantity: 700, notes: "my private note", vendorCostPiasters: 999 }], totalPiasters: 0, validUntil: d, createdAt: d }],
        disputes: [{ reason: "LATE", description: "late again", status: "OPEN", resolution: null, createdAt: d }],
        sessions: [{ ip: "198.51.100.7", userAgent: "UA", createdAt: d, expiresAt: d }],
      },
      d,
    );
    const json = JSON.stringify(doc);
    expect(json).toContain("my private note");
    expect(json).toContain("late again");
    expect(json).toContain("198.51.100.7");
    expect(json).not.toContain("vendorCostPiasters");
  });
});

describe("R5-SEC-04 developer pages are off in a deployment", () => {
  it("only next dev, ELBA_DEV_PAGES=1 or the e2e marker turn them on", () => {
    expect(devPagesEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(devPagesEnabled({ NODE_ENV: "production", ELBA_DEV_PAGES: "1" })).toBe(true);
    expect(devPagesEnabled({ NODE_ENV: "production", ELBA_E2E: "1" })).toBe(true);
    expect(devPagesEnabled({ NODE_ENV: "development" })).toBe(true);
  });
});

describe("R5-SEC-07 the export download refuses cross-site navigations", () => {
  it("403 for Sec-Fetch-Site cross-site, before it writes a DataRequest", async () => {
    h.session = { user: BUYER };
    const r = await exportGet(new Request("http://localhost/en/account/export", { headers: { "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate" } }));
    expect(r.status).toBe(403);
  });
});

describe("R5-SEC-08 the owner can turn a share link off", () => {
  const req = (headers: Record<string, string> = {}) => new Request("http://localhost/api/designs/d1/share", { method: "DELETE", headers: { "sec-fetch-site": "same-origin", ...headers } });
  const ctx = { params: Promise.resolve({ id: "d1" }) };

  it("owner: token cleared", async () => {
    h.session = { user: BUYER };
    h.design = { ownerId: BUYER.id, shareToken: "tok_abcdefgh" };
    const r = await unshare(req(), ctx);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, revoked: true });
    expect(h.updates).toEqual([{ where: { id: "d1", ownerId: BUYER.id }, data: { shareToken: null } }]);
  });

  it("someone else's design: 404 and nothing changes; anonymous 401; cross-site 403", async () => {
    h.design = { ownerId: "buyer_2", shareToken: "tok_abcdefgh" };
    h.session = { user: BUYER };
    expect((await unshare(req(), ctx)).status).toBe(404);
    h.session = null;
    expect((await unshare(req(), ctx)).status).toBe(401);
    h.session = { user: BUYER };
    expect((await unshare(req({ "sec-fetch-site": "cross-site" }), ctx)).status).toBe(403);
    expect(h.updates).toEqual([]);
  });
});

describe("R5-SEC-06 the WhatsApp webhook stops reading an oversized body", () => {
  it("413 without draining a chunked body that has no Content-Length", async () => {
    vi.stubEnv("WHATSAPP_APP_SECRET", "test-secret-value");
    let pulled = 0;
    const total = 400; // 400 x 4 KB = 1.6 MB, cap is 256 KB
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        if (pulled >= total) return c.close();
        pulled++;
        c.enqueue(new Uint8Array(4096).fill(0x61));
      },
    });
    const r = await whatsappPost(new Request("http://localhost/api/webhooks/whatsapp", { method: "POST", body, duplex: "half" } as RequestInit));
    expect(r.status).toBe(413);
    expect(pulled).toBeLessThan(total / 2);
    vi.unstubAllEnvs();
  });
});
