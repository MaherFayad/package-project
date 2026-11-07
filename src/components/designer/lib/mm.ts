import { parseMmInput as parseShared } from "@/lib/money/input";

/**
 * R5-JR-20: the designer's size fields read millimetres through the one shared parser
 * (src/lib/money/input.ts · parseMmInput: Arabic-Indic and Persian digits, «٫», a decimal comma
 * such as "250,5"; NaN otherwise). R13-02: a value pasted with its unit ("330 مم", "340mm",
 * "350 ملم") drops the unit first, so a size copied from a spec sheet works.
 */
export function parseMmInput(raw: string): number {
  // R15-04: a size given in centimetres ("33 cm", «٣٣ سم») is read as millimetres × 10; it was refused
  // with "Enter a number", which did not say what was wrong.
  const cm = raw.match(/^(.*?)\s*(cm|سم|س\.م)\s*$/i);
  if (cm) {
    const n = parseShared(cm[1]);
    return Number.isNaN(n) ? NaN : Math.round(n * 100) / 10;
  }
  return parseShared(raw.replace(/\s*(mm|مم|ملم|م\.م)\s*$/i, ""));
}
