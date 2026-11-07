import { z } from "zod";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { currentActor } from "@/components/designer/server";
import { designDocSchema } from "@/components/designer/lib/doc";
import { generatePrintPdf } from "@/lib/orders/pdf/print";
import { readJson } from "../_shared";
import type { DesignDoc } from "@/types";

const Body = z.object({
  doc: designDocSchema,
  /** "print": artwork + dieline + bleed + crop marks. "template": the empty dieline to design on. */
  kind: z.enum(["print", "template"]).default("print"),
});

/**
 * POST /api/designs/print-pdf — the designer's "Print-ready PDF" export: the same file the
 * printer receives (artwork with bleed, a "Dieline" spot-colour layer, crop marks, slug), built
 * from the design being edited. `kind: "template"` returns the blank dieline to design on.
 * Signed-in visitors only (export sits behind the designer's account gate).
 * 200 application/pdf · 400 INVALID_BODY · 401 SIGN_IN · 413 TOO_LARGE · 429 RATE_LIMITED
 */
export async function POST(req: Request) {
  const actor = await currentActor();
  if (!actor.user) return Response.json({ error: "SIGN_IN" }, { status: 401 });
  const rl = rateLimit("designs:print-pdf", actor.user.id ?? `ip:${clientIp(req.headers)}`, 30, 600_000);
  if (!rl.ok) return Response.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } });
  const json = await readJson(req);
  if (json instanceof Response) return json;
  const parsed = Body.safeParse(json);
  if (!parsed.success) return Response.json({ error: "INVALID_BODY", issues: parsed.error.issues.slice(0, 10) }, { status: 400 });
  const { kind } = parsed.data;
  const doc = parsed.data.doc as DesignDoc;
  const source: DesignDoc =
    kind === "template"
      ? { ...doc, artwork: { outside: { background: null, layers: [] }, inside: { background: null, layers: [] } } }
      : doc;
  try {
    const file = await generatePrintPdf(source);
    const name = `elba-${(doc.modelCode ?? doc.structureCode).toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${doc.dims.L}x${doc.dims.W}x${doc.dims.H}-${kind === "template" ? "dieline" : "print"}.pdf`;
    return new Response(new Uint8Array(file.bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        ...(file.warnings.length ? { "X-Elba-Warnings": file.warnings.slice(0, 20).join(",") } : {}),
      },
    });
  } catch {
    return Response.json({ error: "PDF_FAILED" }, { status: 500 });
  }
}
