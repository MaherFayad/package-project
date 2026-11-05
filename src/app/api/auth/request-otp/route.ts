import { z } from "zod";
import { normalizeEgyptPhone } from "@/lib/phone";
import { clientIp } from "@/lib/rate-limit";
import { requestOtp } from "@/lib/auth/otp";

const Body = z.object({ phone: z.string().min(6).max(32) });

/**
 * POST /api/auth/request-otp  { phone }
 * 200 { ok: true, phone: "+20...", expiresAt, devCode? }   (devCode only when OTP dev echo is on)
 * 400 { error: "INVALID_PHONE" } | 429 { error: "RATE_LIMITED", retryAfterSec }
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  const phone = parsed.success ? normalizeEgyptPhone(parsed.data.phone) : null;
  if (!phone) return Response.json({ error: "INVALID_PHONE" }, { status: 400 });

  const r = await requestOtp(phone, clientIp(req.headers));
  if (!r.ok) {
    return Response.json(
      { error: r.error, retryAfterSec: r.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(r.retryAfterSec) } },
    );
  }
  return Response.json({ ok: true, phone, expiresAt: r.expiresAt.toISOString(), devCode: r.devCode });
}
