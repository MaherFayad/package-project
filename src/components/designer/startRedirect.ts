import { designerPath, structureFromParam } from "./lib/catalog";

type Search = URLSearchParams | Record<string, string | string[] | undefined>;

/**
 * Storefront deep links into the start page (designHref in src/components/store/catalog.ts):
 * `?structure=CODE&L=&W=&H=&material=&vendor=` opens the editor, `?design=<id>` a saved design.
 * Returns the editor URL to redirect to, or null for the plain start page. Used by the picker
 * layout (above its Suspense boundary, so the answer is a real 307, R8-01) and by the page (soft
 * navigations, where the layout does not re-render).
 */
export function startPageRedirect(locale: string, search: Search): string | null {
  const get = (k: string) => {
    if (search instanceof URLSearchParams) return search.get(k) ?? undefined;
    const v = search[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const structure = get("structure");
  const linkCode = structure ? structureFromParam(structure) : null;
  const designId = get("design");
  if (designId) return designerPath(locale, linkCode ?? "FEFCO_0427", { d: designId });
  if (linkCode) return designerPath(locale, linkCode, { L: get("L"), W: get("W"), H: get("H"), material: get("material"), vendor: get("vendor") });
  return null;
}
