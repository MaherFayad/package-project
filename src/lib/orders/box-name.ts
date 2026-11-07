import "server-only";
import type { Locale } from "@/types";
import { modelByCode } from "@/lib/library";
import { formatNumber } from "@/lib/format";

/** "30 × 20 × 15 cm" / "30 × 20 × 15 سم": the size a shop owner says out loud (R1-18). */
export function formatDimsCm(d: { L: number; W: number; H: number }, locale: Locale): string {
  const cm = (mm: number) => formatNumber(mm / 10, 1);
  return `⁦${cm(d.L)} × ${cm(d.W)} × ${cm(d.H)}⁩ ${locale === "ar" ? "سم" : "cm"}`;
}

/**
 * The everyday name of a box: the model's name plus its size ("علبة بريدية 25 × 18 × 8 سم").
 * Used where a design has no name of its own, instead of "Untitled box" (R1-18).
 * `fallback` is the structure label when the model is unknown; `size` overrides the box size
 * (containers pass their own "65 × 197 mm" string).
 */
export function boxName(
  input: { modelCode?: string | null; structureCode?: string | null; dims?: { L: number; W: number; H: number } | null; size?: string | null },
  locale: Locale,
  fallback: string,
): string {
  const m = modelByCode(input.modelCode) ?? modelByCode(input.structureCode);
  const name = m?.name[locale] ?? fallback;
  const size = input.size ?? (input.dims && input.dims.L > 0 ? formatDimsCm(input.dims, locale) : null);
  return size ? `${name} ${size}` : name;
}
