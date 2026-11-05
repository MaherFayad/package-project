import type { Artwork, Dims, FaceId, LocalizedText, StructureCode } from "@/types";
import { MAX_INSTANT_QTY } from "@/types";
import { FEATURE_SUPPORT, STRUCTURE_FAMILY, STRUCTURES, validateDims, type DimsIssue } from "@/lib/dieline";
import {
  LABEL_STOCKS,
  VESSELS,
  finishesForStock,
  type PrintSurfaceKind,
  type VesselDims,
  type VesselKind,
  type VesselPreset,
} from "@/lib/vessels";
import {
  ADD_ON_KEYS,
  ADD_ON_NAMES,
  BOX_BOARDS,
  BOX_BOARD_CODES,
  CONFIG_FINISH_CODES,
  DIRECT_PRINT_NAME,
  FINISHES,
  INSERT_KINDS,
  INSERT_NAMES,
  MAX_FOIL_COLOURS,
  TYPICAL_MIN_QUANTITY,
  VESSEL_STOCK_CODES,
  VESSEL_STOCK_SURFACE,
  isCorrugated,
  type AddOnKey,
  type BoxBoard,
  type BoxBoardCode,
  type ConfigFinishCode,
  type InsertKind,
  type SurfaceClass,
  type VesselStockCode,
} from "./catalog";
import type { BoxConfig, ConfigPrintSides, FinishChoice, ModelConfig, VesselConfigInput } from "./schema";
import { isBoxConfig } from "./schema";

/**
 * Rules engine: which options are valid for a model + material + the other choices, with a
 * human-readable Arabic / English reason whenever something is disabled. Pure and synchronous
 * so the designer can re-run it on every keystroke.
 */

export interface Verdict {
  ok: boolean;
  /** Why it is not available (ok = false). */
  reason?: LocalizedText;
  /** Available, but the buyer should know something (ok = true). */
  warning?: LocalizedText;
  /** Stable code for tests and analytics. */
  code?: string;
}

export interface OptionState<T extends string> {
  value: T;
  name: LocalizedText;
  enabled: boolean;
  reason?: LocalizedText;
  warning?: LocalizedText;
}

export type IssueSeverity = "error" | "warning" | "info";

export interface ConfigIssue {
  /** Dotted path into ModelConfig ("size.dims.L", "finishes.2", "addOns.handle"). */
  path: string;
  code: string;
  severity: IssueSeverity;
  message: LocalizedText;
}

export interface ResolvedSize {
  /** Box inner dims (mm) or null for vessels. */
  box: Dims | null;
  vessel: VesselDims | null;
  presetId: string | null;
  /** A catalogue preset with a die printers already own (cheaper, faster). */
  standard: boolean;
  vesselPreset: VesselPreset | null;
}

export interface ConfigEvaluation {
  /** No errors: the config can be priced and ordered. */
  ok: boolean;
  issues: ConfigIssue[];
  size: ResolvedSize;
  surface: SurfaceClass;
  options: {
    materials: OptionState<string>[];
    printSides: OptionState<ConfigPrintSides>[];
    colourModes: OptionState<"SPOT" | "CMYK">[];
    finishes: OptionState<ConfigFinishCode>[];
    addOns: OptionState<AddOnKey>[];
    insertKinds: OptionState<InsertKind>[];
    windowFaces: FaceId[];
    surfaces: OptionState<PrintSurfaceKind>[];
  };
}

/** Optional context that sharpens the checks (the artwork the masks point at). */
export interface EvaluateContext {
  artwork?: Artwork;
}

/* ───────────────────────────── helpers ───────────────────────────── */

const t = (en: string, ar: string): LocalizedText => ({ ar, en });
const OK: Verdict = { ok: true };
const deny = (code: string, en: string, ar: string): Verdict => ({ ok: false, code, reason: t(en, ar) });
const warn = (code: string, en: string, ar: string): Verdict => ({ ok: true, code, warning: t(en, ar) });

const FAMILY_NAME = {
  CORRUGATED: t("corrugated board", "الكرتون المضلع"),
  FOLDING_CARTON: t("folding carton board (SBS)", "كرتون الدوبلكس"),
  RIGID: t("rigid greyboard", "الكرتون المقوى"),
  TUBE: t("a paper tube", "أنبوبة الكرتون"),
} as const;

const AXIS_NAME: Record<string, LocalizedText> = {
  L: t("Length", "الطول"),
  W: t("Width", "العرض"),
  H: t("Height", "الارتفاع"),
  D: t("Diameter", "القطر"),
  G: t("Gusset", "القاعدة"),
  taper: t("Taper", "الاستدقاق"),
};

function axisName(path: string, cylinder: boolean): LocalizedText {
  if (cylinder && (path === "L" || path === "W")) return AXIS_NAME.D;
  return AXIS_NAME[path] ?? t(path, path);
}

