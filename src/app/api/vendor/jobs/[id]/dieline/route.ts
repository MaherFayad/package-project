import { fromJson } from "@/lib/json";
import { dielineToSvg, generateDielineForMaterial, DielineValidationError } from "@/lib/dieline";
import type { Dims, MaterialCode, StructureCode } from "@/types";
import { loadJobItem, safeFilename } from "../../_shared";

/**
 * GET /api/vendor/jobs/<orderId>/dieline[?item=<itemId>][&inline=1]
 * Vector dieline (cut, crease, bleed, safe zone) for the order item. No artwork, so it is available
 * as soon as the job is routed to the vendor (to check the spec before accepting).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const url = new URL(req.url);
  const r = await loadJobItem((await params).id, url.searchParams.get("item"));
  if (r instanceof Response) return r;
  const { order, item } = r;
  let svg: string;
  try {
    const model = generateDielineForMaterial(item.structureCode as StructureCode, fromJson<Dims>(item.dims), item.materialCode as MaterialCode);
    svg = dielineToSvg(model, { title: `${order.number} ${item.structureCode}` });
  } catch (e) {
    if (e instanceof DielineValidationError) return new Response("Invalid size", { status: 422 });
    throw e;
  }
  const inline = url.searchParams.get("inline") === "1";
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${safeFilename(`${order.number}-dieline.svg`)}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
