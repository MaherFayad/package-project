import { createHash } from "node:crypto";
import type { DesignDoc } from "@/types";

/**
 * R6-SEC-01: a price the team sends (admin "Send price") is for the box as it was when it was
 * priced. The buyer can still change the artwork (a catalogue request starts from plain artwork),
 * but not what the printer's price depends on: model, style, size, board, finish (and which layers
 * carry it), print sides, structural features and vessel options. The fingerprint of those fields
 * is stored on the quote's PRODUCT line and checked again at checkout and when the order is placed.
 */
export type SpecDoc = Pick<DesignDoc, "structureCode" | "dims" | "materialCode" | "finishCode" | "printSides"> &
  Partial<Pick<DesignDoc, "modelCode" | "features" | "finishes" | "vessel">>;

function stable(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.keys(v as Record<string, unknown>)
        .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
        .sort()
        .map((k) => [k, stable((v as Record<string, unknown>)[k])]),
    );
  }
  return v;
}

export function designSpecHash(doc: SpecDoc): string {
  const spec = {
    modelCode: doc.modelCode ?? null,
    structureCode: doc.structureCode,
    dims: doc.dims,
    materialCode: doc.materialCode,
    finishCode: doc.finishCode,
    printSides: doc.printSides,
    features: doc.features ?? null,
    finishes: doc.finishes?.length ? doc.finishes : null,
    vessel: doc.vessel ?? null,
  };
  return createHash("sha256").update(JSON.stringify(stable(spec))).digest("base64url").slice(0, 32);
}

/**
 * Does the design still match the price? `specHash` from the PRODUCT line; quotes priced before
 * the fingerprint existed fall back to "not edited since it was priced".
 */
export function quoteMatchesDesign(specHash: unknown, doc: SpecDoc, design: { updatedAt: Date }, pricedAt: Date | null): boolean {
  if (typeof specHash === "string" && specHash) return specHash === designSpecHash(doc);
  return !!pricedAt && design.updatedAt.getTime() <= pricedAt.getTime();
}
