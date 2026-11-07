import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { Prisma } from "@prisma/client";
import { createClient } from "../../src/lib/db";
import { createHash, randomBytes, randomInt } from "node:crypto";
import path from "node:path";

/**
 * Test data factory: every test gets its OWN users and orders, so specs can run in parallel
 * (`--workers=2` and up) without two workers touching the same rows.
 *
 * - Phones are random, unique per run, and checked against the database. The OTP rate limits are
 *   keyed per phone (1 per 30 s, 5 per hour), so a fresh phone per test never trips them.
 * - Orders are cloned from a seeded template order (items, proof, timeline, QC photos, payment)
 *   under a unique `ELB-E2E-…` number, outside the real `ELB-26nnn` sequence, and are deleted
 *   again by `cleanup()`.
 * - Sign-in for non-OTP tests inserts a session row with the same hashing as src/lib/auth.
 */
const dbUrl = process.env.ELBA_DATABASE_URL ?? `file:${path.resolve(__dirname, "../../prisma/dev.db")}`;
export const db = createClient(dbUrl, { sqliteSingleWriter: false });

/** Seeded staff and admin accounts (read-only use: never mutate their orders in a test). */
export const SEEDED = {
  admin: "+201000000001",
  buyer: "+201000000002",
  nileStaff: "+201000000010",
  deltaStaff: "+201000000011",
} as const;

let counter = 0;
const usedPhones = new Set<string>();

/** Worker index of the running test (0 outside a test, e.g. in global setup). */
function workerIndex(): number {
  try {
    return test.info().parallelIndex;
  } catch {
    return Number(process.env.TEST_PARALLEL_INDEX ?? 0);
  }
}

/**
 * A fresh Egyptian mobile number nobody has used: E.164 (`+2015…`) and the local form (`015…`).
 * Digits: worker index, a per-process counter and random digits, so two workers starting in the
 * same millisecond still differ (the old `Date.now() % 1e8` phones collided across workers).
 */
export async function uniquePhone(prefix: "10" | "11" | "12" | "15" = "15"): Promise<{ e164: string; local: string }> {
  for (;;) {
    counter = (counter + 1) % 100;
    const digits = `${workerIndex() % 10}${String(counter).padStart(2, "0")}${String(randomInt(0, 100_000)).padStart(5, "0")}`;
    const e164 = `+20${prefix}${digits}`;
    if (usedPhones.has(e164)) continue;
    const taken = (await db.user.count({ where: { phone: e164 } })) + (await db.otpCode.count({ where: { phone: e164 } }));
    if (taken) continue;
    usedPhones.add(e164);
    return { e164, local: `0${prefix}${digits}` };
  }
}

export type Role = "BUYER" | "VENDOR" | "ADMIN";

/** A new user with a unique phone. Vendor staff need `vendorId` (an existing, seeded vendor). */
export async function createUser(opts: { role?: Role; vendorId?: string; name?: string } = {}) {
  const { e164 } = await uniquePhone();
  return db.user.create({
    data: { phone: e164, role: opts.role ?? "BUYER", vendorId: opts.vendorId ?? null, name: opts.name ?? "E2E User", locale: "en" },
  });
}

/**
 * Open the designer with "All options" (tabs, face/dieline views, fold, board, finishes) instead of
 * the Basics panel new visitors get (docs/audit/simplicity-2026-11/designer.md). The editor reads
 * `localStorage["elba.designer.mode"]` on mount; set it before every page of this context loads.
 */
export async function designerAllOptions(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    try {
      window.localStorage.setItem("elba.designer.mode", "advanced");
    } catch {
      /* storage blocked (about:blank): the designer page sets it on its own origin */
    }
  });
}

/** Sign a browser context in as `userId` (session row + cookie). */
export async function signInAs(context: BrowserContext, baseURL: string, userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  await db.session.create({ data: { tokenHash: createHash("sha256").update(token).digest("hex"), userId, expiresAt: new Date(Date.now() + 3600_000) } });
  await context.addCookies([{ name: "elba_session", value: token, url: baseURL }]);
}

/** Sign in as a seeded account (for read-only checks on seeded data). */
export async function signInPhone(context: BrowserContext, baseURL: string, phone: string): Promise<void> {
  const user = await db.user.findUniqueOrThrow({ where: { phone } });
  await signInAs(context, baseURL, user.id);
}

const json = (v: Prisma.JsonValue | null): Prisma.InputJsonValue | typeof Prisma.JsonNull => (v === null ? Prisma.JsonNull : (v as Prisma.InputJsonValue));

/**
 * Clone a seeded order into a new, private one: same vendor, items, proof and money, with its own
 * number, buyer, timeline, QC photos and payment. `status` sets where the job starts.
 */
