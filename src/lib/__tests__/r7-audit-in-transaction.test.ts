import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UNPAID_PAYOUT_STATUSES, unpaidPayouts } from "@/components/admin/lib/payouts";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/analytics/track", () => ({ track: vi.fn(async () => undefined) }));
vi.mock("@/lib/notify", () => ({ notify: vi.fn(async () => undefined) }));

/**
 * In-memory order store with a transaction that only commits when the callback resolves, like
 * Postgres/SQLite: a throw inside rolls every staged write back.
 */
const store = vi.hoisted(() => ({
  order: { id: "o1", number: "EL-1", status: "QC_PENDING", vendorId: "v1", buyerId: "b1", dueDate: null as Date | null, buyer: { id: "b1", phone: "01000000002", locale: "ar" } },
  committed: [] as string[],
}));
vi.mock("@/lib/db", () => {
  const txClient = (staged: string[], state: { status: string }) => ({
    order: {
      updateMany: async ({ where, data }: { where: { status: string }; data: { status: string } }) => {
        if (where.status !== state.status) return { count: 0 };
        state.status = data.status;
        staged.push(`order:${data.status}`);
        return { count: 1 };
      },
    },
    productionEvent: { create: async () => staged.push("event") },
    auditLog: { create: async () => staged.push("audit") },
  });
  return {
    db: {
      order: { findUnique: async () => ({ ...store.order }) },
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
        const staged: string[] = [];
        const state = { status: store.order.status };
        const out = await fn(txClient(staged, state));
        store.order.status = state.status;
        store.committed.push(...staged);
        return out;
      },
    },
  };
});

const ADMIN = { role: "ADMIN" as const, userId: "a1" };

describe("R7 transitionOrder runs the caller's writes in the same transaction (inTx)", () => {
  beforeEach(() => {
    store.order.status = "QC_PENDING";
    store.committed = [];
  });

  it("commits the status change, the event and the audit row together", async () => {
    const { transitionOrder } = await import("@/lib/orders/service");
    await transitionOrder("o1", "READY_TO_SHIP", ADMIN, undefined, { inTx: async (tx) => void (await tx.auditLog.create({ data: {} as never })) });
    expect(store.committed).toEqual(["order:READY_TO_SHIP", "event", "audit"]);
    expect(store.order.status).toBe("READY_TO_SHIP");
  });

  it("a failing audit write rolls the status change back", async () => {
    const { transitionOrder } = await import("@/lib/orders/service");
    await expect(
      transitionOrder("o1", "READY_TO_SHIP", ADMIN, undefined, {
        inTx: async () => {
          throw new Error("audit insert failed");
        },
      }),
    ).rejects.toThrow("audit insert failed");
    expect(store.committed).toEqual([]);
    expect(store.order.status).toBe("QC_PENDING");
  });
});

/** Balanced-paren argument text of every `audit(` call in a source file. */
function auditCalls(src: string): { at: number; args: string }[] {
  const out: { at: number; args: string }[] = [];
  const re = /\baudit\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (src.slice(Math.max(0, m.index - 16), m.index).includes("function ")) continue;
    let depth = 1;
    let i = m.index + m[0].length;
    for (; i < src.length && depth; i++) depth += src[i] === "(" ? 1 : src[i] === ")" ? -1 : 0;
    out.push({ at: m.index, args: src.slice(m.index + m[0].length, i - 1) });
  }
  return out;
}

describe("R7 every admin audit row is written in the transaction of its change", () => {
  const src = readFileSync(path.resolve(__dirname, "../../components/admin/server/actions.ts"), "utf8");
  // The internal note is the only action whose audit row IS the change (nothing else is written).
  const auditOnly = ['action: "ORDER_NOTE"'];

  it("passes the transaction client to audit() everywhere else", () => {
    const calls = auditCalls(src);
    expect(calls.length).toBeGreaterThan(20);
    const outside = calls.filter((c) => !/,\s*tx\s*,?\s*$/.test(c.args) && !auditOnly.some((a) => c.args.includes(a)));
    expect(outside.map((c) => c.args.slice(0, 80))).toEqual([]);
  });

  it("the QC review, refund and ship actions audit inside the order service transaction", () => {
    const body = (name: string) => src.slice(src.indexOf(name), src.indexOf("\nexport async function", src.indexOf(name) + 10));
    expect(body("async function refundOrderInternal")).toContain("inTx: async (tx)");
    expect(body("export async function reviewQcAction")).toContain("inTx: async (tx)");
    expect(body("export async function shipOrderAction")).toContain("inTx: (tx, tracking)");
    const service = readFileSync(path.resolve(__dirname, "../orders/service.ts"), "utf8");
    expect(service).toContain("if (opts.inTx) await opts.inTx(tx);");
    expect(service).toContain("if (opts.inTx) await opts.inTx(tx, created.trackingNumber);");
  });
});

describe("R7 a refund voids every payout that can no longer be paid", () => {
  it("unpaid means PENDING and APPROVED; PAID rows stay", () => {
    expect([...UNPAID_PAYOUT_STATUSES]).toEqual(["PENDING", "APPROVED"]);
    const rows = [
      { id: "a", status: "PENDING" },
      { id: "b", status: "APPROVED" },
      { id: "c", status: "PAID" },
    ];
    expect(unpaidPayouts(rows).map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("refundOrderInternal removes APPROVED rows too and keeps them in the audit entry", () => {
    const src = readFileSync(path.resolve(__dirname, "../../components/admin/server/actions.ts"), "utf8");
    const fn = src.slice(src.indexOf("async function refundOrderInternal"), src.indexOf("export async function refundOrderAction"));
    expect(fn).toContain("status: { in: [...UNPAID_PAYOUT_STATUSES] }");
    expect(fn).not.toContain('status: "PENDING" } });');
    expect(fn).toContain("unpaidPayouts: voided");
  });
});