function sizeIssueMessage(i: DimsIssue, cylinder: boolean): LocalizedText {
  const n = axisName(i.path, cylinder);
  switch (i.code) {
    case "TOO_SMALL":
      return t(`${n.en} must be at least ${i.limit} mm.`, `${n.ar} يجب ألا يقل عن ${i.limit} مم.`);
    case "TOO_LARGE":
      return t(`${n.en} can be at most ${i.limit} mm.`, `${n.ar} يجب ألا يزيد عن ${i.limit} مم.`);
    case "RULE": {
      const rule = (i.rule ?? "").replace(/\s/g, "");
      if (rule === "H<=W") return t("Height cannot be more than the width for this box.", "لا يمكن أن يزيد الارتفاع عن العرض في هذه العلبة.");
      if (rule === "L==W") return cylinder ? t("A tube is round: length and width are its diameter.", "الأنبوبة دائرية: الطول والعرض هما القطر.") : t("Length and width must be equal for this box.", "يجب أن يتساوى الطول والعرض في هذه العلبة.");
      return t(`This size breaks the rule ${i.rule}.`, `هذا المقاس لا يحقق الشرط ${i.rule}.`);
    }
    default:
      return t(`${n.en} must be a number in mm.`, `${n.ar} يجب أن يكون رقما بالمليمتر.`);
  }
}

function boardOf(cfg: BoxConfig): BoxBoard {
  return BOX_BOARDS[cfg.material];
}

function printsInside(sides: ConfigPrintSides) {
  return sides !== "OUTSIDE";
}
function printsOutside(sides: ConfigPrintSides) {
  return sides !== "INSIDE";
}

/** The surface class finishes sit on, for any config. */
export function surfaceOf(cfg: ModelConfig): SurfaceClass {
  if (isBoxConfig(cfg)) return boardOf(cfg).surface;
  if (cfg.material === "DIRECT_PRINT") return cfg.model.code === "SQUEEZE_TUBE" ? "PE_TUBE" : "FLEXIBLE_FILM";
  return VESSEL_STOCK_SURFACE[cfg.material];
}

const DIRECT_PRINT_KINDS: VesselKind[] = ["STAND_UP_POUCH", "SQUEEZE_TUBE"];

/** Finishes offered on packs printed directly (pouch laminate, PE tube). */
const DIRECT_FINISHES: Record<"FLEXIBLE_FILM" | "PE_TUBE", ConfigFinishCode[]> = {
  FLEXIBLE_FILM: ["MATTE_LAMINATION", "GLOSS_LAMINATION", "SOFT_TOUCH_LAMINATION", "SPOT_UV"],
  PE_TUBE: ["GLOSS_VARNISH", "MATTE_VARNISH", "FOIL_GOLD", "FOIL_SILVER", "SPOT_UV"],
};

/* ───────────────────────────── size ───────────────────────────── */

export function resolveSize(cfg: ModelConfig): { size: ResolvedSize; issues: ConfigIssue[] } {
  const issues: ConfigIssue[] = [];
  if (isBoxConfig(cfg)) {
    const def = STRUCTURES[cfg.model.code];
    const cylinder = def.shape === "cylinder";
    let dims: Dims | null = null;
    let presetId: string | null = null;
    let standard = false;
    if (cfg.size.mode === "preset") {
      const preset = def.presets.find((p) => p.id === (cfg.size as { presetId: string }).presetId);
      if (!preset) {
        issues.push({ path: "size.presetId", code: "UNKNOWN_PRESET", severity: "error", message: t("This size is not in the catalogue for this box.", "هذا المقاس غير موجود في كتالوج هذه العلبة.") });
      } else {
        dims = { ...preset.dims };
        presetId = preset.id;
        standard = !!preset.standard;
      }
    } else {
      const v = validateDims(cfg.model.code, cfg.size.dims);
      if (v.ok) dims = v.dims;
      else for (const i of v.issues) issues.push({ path: `size.dims.${i.path}`, code: `SIZE_${i.code}`, severity: "error", message: sizeIssueMessage(i, cylinder) });
      // Same as a standard preset? Printers already own that die.
      if (v.ok) {
        const hit = def.presets.find((p) => p.standard && Math.abs(p.dims.L - v.dims.L) <= 1 && Math.abs(p.dims.W - v.dims.W) <= 1 && Math.abs(p.dims.H - v.dims.H) <= 1);
        if (hit) {
          presetId = hit.id;
          standard = true;
        }
      }
    }
    return { size: { box: dims, vessel: null, presetId, standard, vesselPreset: null }, issues };
  }

  const def = VESSELS[cfg.model.code];
  if (cfg.size.mode === "preset") {
    const preset = def.presets.find((p) => p.id === (cfg.size as { presetId: string }).presetId) ?? null;
    if (!preset) {
      issues.push({ path: "size.presetId", code: "UNKNOWN_PRESET", severity: "error", message: t("This size is not in the catalogue for this container.", "هذا المقاس غير موجود في كتالوج هذه العبوة.") });
      return { size: { box: null, vessel: null, presetId: null, standard: false, vesselPreset: null }, issues };
    }
    return { size: { box: null, vessel: { ...preset.dims }, presetId: preset.id, standard: true, vesselPreset: preset }, issues };
  }
  const dims = cfg.size.dims;
  const lim = def.limits as Record<string, { min: number; max: number } | undefined>;
  for (const k of ["D", "H", "G", "taper"] as const) {
    const r = lim[k];
    const v = dims[k];
    if (!r || v === undefined) continue;
    const n = AXIS_NAME[k];
    if (v < r.min) issues.push({ path: `size.dims.${k}`, code: "SIZE_TOO_SMALL", severity: "error", message: t(`${n.en} must be at least ${r.min} mm.`, `${n.ar} يجب ألا يقل عن ${r.min} مم.`) });
    else if (v > r.max) issues.push({ path: `size.dims.${k}`, code: "SIZE_TOO_LARGE", severity: "error", message: t(`${n.en} can be at most ${r.max} mm.`, `${n.ar} يجب ألا يزيد عن ${r.max} مم.`) });
  }
  const preset = def.presets.find((p) => Math.abs(p.dims.D - dims.D) <= 0.5 && Math.abs(p.dims.H - dims.H) <= 0.5) ?? null;
  return { size: { box: null, vessel: { ...dims }, presetId: preset?.id ?? null, standard: !!preset, vesselPreset: preset }, issues };
}