export async function cloneOrder(
  template: string,
  opts: { status: string; buyerId?: string; withQcPhotos?: boolean; label?: string },
): Promise<{ id: string; number: string; vendorId: string }> {
  const t = await db.order.findUniqueOrThrow({
    where: { number: template },
    include: { items: true, productionEvents: true, qcPhotos: true, payments: true },
  });
  const number = `ELB-E2E-${opts.label ?? "J"}${workerIndex()}${randomBytes(4).toString("hex").toUpperCase()}`;
  const now = new Date();
  const paid = !["PENDING_PAYMENT", "CANCELLED"].includes(opts.status);
  const order = await db.order.create({
    data: {
      number,
      buyerId: opts.buyerId ?? t.buyerId,
      vendorId: t.vendorId,
      status: opts.status,
      subtotalPiasters: t.subtotalPiasters,
      vatPiasters: t.vatPiasters,
      shippingPiasters: t.shippingPiasters,
      totalPiasters: t.totalPiasters,
      vendorCostPiasters: t.vendorCostPiasters,
      currency: t.currency,
      shippingAddress: json(t.shippingAddress) as Prisma.InputJsonValue,
      placedAt: now,
      paidAt: paid ? now : null,
      dueDate: t.dueDate ? new Date(now.getTime() + 7 * 86_400_000) : null,
      items: {
        create: t.items.map((i) => ({
          proofId: i.proofId,
          structureCode: i.structureCode,
          modelCode: i.modelCode,
          config: json(i.config),
          dims: json(i.dims) as Prisma.InputJsonValue,
          materialCode: i.materialCode,
          finishCode: i.finishCode,
          printSides: i.printSides,
          quantity: i.quantity,
          unitPiasters: i.unitPiasters,
          lineTotalPiasters: i.lineTotalPiasters,
        })),
      },
      productionEvents: {
        create: t.productionEvents
          .filter((e) => ["ORDER_PLACED", "PROOF_APPROVED", ...(paid ? ["PAYMENT_CONFIRMED"] : [])].includes(e.type))
          .map((e) => ({ type: e.type, note: e.note, createdAt: now })),
      },
      ...(opts.withQcPhotos
        ? { qcPhotos: { create: t.qcPhotos.map((q) => ({ url: q.url, kind: q.kind, status: "PENDING", uploadedAt: now })) } }
        : {}),
      ...(paid
        ? {
            payments: {
              create: t.payments
                .filter((p) => p.status === "PAID")
                .slice(0, 1)
                .map((p) => ({ provider: p.provider, method: p.method, status: "PAID", amountPiasters: p.amountPiasters, providerRef: `${p.providerRef ?? "mock"}_${number}` })),
            },
          }
        : {}),
    },
    select: { id: true, number: true, vendorId: true },
  });
  created.orders.push({ id: order.id, number: order.number });
  return order;
}

/** Everything this worker created, removed by `cleanup()`. */
const created: { orders: { id: string; number: string }[]; users: string[] } = { orders: [], users: [] };

/** Track a user for cleanup (its sessions, OTP codes and the user row). */
export function track<T extends { id: string }>(user: T): T {
  created.users.push(user.id);
  return user;
}

/** Delete one order and everything hanging off it (audit rows name it by id or by number). */
export async function deleteOrder(id: string, number: string): Promise<void> {
  await db.$transaction([
    db.auditLog.deleteMany({ where: { OR: [{ entityId: id }, { summary: { contains: number } }] } }),
    db.payout.deleteMany({ where: { orderId: id } }),
    db.shipment.deleteMany({ where: { orderId: id } }),
    db.review.deleteMany({ where: { orderId: id } }),
    db.dispute.deleteMany({ where: { orderId: id } }),
    db.invoice.deleteMany({ where: { orderId: id } }),
    db.order.deleteMany({ where: { id } }),
  ]);
}

/** Remove the orders and users this worker created (call from afterAll / afterEach). */
export async function cleanup(): Promise<void> {
  for (const o of created.orders.splice(0)) await deleteOrder(o.id, o.number).catch(() => undefined);
  for (const id of created.users.splice(0)) {
    await db.session.deleteMany({ where: { userId: id } }).catch(() => undefined);
    await db.user.deleteMany({ where: { id } }).catch(() => undefined);
  }
}

/**
 * Sign up with the code (a phone that has no account yet). Since R3-03 the terms are accepted by
 * continuing (one line above Verify, the same for every number), so a new phone verifies in one
 * press, like a returning one. `labels.terms` is kept for callers and no longer used.
 */
export async function verifyNewAccount(
  scope: Page | Locator,
  code: string,
  opts: { marketing?: boolean; labels?: { code: string; terms: string | RegExp; marketing: string | RegExp; verify: string } } = {},
): Promise<void> {
  const l = opts.labels ?? { code: "Verification code", terms: /I agree to the terms/i, marketing: /Send me offers/, verify: "Verify and continue" };
  await scope.getByLabel(l.code).fill(code);
  await expect(scope.getByTestId("otp-terms")).toBeVisible();
  const marketing = scope.getByLabel(l.marketing);
  await expect(marketing).not.toBeChecked();
  if (opts.marketing) await marketing.check();
  await scope.getByRole("button", { name: l.verify }).click();
}

/**
 * Type the phone into a sign-in form (page or the designer's gate dialog), press "Send code" and
 * return the dev OTP from the banner. Hydration-safe: a late re-render can wipe a value typed into
 * the controlled input, after which "Send code" only shows the client-side "Enter a valid … number"
 * alert and sends NOTHING. In that case (and only then: no request went out, so the per-phone
 * rate limit is untouched) the phone is typed again and the button pressed again.
 */
export async function sendOtp(scope: Page | Locator, phone: string): Promise<string> {
  const input = scope.getByLabel("Mobile number");
  const send = scope.getByRole("button", { name: "Send code" });
  const banner = scope.getByTestId("otp-dev-code");
  const invalid = scope.getByText(/Enter a valid 11-digit Egyptian mobile number/);
  const type = async () => {
    await expect(async () => {
      // Clear first: React ignores an input event whose value equals the hydrated DOM value.
      await input.fill("");
      await input.fill(phone);
      await expect(input).toHaveValue(phone, { timeout: 1000 });
      await expect(send).toBeEnabled({ timeout: 1000 });
    }).toPass({ timeout: 60_000 });
    await send.click();
  };
  await type();
  await expect(async () => {
    if ((await invalid.count()) > 0 && (await input.inputValue()) !== phone) await type();
    await expect(banner).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 30_000 });
  return (await banner.textContent())!.match(/\d{6}/)![0];
}
