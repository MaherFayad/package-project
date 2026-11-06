import "server-only";
import { modelByCode } from "@/lib/library";

/**
 * Fallback picture for a design or order line without its own render (CR-09): the model's
 * catalogue drawing, never the broken-image glyph. Server only (the model library is large).
 */
export function modelPoster(modelCode: string | null | undefined, structureCode: string | null | undefined): string {
  const m = modelByCode(modelCode) ?? modelByCode(structureCode);
  return `/models/${m?.slug ?? "mailer-box"}.svg`;
}
