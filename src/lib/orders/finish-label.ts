import type { Locale } from "@/types";
import { CONFIG_FINISH_CODES, FINISHES, type ConfigFinishCode } from "@/lib/configurator/catalog";

/**
 * The finishes a buyer actually chose, by name (R5-JR-02). `OrderItem.finishCode` / `Design.finishCode`
 * hold the coarse pricing code (all three foil colours are `HOT_FOIL`), so a printer reading "Hot foil"
 * could not tell gold from silver or rose gold. The configurator finishes in `config.finishes` carry
 * the exact code; this returns their names ("Gold foil, Spot UV"), or null when the config names none.
 */
export function configFinishCodes(config: unknown): ConfigFinishCode[] {
  const list = (config as { finishes?: unknown } | null | undefined)?.finishes;
  if (!Array.isArray(list)) return [];
  const out: ConfigFinishCode[] = [];
  for (const f of list) {
    const code = (f as { code?: unknown } | null)?.code;
    if (typeof code === "string" && (CONFIG_FINISH_CODES as readonly string[]).includes(code) && !out.includes(code as ConfigFinishCode)) out.push(code as ConfigFinishCode);
  }
  return out;
}

export function configFinishNames(config: unknown, locale: Locale): string | null {
  const codes = configFinishCodes(config);
  if (!codes.length) return null;
  return codes.map((c) => FINISHES[c].name[locale]).join(locale === "ar" ? "، " : ", ");
}

/** The finish line for an order item or a design: the chosen finishes by name, else the coarse label. */
export function finishLabel(config: unknown, finishCode: string, locale: Locale, t: (key: string) => string): string {
  return configFinishNames(config, locale) ?? t(`finishes.${finishCode}`);
}
