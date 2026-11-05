import type { EgyptCity, StructureCode } from "@/types";
import type { PricingConfig } from "./config";
import type { BoardArea } from "./area";
import { toPiasters } from "./money";
import type { DeliveryZone, ShippingEstimate } from "./types";
import { DELIVERY_ZONES } from "./types";

/** Vendor city → origin zone. */
export const CITY_ZONE: Record<EgyptCity, DeliveryZone> = {
  CAIRO: "GREATER_CAIRO",
  GIZA: "GREATER_CAIRO",
  SIXTH_OF_OCTOBER: "GREATER_CAIRO",
  TENTH_OF_RAMADAN: "GREATER_CAIRO",
  OBOUR: "GREATER_CAIRO",
  ALEXANDRIA: "ALEXANDRIA",
  NEW_DAMIETTA: "DELTA",
  SADAT_CITY: "DELTA",
};

/**
 * Governorate → delivery zone (all 27 governorates). Keys are lower-case English names without
 * "governorate"; Arabic names are accepted too. Use `zoneForGovernorate()`.
 */
const GOVERNORATE_ZONE: Record<string, DeliveryZone> = {
  cairo: "GREATER_CAIRO", giza: "GREATER_CAIRO", qalyubia: "GREATER_CAIRO",
  alexandria: "ALEXANDRIA", matrouh: "ALEXANDRIA", beheira: "ALEXANDRIA",
  dakahlia: "DELTA", sharqia: "DELTA", gharbia: "DELTA", monufia: "DELTA", "kafr el sheikh": "DELTA", damietta: "DELTA",
  "port said": "CANAL", ismailia: "CANAL", suez: "CANAL", "north sinai": "CANAL", "south sinai": "CANAL",
  faiyum: "UPPER_EGYPT", "beni suef": "UPPER_EGYPT", minya: "UPPER_EGYPT", asyut: "UPPER_EGYPT", sohag: "UPPER_EGYPT",
  qena: "UPPER_EGYPT", luxor: "UPPER_EGYPT", aswan: "UPPER_EGYPT", "red sea": "UPPER_EGYPT", "new valley": "UPPER_EGYPT",
  القاهرة: "GREATER_CAIRO", الجيزة: "GREATER_CAIRO", القليوبية: "GREATER_CAIRO",
  الإسكندرية: "ALEXANDRIA", الاسكندرية: "ALEXANDRIA", مطروح: "ALEXANDRIA", البحيرة: "ALEXANDRIA",
  الدقهلية: "DELTA", الشرقية: "DELTA", الغربية: "DELTA", المنوفية: "DELTA", "كفر الشيخ": "DELTA", دمياط: "DELTA",
  بورسعيد: "CANAL", الإسماعيلية: "CANAL", الاسماعيلية: "CANAL", السويس: "CANAL", "شمال سيناء": "CANAL", "جنوب سيناء": "CANAL",
  الفيوم: "UPPER_EGYPT", "بني سويف": "UPPER_EGYPT", المنيا: "UPPER_EGYPT", أسيوط: "UPPER_EGYPT", اسيوط: "UPPER_EGYPT",
  سوهاج: "UPPER_EGYPT", قنا: "UPPER_EGYPT", الأقصر: "UPPER_EGYPT", الاقصر: "UPPER_EGYPT", أسوان: "UPPER_EGYPT",
  اسوان: "UPPER_EGYPT", "البحر الأحمر": "UPPER_EGYPT", "الوادي الجديد": "UPPER_EGYPT",
};

const ALIASES: Record<string, string> = {
  menoufia: "monufia", menofia: "monufia", fayoum: "faiyum", fayum: "faiyum", assiut: "asyut", asyout: "asyut",
  "kafr elsheikh": "kafr el sheikh", "kafr al sheikh": "kafr el sheikh", qalyubiya: "qalyubia", kalyoubia: "qalyubia",
  sharkia: "sharqia", dakahlya: "dakahlia", portsaid: "port said", behira: "beheira", "6th of october": "giza",
};

export function zoneForGovernorate(name: string): DeliveryZone | null {
  const key = name.trim().toLowerCase().replace(/\s+governorate$/, "").replace(/^محافظة\s+/, "").replace(/\s+/g, " ");
  return GOVERNORATE_ZONE[ALIASES[key] ?? key] ?? null;
}