/* ───────────────────────────── material ───────────────────────────── */

/** BC double wall is too stiff for tucks, roll-ends and locks: shipping styles only. */
const BC_STRUCTURES: StructureCode[] = ["FEFCO_0201", "FEFCO_0320"];

export function boxMaterialRule(code: StructureCode, board: BoxBoardCode, dims?: Dims | null): Verdict {
  const b = BOX_BOARDS[board];
  const family = STRUCTURE_FAMILY[code];
  if (b.family !== family) {
    const f = FAMILY_NAME[family];
    return deny("MATERIAL_FAMILY", `This style is made from ${f.en}.`, `يصنع هذا النوع من ${f.ar}.`);
  }
  if (b.flute === "BC" && !BC_STRUCTURES.includes(code))
    return deny("MATERIAL_BC_STYLE", "Double wall board is too stiff for the tucks and locks of this style. It is for shipping boxes.", "الكرتون المزدوج أقوى من أن ينثني في ألسنة وأقفال هذا النوع، وهو مخصص لعلب الشحن.");
  if (code === "PIZZA" && !b.foodSafe) return deny("MATERIAL_FOOD", "Pizza boxes touch hot food: choose a food-safe board.", "علبة البيتزا تلامس طعاما ساخنا، لذا اختر كرتونا آمنا للطعام.");
  if (code === "PIZZA" && b.flute !== "E" && b.flute !== "B") return deny("MATERIAL_PIZZA_FLUTE", "Pizza boxes are made from E or B flute.", "تصنع علب البيتزا من الكرتون المضلع E أو B.");
  if (dims && isCorrugated(b)) {
    const smallest = Math.min(dims.L, dims.W, dims.H);
    if (smallest < b.thicknessMm * 10)
      return deny("MATERIAL_TOO_THICK", `At ${smallest} mm this box is too small for ${b.thicknessMm} mm board. Choose a thinner flute.`, `هذه العلبة صغيرة جدا على كرتون سمكه ${b.thicknessMm} مم، اختر تضليعا أرق.`);
  }
  if (b.pricingMaterial === null)
    return warn("MATERIAL_MANUAL", "Not on printer rate cards yet: we confirm the price by quote.", "غير مدرج في أسعار المطابع بعد، وسنؤكد السعر بعرض سعر.");
  return OK;
}

export function vesselMaterialRule(kind: VesselKind, stock: VesselStockCode, surfaces: PrintSurfaceKind[], container?: string): Verdict {
  const direct = DIRECT_PRINT_KINDS.includes(kind);
  if (direct && stock !== "DIRECT_PRINT")
    return deny("STOCK_DIRECT_ONLY", "This pack is printed on itself, not labelled.", "تطبع هذه العبوة مباشرة ولا تحتاج ملصقا.");
  if (!direct && stock === "DIRECT_PRINT")
    return deny("STOCK_LABEL_ONLY", "We print labels and sleeves for this container, not the container itself.", "نطبع الملصقات والأغلفة لهذه العبوة وليس العبوة نفسها.");
  if (stock === "DIRECT_PRINT") return OK;
  const s = LABEL_STOCKS[stock];
  const bad = surfaces.find((x) => !s.surfaces.includes(x));
  if (bad === "SHRINK_SLEEVE") return deny("STOCK_SLEEVE", "Shrink sleeves are printed on PETG shrink film.", "تطبع أغلفة الانكماش على فيلم PETG.");
  if (bad) return deny("STOCK_SURFACE", "Shrink film is only for full sleeves, not for labels.", "فيلم الانكماش للأغلفة الكاملة فقط وليس للملصقات.");
  if (stock === "PAPER_SEMIGLOSS" && (kind === "CAN" || kind === "ROUND_BOTTLE"))
    return warn("STOCK_WET", "Paper labels are not waterproof: chilled or wet packs need BOPP.", "الملصقات الورقية لا تقاوم الماء، والعبوات المبردة تحتاج BOPP.");
  if (stock === "CLEAR_BOPP" && container && ["HDPE_WHITE", "ALUMINIUM", "TINPLATE", "GLASS_AMBER"].includes(container))
    return warn("STOCK_CLEAR_OPAQUE", "Clear labels show the container colour through unprinted areas.", "الملصق الشفاف يظهر لون العبوة في المناطق غير المطبوعة.");
  return OK;
}

/* ───────────────────────────── print sides ───────────────────────────── */

export function printSidesRule(cfg: ModelConfig, sides: ConfigPrintSides): Verdict {
  if (sides === "OUTSIDE") return OK;
  if (!isBoxConfig(cfg)) return deny("SIDES_LABEL", "Labels and sleeves print on one side.", "تطبع الملصقات والأغلفة على وجه واحد.");
  if (cfg.model.code === "PAPER_TUBE") return deny("SIDES_TUBE", "The label wraps the outside of the tube; the inner ply stays plain.", "الملصق يلف الأنبوبة من الخارج، والطبقة الداخلية تبقى سادة.");
  if (cfg.model.code === "PIZZA") return deny("SIDES_FOOD", "The inside of a pizza box touches hot food, so it stays unprinted.", "داخل علبة البيتزا يلامس الطعام الساخن، لذلك لا يطبع.");
  if (sides === "INSIDE") return warn("SIDES_INSIDE_ONLY", "Only the inside is printed; the outside stays plain board.", "يطبع الداخل فقط ويبقى الخارج بلون الكرتون.");
  return OK;
}

