import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { MATERIAL_CODES, type DesignDoc, type Dims, type DimsPreset, type MaterialCode, type StructureCode } from "@/types";
import { validateDims } from "@/lib/dieline";
import { getT, toLocale } from "@/i18n";
import type { DictKey } from "@/i18n/types";
import { DesignerApp } from "@/components/designer/DesignerApp";
import { createDesignDoc } from "@/components/designer/lib/doc";
import { FALLBACK_PRESETS, designerPath, presetDims, structureFromParam } from "@/components/designer/lib/catalog";
import { currentActor, loadDesign, loadPickerStructures } from "@/components/designer/server";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string; structure: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale: l, structure } = await params;
  const locale = toLocale(l);
  const code = structureFromParam(structure);
  const t = getT(locale);
  if (!code) return { title: t("designer.title") };
  return {
    title: t("designer.editorTitle", { structure: t(`structures.${code}` as DictKey) }),
    description: t("designer.metaDescription"),
    robots: { index: false, follow: true },
  };
}

/**
 * The free 3D designer for one structure. `?preset=<id>` starts from a catalog size,
 * `?d=<designId>` opens a saved design (owner or the anonymous browser that made it),
 * `?resume=1` restores this device's autosave.
 */
export default async function DesignEditorPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { locale: l, structure } = await params;
  const sp = await searchParams;
  const locale = toLocale(l);
  const code = structureFromParam(structure);
  if (!code) notFound();

  const [actor, structures] = await Promise.all([currentActor(), loadPickerStructures()]);
  const presetsByCode: Partial<Record<StructureCode, DimsPreset[]>> = { ...FALLBACK_PRESETS };
  for (const s of structures) presetsByCode[s.code] = s.presets;

  let doc: DesignDoc | null = null;
  let designId: string | null = null;
  let loadError: "notFound" | null = null;
  const d = one(sp.d);
  if (d) {
    const loaded = await loadDesign(d, actor);
    if (loaded) {
      if (loaded.doc.structureCode !== code) redirect(designerPath(locale, loaded.doc.structureCode, { d }));
      doc = loaded.doc;
      designId = loaded.doc.id ?? d;
    } else loadError = "notFound";
  }
  if (!doc) {
    // Deep links from the storefront (designHref): ?L=&W=&H=&material= override the preset when valid.
    let dims: Dims = presetDims(code, one(sp.preset), presetsByCode[code]);
    const [L, W, H] = [one(sp.L), one(sp.W), one(sp.H)].map((v) => Number(v));
    if ([L, W, H].every((n) => Number.isFinite(n) && n > 0)) {
      const v = validateDims(code, { L, W, H });
      if (v.ok) dims = v.dims;
    }
    const m = one(sp.material);
    const materialCode = m && (MATERIAL_CODES as readonly string[]).includes(m) ? (m as MaterialCode) : undefined;
    doc = createDesignDoc({ structureCode: code, dims, materialCode });
  }

  return (
    <DesignerApp
      locale={locale}
      initialDoc={doc}
      initialDesignId={designId}
      initialUser={actor.user ? { id: actor.user.id, name: actor.user.name } : null}
      presetsByCode={presetsByCode}
      loadError={loadError}
      resumeLocal={!d && one(sp.resume) === "1"}
    />
  );
}
