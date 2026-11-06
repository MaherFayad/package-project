import type { Locale } from "@/types";
import { getDictionary } from "./index";
import type { Dictionary } from "./types";
import { I18N_SCOPES, type I18nScopeName } from "./scopes.generated";

/**
 * Client dictionaries per route group (R5-PL-08).
 *
 * Every page used to serialise the whole public dictionary (99.7 KB raw in Arabic) into its RSC
 * payload. Now the locale layout ships the "root" scope, and each area layout (designer, share,
 * checkout, orders, account, admin, vendor, dev) wraps its subtree in <I18nScope>, which adds only
 * what that area's code can read. Nested providers merge (src/i18n/client.tsx).
 *
 * What a scope can read comes from scripts/generate-i18n-scopes.ts (import graph from the route
 * files, every key literal, key prefix and dict.<ns> access). It is shipped by second-level
 * subtree ("store.cookie", "designer.price"), not by leaf, so a key picked at run time inside a
 * subtree the code names (t(RULE_KEYS[r]), t(`materials.${code}`)) is always present. Server
 * components keep the full dictionary (getT / getDictionary).
 */
const SERVER_ONLY = new Set(["legal", "notify"]);
/** Areas that ship their own namespace whole (they did before; no public page reaches them). */
const WHOLE: Partial<Record<I18nScopeName, string[]>> = { admin: ["admin"], vendor: ["vendorPortal"] };

type Tree = Record<string, unknown>;
const cache = new Map<string, Dictionary>();

/** The keys/prefixes of a scope, picked by second-level subtree from the full dictionary. */
export function scopedDictionary(locale: Locale, scope: I18nScopeName): Dictionary {
  const id = `${locale}:${scope}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const full = getDictionary(locale) as unknown as Tree;
  const out: Tree = {};
  const take = (ns: string, sub?: string) => {
    if (SERVER_ONLY.has(ns) || !(ns in full)) return;
    const v = full[ns];
    if (!sub || typeof v !== "object" || v === null) {
      out[ns] = v;
      return;
    }
    if (out[ns] === v) return; // already whole
    const src = v as Tree;
    if (!(sub in src)) return;
    const dst = (out[ns] ??= {}) as Tree;
    dst[sub] = src[sub];
  };
  for (const ns of WHOLE[scope] ?? []) take(ns);
  for (const key of I18N_SCOPES[scope]) {
    const [ns, sub] = key.replace(/\.$/, "").split(".");
    take(ns!, sub);
  }
  const dict = out as unknown as Dictionary;
  cache.set(id, dict);
  return dict;
}

export { mergeDictionaries } from "./merge";
