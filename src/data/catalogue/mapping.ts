import { STRUCTURE_TO_AVAILABILITY, VESSEL_TO_AVAILABILITY } from "@/data/packaging-availability/mapping";
import type { CatalogueStandard } from "./types";

/**
 * Model -> availability sub-family ("corrugated/fefco-02", "food-service/paper-cup" …).
 * Each rule is the most specific trade category a printer or converter would file the model
 * under; the availability data then gives Egyptian sourcing (local / imported / rare) and the
 * regions. Unit tests check every model resolves to an existing entry.
 */
export function availabilitySlugFor(source: string, code: string, style: string): string {
  const s = style.toLowerCase();
  const fefco = code.match(/^FEFCO_(\d{2})\d{2}/);
  switch (source) {
    case "core":
      return STRUCTURE_TO_AVAILABILITY[code as keyof typeof STRUCTURE_TO_AVAILABILITY] ?? "corrugated";
    case "vessel-core":
      return VESSEL_TO_AVAILABILITY[code as keyof typeof VESSEL_TO_AVAILABILITY] ?? "rigid-plastic";
    case "fefco-02":
    case "fefco-04":
    case "fefco-06-07":
    case "fefco-09":
      return `corrugated/fefco-${fefco?.[1] ?? "02"}`;
    case "fefco-03-05":
      if (s.includes("octabin")) return "pallet-box/octabin";
      return `corrugated/fefco-${fefco?.[1] ?? "03"}`;
    case "ecma-tuck":
      return s === "tuck_top_lock_bottom" || s === "glued_end" ? "folding-carton/ecma-glued" : "folding-carton/ecma-tuck";
    case "ecma-specials":
      if (s.includes("tray")) return "folding-carton/ecma-tray";
      if (s.includes("sleeve")) return "folding-carton/ecma-sleeve";
      if (code === "LIQUID_GABLE_TOP") return "folding-carton/gable-top-liquid";
      if (code === "LIQUID_ASEPTIC_BRICK") return "folding-carton/aseptic-liquid";
      return "folding-carton/ecma-special";
    case "foodservice":
      return foodservice(code, s);
    case "rigid-tubes":
      return rigidTubes(code, s);
    case "vessel-bottles":
      return bottles(style);
    case "vessel-cosmetic":
      return cosmetic(code, s);
    case "vessel-flexible":
      return flexible(code);
    case "bags":
      return `paper-bag/${s || "kraft-carrier"}`;
    default:
      return "corrugated";
  }
}

function foodservice(code: string, s: string): string {
  if (code.includes("BURGER")) return "food-service/burger-box";
  if (code.includes("NOODLE")) return "food-service/noodle-box";
  if (code.startsWith("FS_PIZZA")) return "corrugated/fefco-04";
  if (s === "bakery" && !code.startsWith("FS_BAG")) return "food-service/bakery-box";
  if (code.startsWith("FS_BAG")) return "food-service/paper-bag";
  if (code === "FS_HANG_TAG" || code === "FS_BELLY_BAND" || code === "FS_GIFT_SLEEVE") return "food-service/hang-tag";
  if (code === "FS_BOWL" || code === "FS_BOWL_LID") return "food-service/paper-bowl";
  if (code.startsWith("FS_CUP")) return "food-service/paper-cup";
  if (code.startsWith("FS_PULP")) return "food-service/molded-pulp";
  return "food-service";
}

function rigidTubes(code: string, s: string): string {
  if (code === "OCTABIN") return "pallet-box/octabin";
  if (code.startsWith("PALLET_BOX")) return "pallet-box/triple-wall-bin";
  if (code === "PADDED_MAILER") return "envelope-mailer/padded-mailer";
  if (code === "MAILER_BAG") return "envelope-mailer/kraft-mailer";
  if (code.startsWith("ENVELOPE")) return "envelope-mailer/paper-envelope";
  if (code.startsWith("TUBE")) return "paper-tube/retail-tube";
  if (s === "book" || s === "hinged") return "rigid-box/magnetic-book";
  if (s === "drawer") return "rigid-box/drawer";
  if (s === "two-piece" || s === "shoulder") return "rigid-box/lid-base";
  return "rigid-box";
}