/* ───────────────────────────── colour ───────────────────────────── */

export function colourModeRule(cfg: ModelConfig, mode: "SPOT" | "CMYK"): Verdict {
  if (mode === "SPOT") return OK;
  const surface = surfaceOf(cfg);
  if (isBoxConfig(cfg)) {
    const b = boardOf(cfg);
    if (surface === "KRAFT_LINER" && b.flute !== "E")
      return deny("COLOUR_FLEXO_KRAFT", "B and BC kraft is printed flexo straight onto the liner: up to 4 spot colours, no photos.", "الكرتون البني B وBC يطبع فلكسو مباشرة: حتى 4 ألوان خاصة وبدون صور.");
    if (surface === "KRAFT_LINER")
      return warn("COLOUR_KRAFT", "Colours print darker on kraft and there is no white ink: white areas show the brown board.", "الألوان تظهر أغمق على الكرتون البني، ولا يوجد حبر أبيض فتظهر المناطق البيضاء بلون الكرتون.");
    if (surface === "WHITE_TOP_LINER")
      return warn("COLOUR_FLEXO", "Printed flexo directly on the board: photos print with a coarser screen than offset.", "يطبع فلكسو مباشرة على الكرتون، فتظهر الصور أقل دقة من الأوفست.");
  } else if (cfg.material === "CLEAR_BOPP" || cfg.material === "PETG_SHRINK") {
    return warn("COLOUR_CLEAR", "On clear film add a white ink layer under colours that must be opaque.", "على الفيلم الشفاف أضف طبقة حبر أبيض تحت الألوان التي يجب ألا تشف.");
  }
  return OK;
}

/** Number of print colours the pricing engine and vendors count (1..6). */
export function colourCount(cfg: ModelConfig): number {
  return cfg.colour.mode === "SPOT" ? cfg.colour.inks.length : 4 + cfg.colour.spots.length;
}

/* ───────────────────────────── finishes ───────────────────────────── */

const LAMINATIONS: ConfigFinishCode[] = ["MATTE_LAMINATION", "GLOSS_LAMINATION", "SOFT_TOUCH_LAMINATION"];

function surfaceFinishRule(cfg: ModelConfig, code: ConfigFinishCode): Verdict {
  const def = FINISHES[code];
  const surface = surfaceOf(cfg);

  if (!isBoxConfig(cfg)) {
    if (cfg.material === "DIRECT_PRINT") {
      const list = DIRECT_FINISHES[surface as "FLEXIBLE_FILM" | "PE_TUBE"] ?? [];
      return list.includes(code) ? OK : deny("FINISH_DIRECT", "Not offered for this pack.", "غير متاح لهذه العبوة.");
    }
    if (!def.label) return deny("FINISH_LABEL", "Not offered on roll labels.", "غير متاح على ملصقات الرول.");
    if (!finishesForStock(cfg.material).includes(def.label)) {
      if (cfg.material === "PETG_SHRINK") return deny("FINISH_SHRINK", "Shrink sleeves take a matte varnish only: other finishes crack when the film shrinks.", "أغلفة الانكماش تقبل الورنيش المطفي فقط، فالتشطيبات الأخرى تتشقق عند الانكماش.");
      if (cfg.material === "METALLIC_BOPP" && def.group === "foil") return deny("FINISH_FOIL_METALLIC", "Foil adds nothing on metallic film: use the film's own shine.", "البصمة لا تضيف شيئا على الفيلم المعدني.");
      if (def.group === "relief") return deny("FINISH_EMBOSS_FILM", "Film labels do not hold an emboss: choose paper labels.", "ملصقات الفيلم لا تحتفظ بالبروز، اختر الملصقات الورقية.");
      return deny("FINISH_STOCK", "Not available on this label stock.", "غير متاح على خامة الملصق هذه.");
    }
    return OK;
  }

  const b = boardOf(cfg);
  switch (def.group) {
    case "coating": {
      if (LAMINATIONS.includes(code)) {
        if (surface === "KRAFT_LINER")
          return deny("FINISH_LAM_KRAFT", "Lamination film does not bond well to uncoated kraft and hides its natural look. Choose white E-flute for a laminated box.", "فيلم السلوفان لا يلتصق جيدا بالكرتون البني غير المطلي ويخفي شكله الطبيعي. اختر الكرتون الأبيض E لعلبة بسلوفان.");
        if (surface === "WHITE_TOP_LINER")
          return deny("FINISH_LAM_FLEXO", "B and BC white board is printed directly; lamination needs a laminated print sheet. Choose white E-flute.", "الكرتون الأبيض B وBC يطبع مباشرة، والسلوفان يحتاج ورقا مطبوعا ملصوقا. اختر الكرتون الأبيض E.");
        if (cfg.model.code === "PIZZA") return deny("FINISH_LAM_PIZZA", "Pizza boxes stay unlaminated so steam can escape.", "علب البيتزا لا تغلف بالسلوفان حتى يخرج البخار.");
        return OK;
      }
      if (code === "GLOSS_VARNISH" && surface === "KRAFT_LINER")
        return deny("FINISH_GLOSS_KRAFT", "Gloss varnish soaks into kraft and shows no shine. Matte varnish protects it.", "الورنيش اللامع يتشربه الكرتون البني ولا يظهر لمعانه. الورنيش المطفي يحميه.");
      return OK;
    }
    case "spotUv": {
      if (surface === "KRAFT_LINER" || surface === "WHITE_TOP_LINER")
        return deny("FINISH_UV_UNCOATED", "Spot UV needs a coated or laminated surface; on uncoated board it soaks in and loses its shine.", "اليو في الموضعي يحتاج سطحا مطليا أو مغلفا بالسلوفان، وعلى الكرتون غير المطلي يتشربه الكرتون ويفقد لمعانه.");
      return OK;
    }
    case "foil": {
      if (surface === "KRAFT_LINER" && b.flute !== "E")
        return deny("FINISH_FOIL_FLUTE", "The ridged surface of B and BC flute gives patchy foil. Choose E-flute.", "سطح الكرتون B وBC المتموج يعطي بصمة غير منتظمة، اختر الكرتون E.");
      if (surface === "WHITE_TOP_LINER")
        return deny("FINISH_FOIL_FLUTE", "The ridged surface of B and BC flute gives patchy foil. Choose white E-flute.", "سطح الكرتون B وBC المتموج يعطي بصمة غير منتظمة، اختر الكرتون الأبيض E.");
      if (surface === "KRAFT_LINER")
        return warn("FINISH_FOIL_KRAFT", "Keep foil lines at least 0.5 mm thick: fine detail breaks up on kraft fibres.", "اجعل خطوط البصمة 0.5 مم على الأقل، فالتفاصيل الدقيقة تتقطع على ألياف الكرتون البني.");
      return OK;
    }
    case "relief": {
      if (isCorrugated(b))
        return deny("FINISH_RELIEF_FLUTE", "Embossing crushes the flutes and weakens corrugated board. Choose SBS or a rigid box.", "الطباعة البارزة أو الغائرة تسحق تضليع الكرتون وتضعفه. اختر الدوبلكس أو العلبة المقواة.");
      if (cfg.material === "SBS_300") return warn("FINISH_RELIEF_THIN", "300 gsm board takes a shallow emboss only; 350 gsm gives a crisper edge.", "كرتون 300 جم يقبل بروزا خفيفا فقط، وكرتون 350 جم يعطي حوافا أوضح.");
      return OK;
    }
  }
}

