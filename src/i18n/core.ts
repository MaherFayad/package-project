import type { Dictionary, TVars } from "./types";

/** Dictionary-free helpers, safe for client bundles. */
/** Look up a dot path. Missing keys return the key itself (and warn in dev). */
export function lookup(dict: Dictionary, key: string): string {
  let cur: unknown = dict;
  for (const part of key.split(".")) {
    if (cur && typeof cur === "object" && part in (cur as object)) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      cur = undefined;
      break;
    }
  }
  if (typeof cur !== "string") {
    if (process.env.NODE_ENV !== "production") console.warn(`[i18n] missing key: ${key}`);
    return key;
  }
  return cur;
}

export function interpolate(s: string, vars?: TVars): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

