import { z } from "zod";
import { db } from "@/lib/db";
import { fromJson, toJson } from "@/lib/json";
import { apiRequireRole } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { brandColorSchema, MAX_BRAND_COLORS } from "@/components/designer/lib/doc";
import type { BrandColor } from "@/types";
import { readJsonCapped } from "../../_lib/body";

/**
 * The signed-in buyer's saved brand colours (designer; integrator decision: no licensed Pantone
 * library, the buyer types their own CMYK and spot reference, which the printer matches).
 *
 * GET 200 { colors: BrandColor[] } · PUT { colors } → 200 { colors } · 400 INVALID_BODY ·
 * 401 UNAUTHENTICATED · 429 RATE_LIMITED
 */
const Body = z.object({ colors: z.array(brandColorSchema).max(MAX_BRAND_COLORS) });

export async function GET() {
  const user = await apiRequireRole();
  if (user instanceof Response) return user;
  const row = await db.user.findUnique({ where: { id: user.id }, select: { brandColors: true } });
  const parsed = z.array(brandColorSchema).safeParse(fromJson<unknown>(row?.brandColors ?? null) ?? []);
  return Response.json({ colors: parsed.success ? parsed.data : [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(req: Request) {
  const user = await apiRequireRole();
  if (user instanceof Response) return user;
  const rl = rateLimit("brand-colors:write", user.id, 60, 600_000);
  if (!rl.ok) return Response.json({ error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } });
  const json = await readJsonCapped(req, 16_384);
  if (json instanceof Response) return json;
  const parsed = Body.safeParse(json);
  if (!parsed.success) return Response.json({ error: "INVALID_BODY", issues: parsed.error.issues.slice(0, 10) }, { status: 400 });
  // One entry per colour code: the last name / references win.
  const byHex = new Map<string, BrandColor>();
  for (const c of parsed.data.colors) byHex.set(c.hex.toLowerCase(), { ...c, hex: c.hex.toLowerCase() });
  const colors = [...byHex.values()];
  await db.user.update({ where: { id: user.id }, data: { brandColors: toJson(colors) } });
  return Response.json({ colors }, { headers: { "Cache-Control": "no-store" } });
}