export function isDeliveryZone(v: unknown): v is DeliveryZone {
  return typeof v === "string" && (DELIVERY_ZONES as readonly string[]).includes(v);
}

export interface FlatPackBundle {
  unitsPerBundle: number;
  bundles: number;
  /** Largest bundle outer size in cm. */
  bundleCm: { L: number; W: number; H: number };
  actualWeightKg: number;
  volumetricWeightKg: number;
  chargeableWeightKg: number;
}

const roundUpHalfKg = (kg: number) => Math.ceil(kg * 2 - 1e-9) / 2;

/**
 * Boxes ship flat (report §7.4). Glued styles fold flat to about half the blank with 2 board
 * layers; unglued styles (mailer, pizza) ship as flat blanks. Bundles are stacked up to
 * `maxStackMm`; each bundle is charged on max(actual, volumetric) weight, rounded up to 0.5 kg.
 */
export function flatPackBundles(
  code: StructureCode,
  area: BoardArea,
  material: { gsm: number; thicknessMm: number },
  quantity: number,
  cfg: PricingConfig,
): FlatPackBundle {
  const spec = cfg.shipping.flatPack[code];
  const long = Math.max(area.blankWidthMm, area.blankHeightMm);
  const short = Math.min(area.blankWidthMm, area.blankHeightMm);
  const footprint = spec.glued ? { a: Math.max(long / 2, short), b: Math.min(long / 2, short) } : { a: long, b: short };
  const unitThicknessMm = material.thicknessMm * (spec.glued ? 2 : 1);
  const unitsPerBundle = Math.max(1, Math.floor(spec.maxStackMm / unitThicknessMm));
  const bundles = Math.ceil(quantity / unitsPerBundle);
  const fullBundles = Math.floor(quantity / unitsPerBundle);
  const remainder = quantity - fullBundles * unitsPerBundle;

  const unitKg = (area.netAreaM2 * material.gsm) / 1000;
  const bundleKg = (units: number) => {
    const cm3 = (footprint.a / 10) * (footprint.b / 10) * ((units * unitThicknessMm) / 10);
    const vol = cm3 / cfg.shipping.volumetricDivisor;
    const act = units * unitKg;
    return { vol, act, charge: roundUpHalfKg(Math.max(vol, act)) };
  };
  const full = bundleKg(unitsPerBundle);
  const rest = remainder > 0 ? bundleKg(remainder) : { vol: 0, act: 0, charge: 0 };
  const stackUnits = Math.min(quantity, unitsPerBundle);
  return {
    unitsPerBundle,
    bundles,
    bundleCm: {
      L: Math.ceil(footprint.a / 10),
      W: Math.ceil(footprint.b / 10),
      H: Math.ceil((stackUnits * unitThicknessMm) / 10),
    },
    actualWeightKg: round2(full.act * fullBundles + rest.act),
    volumetricWeightKg: round2(full.vol * fullBundles + rest.vol),
    chargeableWeightKg: full.charge * fullBundles + rest.charge,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Delivery price for a bundle set from `origin` to the buyer's `zone` (ex-VAT, piasters). */
export function deliveryEstimate(
  bundle: FlatPackBundle,
  origin: DeliveryZone,
  zone: DeliveryZone,
  cfg: PricingConfig,
): ShippingEstimate {
  const rate = cfg.shipping.zones[zone];
  const interZone = origin !== zone;
  const kg = bundle.chargeableWeightKg;
  const courier = rate.basePiasters + Math.max(0, Math.ceil(kg - rate.includedKg)) * rate.perExtraKgPiasters;
  let mode: ShippingEstimate["mode"] = "COURIER";
  let price = courier;
  if (kg > cfg.shipping.freightThresholdKg && rate.freightPerLoadPiasters < courier) {
    mode = "FREIGHT";
    price = rate.freightPerLoadPiasters;
  }
  if (interZone) price *= cfg.shipping.interZoneMultiplier;
  return {
    zone,
    originZone: origin,
    mode,
    bundles: bundle.bundles,
    unitsPerBundle: bundle.unitsPerBundle,
    bundleCm: bundle.bundleCm,
    actualWeightKg: bundle.actualWeightKg,
    volumetricWeightKg: bundle.volumetricWeightKg,
    chargeableWeightKg: kg,
    pricePiasters: toPiasters(price),
    transitDays: rate.transitDays + (interZone ? cfg.shipping.interZoneExtraDays : 0),
  };
}
