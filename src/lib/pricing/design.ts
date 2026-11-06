import type { DesignDoc } from "@/types";
import { designPricedFinishes } from "@/types";
import type { QuoteInput } from "./types";

/**
 * Added by 3D integration: the priced spec of a design (everything but quantity / zone /
 * vendor / colours). Library models (family styles, containers) are priced through their base
 * structure with their own board / label area (`model`).
 */
export function designQuoteFields(doc: DesignDoc): Pick<QuoteInput, "structureCode" | "dims" | "materialId" | "finishes" | "printSides" | "model"> {
  const model = doc.modelCode && doc.modelCode !== doc.structureCode ? { code: doc.modelCode, ...(doc.features ? { features: doc.features } : {}), ...(doc.vessel ? { vessel: doc.vessel } : {}) } : undefined;
  return {
    structureCode: doc.structureCode,
    dims: doc.dims,
    materialId: doc.materialCode,
    finishes: designPricedFinishes(doc),
    printSides: doc.printSides,
    ...(model ? { model } : {}),
  };
}