function bottles(style: string): string {
  if (style === "GLASS_PHARMA" || style === "PET_PHARMA") return "cosmetic-pharma/pharma-bottle";
  if (style === "GLASS_JAR") return "glass/glass-jar";
  if (style.startsWith("GLASS")) return "glass/glass-bottle";
  if (style === "PET_JAR") return "rigid-plastic/plastic-jar";
  if (style === "PP_TUB") return "rigid-plastic/tub";
  if (style === "PP_PAIL") return "rigid-plastic/pail";
  if (style === "HDPE_JERRYCAN") return "rigid-plastic/jerrycan";
  if (style.startsWith("HDPE")) return "rigid-plastic/hdpe-bottle";
  return "rigid-plastic/pet-bottle";
}

function cosmetic(code: string, s: string): string {
  if (code === "PH-BLISTER") return "cosmetic-pharma/blister";
  if (code === "TUBE-ALU") return "cosmetic-pharma/aluminium-tube";
  if (code.startsWith("TUBE-") || code === "PH-TUBE") return "cosmetic-pharma/squeeze-tube";
  if (code.startsWith("PH-")) return "cosmetic-pharma/pharma-bottle";
  if (s === "jars") return "cosmetic-pharma/cosmetic-jar";
  if (code.startsWith("COS-")) return "cosmetic-pharma/cosmetic-bottle";
  if (code === "CAN-BEVERAGE") return "metal/beverage-can";
  if (code === "CAN-AEROSOL") return "metal/aerosol";
  if (code.startsWith("TIN-")) return "metal/tin";
  if (code.startsWith("CAN-")) return "metal/food-can";
  return "rigid-plastic/tub";
}

function flexible(code: string): string {
  const map: Record<string, string> = {
    FLEX_FLAT_BOTTOM_POUCH: "flexible/coffee-bag",
    FLEX_SIDE_GUSSET_BAG: "flexible/coffee-bag",
    FLEX_PILLOW_BAG: "flexible/pillow-bag",
    FLEX_QUAD_SEAL_BAG: "flexible/pillow-bag",
    FLEX_MAILER_BAG: "flexible/poly-mailer",
    FLEX_SACHET: "flexible/sachet",
    FLEX_THREE_SIDE_SEAL: "flexible/sachet",
    FLEX_STICK_PACK: "flexible/stick-pack",
    FLEX_FLOW_WRAP: "flexible/flow-wrap",
    FLEX_SHRINK_SLEEVE: "flexible/shrink-sleeve",
    FLEX_BAG_IN_BOX: "flexible/bag-in-box",
  };
  return map[code] ?? "flexible/stand-up-pouch";
}

/**
 * Standard code of a model. FEFCO codes come from the model code itself (variants keep the
 * FEFCO dot / letter convention: FEFCO_0421_1 -> "0421.1", FEFCO_0415a -> "0415a"); ECMA codes
 * from the published style reference ("ECMA A60.20"); everything else is "none" with the
 * reference printers use kept as the label ("ISO 269 (C4)", "PCO 1881").
 */
export function standardOf(code: string, standard: string | null | undefined): CatalogueStandard {
  const ref = (standard ?? "").trim();
  const fefcoCode = code.match(/^FEFCO_(\d{4})(?:_(\d))?([a-zA-Z]?)$/);
  if (fefcoCode) {
    const c = `${fefcoCode[1]}${fefcoCode[2] ? `.${fefcoCode[2]}` : ""}${fefcoCode[3].toLowerCase()}`;
    return { system: "FEFCO", code: c, label: `FEFCO ${c}` };
  }
  const fefcoRef = ref.match(/FEFCO\s*(\d{4}(?:[.\d]*)[a-z]?)/i);
  if (fefcoRef) return { system: "FEFCO", code: fefcoRef[1], label: ref };
  const ecma = ref.match(/ECMA\s*([A-F]\d{2}(?:\.\d{2}){0,3})/i);
  if (ecma) return { system: "ECMA", code: ecma[1].toUpperCase(), label: ref };
  return { system: "none", code: null, label: !ref || ref.toLowerCase() === "none" || ref === "null" ? "" : ref };
}