/**
 * Can `code` be (added or kept) on this config, given its OTHER finishes, sides and model?
 * `mask` is the mask the finish would use (defaults to its current one, or outside).
 */
export function finishRule(cfg: ModelConfig, code: ConfigFinishCode, mask?: FinishChoice["mask"]): Verdict {
  const def = FINISHES[code];
  const others = cfg.finishes.filter((f) => f.code !== code);
  const base = surfaceFinishRule(cfg, code);
  if (!base.ok) return base;

  const own = mask ?? cfg.finishes.find((f) => f.code === code)?.mask;
  const surface = def.masked ? (own?.surface ?? "outside") : "outside";
  if (def.masked && surface === "inside" && !printsInside(cfg.printSides))
    return deny("FINISH_INSIDE_UNPRINTED", "Print the inside to add finishes there.", "اطبع الوجه الداخلي لإضافة تشطيبات عليه.");
  if (def.masked && surface === "outside" && !printsOutside(cfg.printSides) && def.group !== "relief")
    return deny("FINISH_OUTSIDE_UNPRINTED", "The outside is not printed. Print it, or move this finish inside.", "الوجه الخارجي غير مطبوع. اطبعه أو انقل التشطيب للداخل.");

  if (def.group === "coating") {
    const other = others.find((f) => FINISHES[f.code].group === "coating");
    if (other) return deny("FINISH_ONE_COATING", `Only one coating per box: remove ${FINISHES[other.code].name.en} first.`, `طبقة حماية واحدة فقط لكل علبة: احذف ${FINISHES[other.code].name.ar} أولا.`);
  }
  if (def.group === "spotUv") {
    const coat = others.find((f) => FINISHES[f.code].group === "coating");
    if (coat && (coat.code === "GLOSS_LAMINATION" || coat.code === "GLOSS_VARNISH"))
      return deny("FINISH_UV_ON_GLOSS", "Spot UV shows no contrast over a gloss finish. Choose matte or soft-touch lamination.", "اليو في الموضعي لا يظهر فوق تشطيب لامع، اختر سلوفان مطفي أو مخملي.");
    if (!coat && (surfaceOf(cfg) === "COATED_BOARD" || surfaceOf(cfg) === "ART_PAPER_WRAP" || surfaceOf(cfg) === "LITHO_LAM"))
      return { ...OK, code: "FINISH_UV_NO_LAM", warning: t("Spot UV stands out most over matte or soft-touch lamination.", "يظهر اليو في الموضعي أوضح فوق السلوفان المطفي أو المخملي.") };
  }
  if (def.group === "foil") {
    const colours = new Set(others.filter((f) => FINISHES[f.code].group === "foil").map((f) => f.code));
    if (colours.size >= MAX_FOIL_COLOURS) return deny("FINISH_FOIL_MAX", `At most ${MAX_FOIL_COLOURS} foil colours per job.`, `بحد أقصى ${MAX_FOIL_COLOURS} لون بصمة لكل طلب.`);
  }
  if (def.group === "relief") {
    const other = others.find((f) => FINISHES[f.code].group === "relief");
    if (other) return deny("FINISH_ONE_RELIEF", "Choose emboss or deboss: one relief die per job.", "اختر البارز أو الغائر: قالب واحد لكل طلب.");
  }
  return base;
}

