import type { Dictionary } from "./types";

type Tree = Record<string, unknown>;

/** Two-level merge of a nested scope into its parent (subtrees are shipped whole). */
export function mergeDictionaries(parent: Dictionary, child: Dictionary): Dictionary {
  const p = parent as unknown as Tree;
  const c = child as unknown as Tree;
  const out: Tree = { ...p };
  for (const [ns, v] of Object.entries(c)) {
    const pv = p[ns];
    out[ns] = pv && typeof pv === "object" && v && typeof v === "object" ? { ...(pv as Tree), ...(v as Tree) } : v;
  }
  return out as unknown as Dictionary;
}
