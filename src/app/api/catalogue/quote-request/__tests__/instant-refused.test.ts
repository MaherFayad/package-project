import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ apiRequireRole: async () => ({ id: "u1", phone: "01000000002", role: "BUYER" }) }));
const quoteCreate = vi.fn(async () => ({ id: "q1" }));
vi.mock("@/lib/db", () => ({
  db: {
    quote: { findMany: async () => [] },
    $transaction: async (fn: (tx: unknown) => unknown) => fn({ quote: { create: quoteCreate }, auditLog: { create: async () => ({}) } }),
  },
}));
const modes = new Map<string, { mode: string }>();
vi.mock("@/components/catalogue/server", () => ({ getCatalogueData: async () => ({ modes }) }));

const CODE = "FEFCO_0200";
const post = async () => {
  const { POST } = await import("../route");
  return POST(new Request("http://localhost/api/catalogue/quote-request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: CODE, quantity: 1000 }) }));
};

describe("POST /api/catalogue/quote-request (R7 fix: instant models refused)", () => {
  beforeEach(() => {
    modes.clear();
    quoteCreate.mockClear();
  });

  it("answers 409 INSTANT_PRICE for a model with an instant price, and stores nothing", async () => {
    modes.set(CODE, { mode: "instant" });
    const res = await post();
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "INSTANT_PRICE" });
    expect(quoteCreate).not.toHaveBeenCalled();
  });

  it("still creates the request for a quote-only model (and when the mode is unknown)", async () => {
    modes.set(CODE, { mode: "quote" });
    expect((await post()).status).toBe(201);
    modes.clear();
    vi.resetModules();
    expect((await post()).status).toBe(201);
  });
});