/* ───────────────────────────── add-ons ───────────────────────────── */

const NO_INSERT: StructureCode[] = ["PAPER_TUBE", "SLEEVE", "PIZZA", "FEFCO_0422"];

export function addOnRule(cfg: ModelConfig, key: AddOnKey): Verdict {
  if (!isBoxConfig(cfg)) return deny("ADDON_VESSEL", "Not available for labels.", "غير متاح للملصقات.");
  const code = cfg.model.code;
  const s = FEATURE_SUPPORT[code];
  switch (key) {
    case "windowFilm":
      return s.windowFaces.length ? OK : deny("ADDON_WINDOW", "This style has no window option.", "هذا النوع لا يدعم النافذة.");
    case "insert":
      return NO_INSERT.includes(code) ? deny("ADDON_INSERT", "This style has no room for an insert.", "هذا النوع لا يتسع لحشوة داخلية.") : OK;
    case "handle":
      if (code === "GABLE_BOX") return deny("ADDON_HANDLE_BUILTIN", "The carry handle is part of this box.", "المقبض جزء أساسي من هذه العلبة.");
      return s.handle ? OK : deny("ADDON_HANDLE", "This style has no handle option.", "هذا النوع لا يدعم المقبض.");
    case "tearStrip":
      return s.tearStrip ? OK : deny("ADDON_TEAR", "This style has no tear strip option.", "هذا النوع لا يدعم شريط الفتح.");
  }
}

export function insertRule(cfg: ModelConfig, kind: InsertKind): Verdict {
  const base = addOnRule(cfg, "insert");
  if (!base.ok || !isBoxConfig(cfg)) return base;
  if (kind === "DIVIDERS")
    return FEATURE_SUPPORT[cfg.model.code].partitions ? OK : deny("ADDON_DIVIDERS", "This style has no divider option.", "هذا النوع لا يدعم الفواصل.");
  return warn("ADDON_INSERT_QUOTE", "Inserts are made to your product: we confirm the price by quote.", "الحشوات تصنع حسب منتجك، وسنؤكد السعر بعرض سعر.");
}

/* ───────────────────────────── evaluate ───────────────────────────── */

function opt<T extends string>(value: T, name: LocalizedText, v: Verdict): OptionState<T> {
  return { value, name, enabled: v.ok, ...(v.reason ? { reason: v.reason } : {}), ...(v.warning ? { warning: v.warning } : {}) };
}

function verdictIssue(path: string, v: Verdict, severity: IssueSeverity = "error"): ConfigIssue | null {
  if (!v.ok) return { path, code: v.code ?? "INVALID", severity, message: v.reason! };
  if (v.warning) return { path, code: v.code ?? "WARNING", severity: "warning", message: v.warning };
  return null;
}

function layersOn(art: Artwork | undefined, surface: "outside" | "inside"): Set<string> | null {
  if (!art) return null;
  return new Set(art[surface].layers.map((l) => l.id));
}

