// Mint one-hour session tokens for the seeded roles (avoids the OTP rate limit during long sweeps).
// Usage: ELBA_DATABASE_URL=file:./ax.db npx tsx docs/audit/tools/a11y-r5-sessions.ts > sessions.json
import { createHash, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const PH = { buyer: "+201000000002", vendor: "+201000000010", admin: "+201000000001", applicant: "+201000000020" };
(async () => {
  const out: Record<string, string> = {};
  for (const [role, phone] of Object.entries(PH)) {
    const u = await db.user.findUniqueOrThrow({ where: { phone } });
    const token = randomBytes(32).toString("base64url");
    await db.session.create({ data: { tokenHash: createHash("sha256").update(token).digest("hex"), userId: u.id, expiresAt: new Date(Date.now() + 4 * 3600_000) } });
    out[role] = token;
  }
  console.log(JSON.stringify(out));
  await db.$disconnect();
})();
