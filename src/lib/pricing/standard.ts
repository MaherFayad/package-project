import type { Dims, DimsPreset, StructureCode } from "@/types";
import type { PricingData, PricingVendor } from "./types";

export function sameSize(a: Dims, b: Dims, toleranceMm: number): boolean {
  return Math.abs(a.L - b.L) <= toleranceMm && Math.abs(a.W - b.W) <= toleranceMm && Math.abs(a.H - b.H) <= toleranceMm;
}

/** Catalog presets flagged `standard` (a die exists) for a structure. */
export function standardPresets(data: PricingData, code: StructureCode): DimsPreset[] {
  return (data.presets[code] ?? []).filter((p) => p.standard);
}

/**
 * True when this vendor already owns a cutting die for this size: either a catalog standard
 * preset (every vendor making the structure is assumed to own those) or one of its own dies.
 */
export function vendorHasDie(
  data: PricingData,
  vendor: PricingVendor,
  code: StructureCode,
  dims: Dims,
  toleranceMm: number,
): boolean {
  if (standardPresets(data, code).some((p) => sameSize(p.dims, dims, toleranceMm))) return true;
  return (vendor.ownedDies ?? []).some((d) => d.structureCode === code && sameSize(d.dims, dims, toleranceMm));
}

const volume = (d: Dims) => d.L * d.W * d.H;

/**
 * Standard sizes the product still fits in (every inner dim >= requested) and that are not much
 * bigger (volume increase <= maxIncrease). Closest first.
 */
export function nearbyStandardSizes(
  data: PricingData,
  code: StructureCode,
  dims: Dims,
  maxIncrease: number,
  toleranceMm: number,
): DimsPreset[] {
  const v = volume(dims);
  return standardPresets(data, code)
    .filter((p) => !sameSize(p.dims, dims, toleranceMm))
    .filter((p) => p.dims.L >= dims.L && p.dims.W >= dims.W && p.dims.H >= dims.H)
    .filter((p) => volume(p.dims) <= v * (1 + maxIncrease))
    .sort((a, b) => volume(a.dims) - volume(b.dims));
}