export function evaluateConfig(cfg: ModelConfig, ctx: EvaluateContext = {}): ConfigEvaluation {
  const issues: ConfigIssue[] = [];
  const push = (i: ConfigIssue | null) => i && issues.push(i);
  const { size, issues: sizeIssues } = resolveSize(cfg);
  issues.push(...sizeIssues);

  // material
  let materials: OptionState<string>[];
  let surfaces: OptionState<PrintSurfaceKind>[] = [];
  if (isBoxConfig(cfg)) {
    materials = BOX_BOARD_CODES.filter((c) => BOX_BOARDS[c].family === STRUCTURE_FAMILY[cfg.model.code]).map((c) =>
      opt(c, BOX_BOARDS[c].name, boxMaterialRule(cfg.model.code, c, size.box)),
    );
    push(verdictIssue("material", boxMaterialRule(cfg.model.code, cfg.material, size.box)));
  } else {
    const vc = cfg as VesselConfigInput;
    const def = VESSELS[vc.model.code];
    materials = VESSEL_STOCK_CODES.map((c) => opt(c, c === "DIRECT_PRINT" ? DIRECT_PRINT_NAME : LABEL_STOCKS[c].name, vesselMaterialRule(vc.model.code, c, vc.surfaces, vc.container)));
    push(verdictIssue("material", vesselMaterialRule(vc.model.code, vc.material, vc.surfaces, vc.container)));
    surfaces = def.surfaces.map((s) => {
      const v = vc.material === "DIRECT_PRINT" || LABEL_STOCKS[vc.material].surfaces.includes(s) ? OK : deny("SURFACE_STOCK", "Not possible with the chosen stock.", "غير ممكن مع الخامة المختارة.");
      return opt(s, SURFACE_NAMES[s], v);
    });
    vc.surfaces.forEach((s, i) => {
      if (!def.surfaces.includes(s)) push({ path: `surfaces.${i}`, code: "SURFACE_UNSUPPORTED", severity: "error", message: t("This container has no such print area.", "هذه العبوة لا تحتوي على منطقة الطباعة هذه.") });
    });
    if (vc.container && !def.materials.includes(vc.container))
      push({ path: "container", code: "CONTAINER_UNSUPPORTED", severity: "error", message: t("This container is not made in that material.", "هذه العبوة لا تصنع من هذه الخامة.") });
  }

  // print sides
  const sides: ConfigPrintSides[] = ["OUTSIDE", "INSIDE", "BOTH"];
  const SIDE_NAMES: Record<ConfigPrintSides, LocalizedText> = { OUTSIDE: t("Outside", "الخارج"), INSIDE: t("Inside", "الداخل"), BOTH: t("Outside and inside", "الخارج والداخل") };
  const printSides = sides.map((s) => opt(s, SIDE_NAMES[s], printSidesRule(cfg, s)));
  push(verdictIssue("printSides", printSidesRule(cfg, cfg.printSides)));

  // colour
  const colourModes = (["SPOT", "CMYK"] as const).map((m) => opt(m, m === "SPOT" ? t("Spot colours (1 to 4)", "ألوان خاصة (1 إلى 4)") : t("Full colour (CMYK)", "ألوان كاملة CMYK"), colourModeRule(cfg, m)));
  push(verdictIssue("colour.mode", colourModeRule(cfg, cfg.colour.mode)));

  // finishes
  const finishes = CONFIG_FINISH_CODES.map((c) => opt(c, FINISHES[c].name, finishRule(cfg, c)));
  const seen = new Set<ConfigFinishCode>();
  cfg.finishes.forEach((f, i) => {
    if (seen.has(f.code)) {
      push({ path: `finishes.${i}`, code: "FINISH_DUPLICATE", severity: "error", message: t("This finish is listed twice.", "هذا التشطيب مكرر.") });
      return;
    }
    seen.add(f.code);
    push(verdictIssue(`finishes.${i}`, finishRule(cfg, f.code, f.mask)));
    const def = FINISHES[f.code];
    if (def.masked) {
      const ids = f.mask?.layerIds ?? [];
      if (ids.length === 0)
        push({ path: `finishes.${i}.mask`, code: "MASK_EMPTY", severity: "error", message: t(`Choose which artwork gets ${def.name.en.toLowerCase()}.`, `اختر عناصر التصميم التي يطبق عليها ${def.name.ar}.`) });
      const known = layersOn(ctx.artwork, f.mask?.surface ?? "outside");
      if (known && ids.some((id) => !known.has(id)))
        push({ path: `finishes.${i}.mask`, code: "MASK_MISSING_LAYER", severity: "warning", message: t(`Some artwork for ${def.name.en.toLowerCase()} was deleted.`, `بعض عناصر ${def.name.ar} تم حذفها من التصميم.`) });
    }
  });

  // add-ons
  const addOns = ADD_ON_KEYS.map((k) => opt(k, ADD_ON_NAMES[k], addOnRule(cfg, k)));
  const insertKinds = INSERT_KINDS.map((k) => opt(k, INSERT_NAMES[k], insertRule(cfg, k)));
  const windowFaces = isBoxConfig(cfg) ? FEATURE_SUPPORT[cfg.model.code].windowFaces : [];
  const a = cfg.addOns;
  if (a.windowFilm) {
    push(verdictIssue("addOns.windowFilm", addOnRule(cfg, "windowFilm")));
    if (isBoxConfig(cfg) && windowFaces.length && !windowFaces.includes(a.windowFilm.face))
      push({ path: "addOns.windowFilm.face", code: "ADDON_WINDOW_FACE", severity: "error", message: t("A window is not possible on that side of this box.", "لا يمكن عمل نافذة على هذا الوجه من العلبة.") });
  }
  if (a.insert) push(verdictIssue("addOns.insert", insertRule(cfg, a.insert.kind)));
  if (a.handle) {
    const v = addOnRule(cfg, "handle");
    if (v.code !== "ADDON_HANDLE_BUILTIN") push(verdictIssue("addOns.handle", v));
  }
  if (a.tearStrip) push(verdictIssue("addOns.tearStrip", addOnRule(cfg, "tearStrip")));

  // quantity
  if (cfg.quantity < TYPICAL_MIN_QUANTITY)
    push({ path: "quantity", code: "QTY_SMALL", severity: "warning", message: t(`Most printers start at ${TYPICAL_MIN_QUANTITY} pieces; small runs print digitally and cost more each.`, `تبدأ أغلب المطابع من ${TYPICAL_MIN_QUANTITY} قطعة، والكميات الصغيرة تطبع رقميا بتكلفة أعلى للقطعة.`) });
  if (cfg.quantity > MAX_INSTANT_QTY)
    push({ path: "quantity", code: "QTY_QUOTE", severity: "info", message: t(`Above ${MAX_INSTANT_QTY} pieces we price by quote within 24 hours.`, `فوق ${MAX_INSTANT_QTY} قطعة نسعر بعرض سعر خلال 24 ساعة.`) });

  if (size.standard && isBoxConfig(cfg))
    push({ path: "size", code: "SIZE_STANDARD", severity: "info", message: t("Standard size: printers already own the cutting die, so it is cheaper and faster.", "مقاس قياسي: القالب متوفر لدى المطابع، فالسعر أقل والتنفيذ أسرع.") });

  return {
    ok: !issues.some((i) => i.severity === "error"),
    issues,
    size,
    surface: surfaceOf(cfg),
    options: { materials, printSides, colourModes, finishes, addOns, insertKinds, windowFaces, surfaces },
  };
}

