import type { LocalizedText } from "./common";
import type { FinishCode, MaterialCode } from "./material";
import type { StructureCode } from "./structure";

/** Canonical city keys (Vendor.city). Labels live in the dictionaries under `cities.*`. */
export const EGYPT_CITIES = [
  "CAIRO",
  "GIZA",
  "SIXTH_OF_OCTOBER",
  "TENTH_OF_RAMADAN",
  "OBOUR",
  "ALEXANDRIA",
  "NEW_DAMIETTA",
  "SADAT_CITY",
] as const;
export type EgyptCity = (typeof EGYPT_CITIES)[number];

export type VendorStatus = "PENDING" | "ACTIVE" | "SUSPENDED";

/** Stored in Vendor.machines (Json array). */
export interface VendorMachine {
  kind: "OFFSET" | "FLEXO" | "DIGITAL" | "DIE_CUTTER" | "FOLDER_GLUER" | "LAMINATOR" | "UV_COATER";
  model: string; // e.g. "Heidelberg Speedmaster SM 102"
  count: number;
}

/** Stored in Vendor.capabilities (Json). */
export interface VendorCapabilities {
  structures: StructureCode[];
  materials: MaterialCode[];
  finishes: FinishCode[];
  maxColors: number;
  digitalShortRun: boolean; // can do < 500 units economically
  monthlyCapacityUnits: number;
}

/** Stored in Vendor.certifications (Json array). */
export interface VendorCertification {
  code: "FOOD_SAFE" | "ISO_9001" | "FSC" | "ISO_22000";
  issuer: string;
  validUntil?: string; // ISO date
  /** Added by vendor portal: private upload key of the certificate document (served by /api/vendor/files/<key>). */
  documentKey?: string;
  /** Added by vendor portal: PENDING until Elba ops checks the document. Missing = verified (seed data). */
  status?: "PENDING" | "VERIFIED" | "REJECTED";
}

/** Added by vendor portal: a document attached to a VendorApplication row (Json column `documents`). */
export interface VendorApplicationDocument {
  kind: "COMMERCIAL_REGISTER" | "TAX_CARD" | "SAMPLE" | "FOOD_SAFE_CERT" | "OTHER";
  key: string; // upload key, served by /api/vendor/files/<key>
  name: string;
  size: number;
  type: string; // detected MIME type
}

export type VendorApplicationStatus = "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";

/** Public card/profile view. */
export interface VendorSummary {
  id: string;
  slug: string;
  name: LocalizedText;
  city: EgyptCity;
  rating: number;
  ratingCount: number;
  onTimePct: number;
  leadTimeDays: number;
  verified: boolean;
  foodSafe: boolean;
  logoUrl: string | null;
}
