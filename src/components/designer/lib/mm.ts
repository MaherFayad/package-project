import { parseMmInput as parseShared } from "@/lib/money/input";

/**
 * R5-JR-20: the designer's size fields read millimetres through the one shared parser
 * (src/lib/money/input.ts · parseMmInput: Arabic-Indic and Persian digits, «٫», a decimal comma
 * such as "250,5"; NaN otherwise). R13-02: a value pasted with its unit ("330 مم", "340mm",
 * "350 ملم") drops the unit first, so a size copied from a spec sheet works.
 */
export function parseMmInput(raw: string): number {
  return parseShared(raw.replace(/\s*(mm|مم|ملم|م\.م)\s*$/i, ""));
}