export const SURFACE_NAMES: Record<PrintSurfaceKind, LocalizedText> = {
  WRAP: t("Wrap-around label", "ملصق ملتف"),
  FRONT: t("Front label", "ملصق أمامي"),
  BACK: t("Back label", "ملصق خلفي"),
  SHRINK_SLEEVE: t("Shrink sleeve", "غلاف انكماش"),
  NECK: t("Neck label", "ملصق العنق"),
  LID: t("Lid label", "ملصق الغطاء"),
};

/* ───────────────────────────── repair ───────────────────────────── */

export interface Removal {
  path: string;
  message: LocalizedText;
}

/**
 * Bring a config back to something printable after the buyer changed the model or material:
 * swaps an impossible board for the structure default, drops finishes and add-ons the new
 * combination cannot make, and falls back to spot colours where CMYK is not offered.
 * Returns what was changed so the UI can tell the buyer (toast / banner).
 */
export function sanitizeConfig(cfg: ModelConfig): { config: ModelConfig; removed: Removal[] } {
  const removed: Removal[] = [];
  let next: ModelConfig = structuredClone(cfg);

  if (isBoxConfig(next)) {
    const box = next;
    const { size } = resolveSize(box);
    if (!boxMaterialRule(box.model.code, box.material, size.box).ok) {
      const fallback = BOX_BOARD_CODES.find((c) => boxMaterialRule(box.model.code, c, size.box).ok && BOX_BOARDS[c].pricingMaterial);
      if (fallback) {
        removed.push({ path: "material", message: t(`Board changed to ${BOX_BOARDS[fallback].name.en}.`, `تم تغيير الخامة إلى ${BOX_BOARDS[fallback].name.ar}.`) });
        box.material = fallback;
      }
    }
  } else {
    const v = next;
    const def = VESSELS[v.model.code];
    const keep = v.surfaces.filter((s) => def.surfaces.includes(s));
    v.surfaces = keep.length ? keep : [...def.defaultSurfaces];
    if (v.container && !def.materials.includes(v.container)) v.container = def.defaultMaterial;
    if (!vesselMaterialRule(v.model.code, v.material, v.surfaces).ok) {
      const fallback = VESSEL_STOCK_CODES.find((c) => vesselMaterialRule(v.model.code, c, v.surfaces).ok);
      if (fallback) {
        removed.push({ path: "material", message: t("Label stock changed to fit this container.", "تم تغيير خامة الملصق لتناسب هذه العبوة.") });
        v.material = fallback;
      }
    }
  }

  if (!printSidesRule(next, next.printSides).ok) {
    removed.push({ path: "printSides", message: t("Only the outside can be printed now.", "يمكن طباعة الوجه الخارجي فقط الآن.") });
    next.printSides = "OUTSIDE";
  }
  if (!colourModeRule(next, next.colour.mode).ok) {
    removed.push({ path: "colour", message: t("Switched to spot colours: full colour is not printed on this board.", "تم التحويل إلى ألوان خاصة، فالألوان الكاملة لا تطبع على هذه الخامة.") });
    next.colour = { mode: "SPOT", inks: next.colour.mode === "CMYK" && next.colour.spots.length ? next.colour.spots.slice(0, 4) : ["Black C"] };
  }

  // Finishes: keep in order, re-checking each against the ones already kept.
  const kept: FinishChoice[] = [];
  for (const f of next.finishes) {
    if (kept.some((k) => k.code === f.code)) continue;
    const probe = { ...next, finishes: kept } as ModelConfig;
    const v = finishRule(probe, f.code, f.mask);
    if (v.ok) kept.push(f);
    else removed.push({ path: `finishes.${f.code}`, message: t(`${FINISHES[f.code].name.en} removed: ${v.reason!.en}`, `تم حذف ${FINISHES[f.code].name.ar}: ${v.reason!.ar}`) });
  }
  next = { ...next, finishes: kept } as ModelConfig;

  const a = { ...next.addOns };
  const drop = (key: AddOnKey, v: Verdict) => {
    removed.push({ path: `addOns.${key}`, message: t(`${ADD_ON_NAMES[key].en} removed: ${v.reason?.en ?? ""}`.trim(), `تم حذف ${ADD_ON_NAMES[key].ar}: ${v.reason?.ar ?? ""}`.trim()) });
  };
  if (a.windowFilm) {
    const v = addOnRule(next, "windowFilm");
    const faces = isBoxConfig(next) ? FEATURE_SUPPORT[next.model.code].windowFaces : [];
    if (!v.ok) {
      drop("windowFilm", v);
      a.windowFilm = null;
    } else if (!faces.includes(a.windowFilm.face)) a.windowFilm = { ...a.windowFilm, face: faces[0] };
  }
  if (a.insert) {
    const v = insertRule(next, a.insert.kind);
    if (!v.ok) {
      drop("insert", v);
      a.insert = null;
    }
  }
  for (const key of ["handle", "tearStrip"] as const) {
    if (!a[key]) continue;
    const v = addOnRule(next, key);
    if (!v.ok) {
      if (v.code !== "ADDON_HANDLE_BUILTIN") drop(key, v);
      a[key] = false;
    }
  }
  next = { ...next, addOns: a } as ModelConfig;
  return { config: next, removed };
}
