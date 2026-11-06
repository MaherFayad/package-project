import type { FullConfig } from "@playwright/test";
import { createHash, randomBytes } from "node:crypto";
import { SEEDED, db } from "./fixtures/factory";

/**
 * Warm the server before the first test (Playwright starts `webServer` before global setup).
 * `next start` loads each route's server bundle, Prisma's engine, the catalogue cache and the PDF
 * and 3D chunks on first use; the first test to hit a cold route used to pay several seconds and
 * could time out (journey.spec, admin.spec). Every heavy route is requested once here, as the role
 * that can open it. The warm-up sessions are deleted afterwards. Nothing is mutated.
 */
const PAGES: Record<"anon" | "buyer" | "vendor" | "admin", string[]> = {
  anon: [
    "/ar",
    "/en",
    "/en/login",
    "/en/catalog",
    "/en/catalog/FS_PULP_EGG_6",
    "/en/boxes",
    "/en/boxes/mailer-box",
    "/en/boxes/mailer-box/330x200x120",
    "/ar/boxes/pizza-box/310x310x40",
    "/en/vendors",
    "/en/vendors/nile-pack",
    "/en/design/mailer-box",
    "/en/legal/privacy",
    "/sitemap.xml",
  ],
  buyer: ["/en/orders", "/en/account", "/en/vendor/apply"],
  vendor: ["/en/vendor", "/en/vendor/jobs", "/en/vendor/jobs/ELB-26201", "/ar/vendor/profile", "/ar/vendor/rate-cards", "/ar/vendor/payouts"],
  admin: ["/en/admin", "/en/admin/orders?view=qc", "/en/admin/orders/ELB-26301", "/en/admin/audit", "/en/admin/pricing", "/en/admin/payouts", "/en/admin/moderation", "/en/admin/quotes", "/en/admin/catalog"],
};

const PHONES = { buyer: SEEDED.buyer, vendor: SEEDED.deltaStaff, admin: SEEDED.admin } as const;

async function waitForServer(base: string, timeoutMs = 120_000) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    try {
      const r = await fetch(`${base}/ar`);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    if (Date.now() > until) throw new Error(`[e2e warm-up] ${base} did not answer within ${timeoutMs} ms`);
    await new Promise((r) => setTimeout(r, 500));
  }
}

/**
 * Fail fast when the server cannot sign anyone in (E-11). A server started without SESSION_SECRET,
 * or without OTP_DEV_ECHO=1 under `next start`, used to surface as 30 s timeouts in every OTP spec
 * (checkout, designer, journey) with no hint of the cause. One request for a throwaway phone; its
 * OTP row is deleted again.
 */
async function assertCanSignIn(base: string) {
  const phone = `+2015${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
  try {
    const r = await fetch(`${base}/api/auth/request-otp`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone }) });
    const body = (await r.json().catch(() => ({}))) as { devCode?: string; error?: string };
    if (r.status >= 500) throw new Error(`[e2e] the server cannot sign in (request-otp ${r.status}). Is SESSION_SECRET set for the server under test?`);
    if (r.ok && !body.devCode) throw new Error("[e2e] request-otp returned no devCode: start the server with OTP_DEV_ECHO=1 (and ALLOW_MOCK_PAYMENTS=1).");
  } finally {
    await db.otpCode.deleteMany({ where: { phone } }).catch(() => undefined);
  }
}

export default async function globalSetup(config: FullConfig) {
  const base = config.projects[0]?.use.baseURL ?? `http://localhost:${process.env.E2E_PORT ?? 3100}`;
  await waitForServer(base);
  await assertCanSignIn(base);
  const started = Date.now();
  const tokens: string[] = [];
  try {
    for (const [role, paths] of Object.entries(PAGES) as [keyof typeof PAGES, string[]][]) {
      let cookie = "elba_cookie_ack=1";
      if (role !== "anon") {
        const user = await db.user.findUniqueOrThrow({ where: { phone: PHONES[role] } });
        const token = randomBytes(32).toString("base64url");
        const tokenHash = createHash("sha256").update(token).digest("hex");
        tokens.push(tokenHash);
        await db.session.create({ data: { tokenHash, userId: user.id, expiresAt: new Date(Date.now() + 600_000) } });
        cookie += `; elba_session=${token}`;
      }
      // Two at a time: warm, without turning the warm-up into a load test.
      for (let i = 0; i < paths.length; i += 2) {
        await Promise.all(
          paths.slice(i, i + 2).map(async (p) => {
            const r = await fetch(base + p, { headers: { cookie }, redirect: "manual" }).catch(() => null);
            await r?.arrayBuffer().catch(() => null);
          }),
        );
      }
    }
    // API routes the specs call first thing (unsigned webhook → 401, anonymous PDF → 401).
    await fetch(`${base}/api/payments/webhook?provider=mock`, { method: "POST", body: "{}" }).catch(() => null);
    await fetch(`${base}/api/orders/warmup/print-pdf`).catch(() => null);
  } finally {
    if (tokens.length) await db.session.deleteMany({ where: { tokenHash: { in: tokens } } });
    await db.$disconnect();
  }
  console.log(`[e2e warm-up] ${Object.values(PAGES).flat().length} routes in ${Date.now() - started} ms`);
}
