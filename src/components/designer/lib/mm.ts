/**
 * R5-JR-20: the designer's size fields read millimetres through the one shared parser
 * (src/lib/money/input.ts · parseMmInput: Arabic-Indic and Persian digits, «٫», a decimal comma
 * such as "250,5"; NaN otherwise). Kept as a re-export so designer code imports one place.
 */
export { parseMmInput } from "@/lib/money/input";
