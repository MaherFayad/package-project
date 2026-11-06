/**
 * Egypt's 27 governorates. `name` is the canonical English name stored in
 * ShippingAddress.governorate (and understood by `zoneForGovernorate()` in the pricing engine);
 * the label shown to buyers comes from the dictionaries: `governorates.<KEY>`.
 * Greater Cairo first (most orders), then the rest alphabetically by English name.
 */
export const GOVERNORATES = [
  { key: "CAIRO", name: "Cairo" },
  { key: "GIZA", name: "Giza" },
  { key: "QALYUBIA", name: "Qalyubia" },
  { key: "ALEXANDRIA", name: "Alexandria" },
  { key: "ASWAN", name: "Aswan" },
  { key: "ASYUT", name: "Asyut" },
  { key: "BEHEIRA", name: "Beheira" },
  { key: "BENI_SUEF", name: "Beni Suef" },
  { key: "DAKAHLIA", name: "Dakahlia" },
  { key: "DAMIETTA", name: "Damietta" },
  { key: "FAIYUM", name: "Faiyum" },
  { key: "GHARBIA", name: "Gharbia" },
  { key: "ISMAILIA", name: "Ismailia" },
  { key: "KAFR_EL_SHEIKH", name: "Kafr El Sheikh" },
  { key: "LUXOR", name: "Luxor" },
  { key: "MATROUH", name: "Matrouh" },
  { key: "MINYA", name: "Minya" },
  { key: "MONUFIA", name: "Monufia" },
  { key: "NEW_VALLEY", name: "New Valley" },
  { key: "NORTH_SINAI", name: "North Sinai" },
  { key: "PORT_SAID", name: "Port Said" },
  { key: "QENA", name: "Qena" },
  { key: "RED_SEA", name: "Red Sea" },
  { key: "SHARQIA", name: "Sharqia" },
  { key: "SOHAG", name: "Sohag" },
  { key: "SOUTH_SINAI", name: "South Sinai" },
  { key: "SUEZ", name: "Suez" },
] as const;

export type GovernorateKey = (typeof GOVERNORATES)[number]["key"];
export const GOVERNORATE_NAMES = GOVERNORATES.map((g) => g.name) as readonly string[];

export function governorateKey(name: string): GovernorateKey | null {
  const n = name.trim().toLowerCase();
  return GOVERNORATES.find((g) => g.name.toLowerCase() === n)?.key ?? null;
}

export const GOVERNORATE_KEYS = GOVERNORATES.map((g) => g.key) as readonly GovernorateKey[];

/**
 * Governorate code (e.g. "CAIRO") from either a code or a stored English name ("Cairo").
 * Codes are what new records (quote leads) store; addresses keep the English name.
 */
export function toGovernorateKey(v: string | null | undefined): GovernorateKey | null {
  if (!v) return null;
  const up = v.trim().toUpperCase();
  return (GOVERNORATE_KEYS as readonly string[]).includes(up) ? (up as GovernorateKey) : governorateKey(v);
}
