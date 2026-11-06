import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getT, pick, toLocale } from "@/i18n";
import type { DictKey } from "@/i18n";
import { formatMoney } from "@/lib/format";
import { siteUrl } from "@/lib/env";
import { STRUCTURE_CODES } from "@/types";
import { StructureDetail } from "@/components/store/StructureDetail";
import { JsonLd } from "@/components/store/JsonLd";
import { breadcrumbJsonLd, productJsonLd } from "@/components/store/jsonld";
import { STRUCTURE_SLUGS, structureImage } from "@/components/store/catalog";
import { getPriceFrom, getStructureBySlug, listMaterials, listVendors } from "@/components/store/data";

/** Prerendered; prices and printer data refresh hourly (ISR). */
export const revalidate = 3600;

type Props = { params: Promise<{ locale: string; structure: string }> };

/**
 * Only the listed slugs exist: unknown ones 404 at routing time, before the marketing shell and its
 * hydration Suspense boundary render (a notFound() inside that boundary would answer 200; R4-MK-09).
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return STRUCTURE_CODES.map((c) => ({ structure: STRUCTURE_SLUGS[c] }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw, structure: slug } = await params;
  const locale = toLocale(raw);
  const s = await getStructureBySlug(slug);
  if (!s) notFound();
  const t = getT(locale);
  const keyword = t(`store.seo.keyword.${s.code}` as DictKey);
  const price = await getPriceFrom(s.code, s.defaultDims);
  const low = price.rows.length ? Math.min(...price.rows.map((r) => r.unitPiasters)) : null;
  const description =
    `${pick(locale, s.description.ar, s.description.en)} ` +
    (low != null ? t("store.catalog.fromPrice", { price: formatMoney(low, locale) }) + ". " : "") +
    t("store.structure.minimumValue") + ".";
  return {
    // R4-MK-08: "Custom printed mailer box | Mailer box · Elba" said the name twice; keep the
    // suffix only when the keyword does not already contain the style name.
    title: keyword.toLowerCase().includes(pick(locale, s.name.ar, s.name.en).toLowerCase()) ? keyword : `${keyword} | ${pick(locale, s.name.ar, s.name.en)}`,
    description,
    alternates: { canonical: `/${locale}/boxes/${slug}`, languages: { ar: `/ar/boxes/${slug}`, en: `/en/boxes/${slug}` } },
    openGraph: { title: keyword, description, images: [structureImage(s.code)] },
  };
}

export default async function StructurePage({ params }: Props) {
  const { locale: raw, structure: slug } = await params;
  const locale = toLocale(raw);
  const s = await getStructureBySlug(slug);
  if (!s) notFound();
  const t = getT(locale);
  const [materials, vendors, price] = await Promise.all([listMaterials(), listVendors(), getPriceFrom(s.code, s.defaultDims)]);
  const name = pick(locale, s.name.ar, s.name.en);
  const base = siteUrl();
  const url = `${base}/${locale}/boxes/${slug}`;
  const units = price.rows.map((r) => r.unitPiasters);

  return (
    <>
      <JsonLd
        data={[
          productJsonLd({
            name: t(`store.seo.keyword.${s.code}` as DictKey),
            description: pick(locale, s.description.ar, s.description.en),
            url,
            image: `${base}${structureImage(s.code)}`,
            sku: s.code,
            brand: t("meta.siteName"),
            lowPiasters: units.length ? Math.min(...units) : null,
            highPiasters: units.length ? Math.max(...units) : null,
            offerCount: price.vendorCount || undefined,
            priceValidUntil: price.validUntil ?? undefined,
            material: t(`materials.${price.material}` as DictKey),
            size: s.defaultDims,
          }),
          breadcrumbJsonLd([
            { name: t("nav.home"), url: `${base}/${locale}` },
            { name: t("nav.catalog"), url: `${base}/${locale}/catalog` },
            { name, url },
          ]),
        ]}
      />
      <StructureDetail
        locale={locale}
        structure={s}
        dims={s.defaultDims}
        materials={materials}
        price={price}
        vendors={vendors}
        title={name}
        intro={pick(locale, s.description.ar, s.description.en)}
      />
    </>
  );
}
