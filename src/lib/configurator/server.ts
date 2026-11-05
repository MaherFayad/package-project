import "server-only";
import type { FinishCode, MaterialCode, RateTier, StructureCode, VendorCapabilities, VendorMachine } from "@/types";
import { db } from "@/lib/db";
import { fromJson } from "@/lib/json";
import { orderability, type Orderability, type VendorForMatch } from "./pricing";
import type { ModelConfig } from "./schema";

/**
 * Server side of the configurator: load printers with their capabilities, machines and active
 * rate cards, then check a ModelConfig against them. Import from route handlers and server
 * actions only (`import { checkOrderable } from "@/lib/configurator/server"`).
 */
export async function loadVendorsForMatch(): Promise<VendorForMatch[]> {
  const vendors = await db.vendor.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      status: true,
      verified: true,
      minOrderQty: true,
      capabilities: true,
      machines: true,
      rateCards: {
        where: { active: true },
        select: { qtyTiers: true, finishSurcharges: true, structure: { select: { code: true } }, material: { select: { code: true } } },
      },
    },
  });
  return vendors.map((v) => ({
    id: v.id,
    status: v.status,
    verified: v.verified,
    minOrderQty: v.minOrderQty,
    capabilities: fromJson<VendorCapabilities>(v.capabilities),
    machines: fromJson<VendorMachine[] | null>(v.machines) ?? [],
    rateCards: v.rateCards
      .filter((c) => (fromJson<RateTier[] | null>(c.qtyTiers) ?? []).length > 0)
      .map((c) => ({
        structureCode: c.structure.code as StructureCode,
        materialCode: c.material.code as MaterialCode,
        finishes: Object.keys(fromJson<Partial<Record<FinishCode, number>> | null>(c.finishSurcharges) ?? {}) as FinishCode[],
      })),
  }));
}

/** Can this config be ordered (optionally from one printer)? */
export async function checkOrderable(cfg: ModelConfig, opts: { vendorId?: string } = {}): Promise<Orderability> {
  return orderability(cfg, await loadVendorsForMatch(), opts);
}
