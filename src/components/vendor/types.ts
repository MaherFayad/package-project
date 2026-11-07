/** Serializable view models passed from server pages to client components (dates as ISO strings). */
import type { Dims, FinishCode, LocalizedText, MaterialCode, OrderStatus, PrintSides, RateTier, StructureCode, VendorCertification, VendorMachine, EgyptCity } from "@/types";
import type { PayoutExpectation, ScheduleRow } from "./lib/payouts";
import type { ArtworkSummaryDTO } from "./lib/artwork";
import type { VendorStats } from "./lib/stats";

export interface JobEventDTO {
  id: string;
  type: string;
  note: string | null;
  createdAt: string;
  /** Who wrote it, as far as the vendor should know. */
  by: "you" | "elba" | "system";
}

export interface JobListItemDTO {
  id: string;
  number: string;
  status: OrderStatus;
  paidAt: string | null;
  placedAt: string;
  dueDate: string | null;
  buyerName: string;
  /** P-11: delivery city (shown instead of the buyer's first name in lists). */
  city: string;
  structureCode: StructureCode;
  /** The library model the buyer designed on (FEFCO 0203, a bottle label…); null for legacy jobs. */
  model: JobModelDTO | null;
  quantity: number;
  vendorCostPiasters: number;
  events: { type: string; createdAt: string }[];
  qcPhotos: { kind: string; status: string }[];
}

/** Exact model of a job (the rate card is only its pricing base). */
export interface JobModelDTO {
  code: string;
  standard: string;
  name: LocalizedText;
  /** R4: instant | listed (special gluing) | quote | preview (src/data/catalogue/order-mode.ts). */
  mode?: "instant" | "listed" | "quote" | "preview";
}

export interface JobItemDTO {
  id: string;
  structureCode: StructureCode;
  model: JobModelDTO | null;
  dims: Dims;
  materialCode: MaterialCode;
  finishCode: FinishCode;
  /** R5-JR-02: the chosen finishes by name ("Gold foil"), when the design's config names them. */
  finishNames?: { ar: string; en: string } | null;
  printSides: PrintSides;
  quantity: number;
  proof: { hash: string; version: number; approvedAt: string | null } | null;
}

export interface QcPhotoDTO {
  id: string;
  url: string;
  kind: string;
  status: string;
  reviewNote: string | null;
  uploadedAt: string;
}

export interface JobDetailDTO extends Omit<JobListItemDTO, "events" | "qcPhotos"> {
  items: JobItemDTO[];
  events: JobEventDTO[];
  qcPhotos: QcPhotoDTO[];
  shipTo: { city: string; governorate: string };
  payouts: { kind: string; amountPiasters: number; status: string }[];
  /** P-01: the approved proof as the buyer saw it (3D render, watermarked flat PDF, artwork per face). */
  artwork: {
    previewUrl: string | null;
    proofPdfUrl: string | null;
    summary: ArtworkSummaryDTO;
  } | null;
  /** P-04: the printer's own rate card numbers behind the price. */
  price: JobPriceDTO;
  /** P-10: the courier booking, once Elba has booked it. */
  shipment: { provider: string; trackingNumber: string | null; createdAt: string } | null;
}

export interface JobPriceDTO {
  /** "card": priced from the printer's rate card; "agreed": a price request the team agreed on. */
  source: "card" | "agreed";
  /** The current rate card for this style and board, when there is one. */
  card: {
    id: string;
    /** Tier unit at this quantity (piasters, rounded). */
    tierUnitPiasters: number;
    setupPiasters: number;
    dieCostPiasters: number;
    referenceAreaM2: number;
  } | null;
  /** Board blank of one box of this job (m²), when the dieline can be generated. */
  blankAreaM2: number | null;
}

export interface VendorPayoutRow extends ScheduleRow, PayoutExpectation {}

export interface RateCardRowDTO {
  id: string;
  structureCode: StructureCode;
  materialCode: MaterialCode;
  qtyTiers: RateTier[];
  setupPiasters: number;
  dieCostPiasters: number;
  leadTimeDays: number;
  active: boolean;
}

export interface RateCardRowWithCoverageDTO extends RateCardRowDTO {
  /** Library models priced with this card (count + industry reference of the core structure). */
  modelCount: number;
}

export interface RateCardDetailDTO extends RateCardRowDTO {
  referenceAreaM2: number;
  printSidesSurchargePct: number;
  finishSurcharges: Partial<Record<FinishCode, number>>;
  standardDies: Dims[];
  updatedAt: string;
}

export interface PortfolioItemDTO {
  id: string;
  imageUrl: string;
  captionAr: string;
  captionEn: string;
  structureCode: StructureCode | null;
  /** B-08: public only once Elba approves it. */
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewNote: string | null;
}

export interface VendorProfileDTO {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  city: EgyptCity;
  status: string;
  verified: boolean;
  foodSafe: boolean;
  rating: number;
  ratingCount: number;
  onTimePct: number;
  /** P-02: real deliveries and reviews (same as the admin scorecard); show these, not the columns above. */
  stats: VendorStats;
  bioAr: string;
  bioEn: string;
  /** R5: a bio edit waiting for Elba's review (or sent back), null when the live bio is current. */
  bioReview: { status: "PENDING" | "REJECTED"; note: string | null } | null;
  machines: VendorMachine[];
  structures: StructureCode[];
  materials: MaterialCode[];
  finishes: FinishCode[];
  maxColors: number;
  digitalShortRun: boolean;
  monthlyCapacityUnits: number;
  leadTimeDays: number;
  minOrderQty: number;
  serviceAreas: EgyptCity[];
  certifications: VendorCertification[];
  /** R4: special-gluing model codes the plant lists (capabilities.models). */
  models: string[];
  updatedAt: string;
}

export interface PayoutsDTO {
  rows: ScheduleRow[];
}
