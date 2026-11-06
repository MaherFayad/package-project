import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getT, pick, toLocale } from "@/i18n";
import type { DictKey } from "@/i18n";
import { formatDims, formatMoney } from "@/lib/format";
import { siteUrl } from "@/lib/env";
import type { Locale } from "@/types";
import { StructureDetail } from "@/components/store/StructureDetail";
import { JsonLd } from "@/components/store/JsonLd";
import { breadcrumbJsonLd, productJsonLd } from "@/components/store/jsonld";
import { formatCm, parseValidSize, seoSizeParams, sizeSlug, structureFromSlug, structureImage } from "@/components/store/catalog";
import { getPriceFrom, getStructureBySlug, listMaterials, listVendors } from "@/components/store/data";

/** Prerendered; prices and printer data refresh hourly (ISR). */
export const revalidate = 3600;

type Props = { params: Promise<{ locale: string; structure: string; size: string }> };

/** Common sizes are pre-listed (sitemap + static params); any other valid size renders on demand. */
export function generateStaticParams() {
  return seoSizeParams().map(({ structure, size }) => ({ structure, size }));
}

async function load(rawLocale: string, slug: string, sizeParam: string) {
  const locale: Locale = toLocale(rawLocale);
  const code = structureFromSlug(slug);
  if (!code) return null;
  const dims = parseValidSize(code, sizeParam);
  if (!dims) return null;
  const s = await getStructureBySlug(slug);
  if (!s) return null;
  const price = await getPriceFrom(s.code, dims);
  return { locale, s, dims, price };
}

function copy(locale: Locale, d: NonNullable<Awaited<ReturnType<typeof load>>>) {
  const t = getT(locale);
  const keyword = t(`store.seo.keyword.${d.s.code}` as DictKey);
  const cm = formatCm(d.dims);
  const low = d.price.rows.length ? Math.min(...d.price.rows.map((r) => r.unitPiasters)) : null;
  // Plain text for <title>/meta/JSON-LD: drop the bidi isolation marks formatDims adds for HTML.
  const dimsText = formatDims(d.dims, locale).replace(/[\u2066-\u2069]/g, "");
  return {
    keyword,
    title: t("store.seo.title", { keyword, cm }),
    h1: t("store.seo.h1", { keyword, cm }),
    description:
      low != null
        ? t("store.seo.description", { keyword, cm, dims: dimsText, price: formatMoney(low, locale) })
        : t("store.seo.descriptionNoPrice", { keyword, cm, dims: dimsText }),
    intro: `${t("store.seo.intro", { name: pick(locale, d.s.name.ar, d.s.name.en), dims: dimsText })} ${t("store.seo.useTitle")} ${t(`store.seo.use.${d.s.code}` as DictKey)}`,
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await params;
  const d = await load(p.locale, p.structure, p.size);
  if (!d) notFound();
  const c = copy(d.locale, d);
  const path = `boxes/${p.structure}/${sizeSlug(d.dims)}`;
  return {
    title: c.title,
    description: c.description,
    keywords: [c.keyword, `${c.keyword} ${formatCm(d.dims)}`, getT(d.locale)(`structures.${d.s.code}` as DictKey)],
    alternates: { canonical: `/${d.locale}/${path}`, languages: { ar: `/ar/${path}`, en: `/en/${path}` } },
    openGraph: { title: c.title, description: c.description, images: [structureImage(d.s.code)] },
  };
}

export default async function SizeLandingPage({ params }: Props) {
  const p = await params;
  const d = await load(p.locale, p.structure, p.size);
  if (!d) notFound();
  const { locale, s, dims, price } = d;
  const t = getT(locale);
  const c = copy(locale, d);
  const [materials, vendors] = await Promise.all([listMaterials(), listVendors()]);
  const base = siteUrl();
  const url = `${base}/${locale}/boxes/${p.structure}/${sizeSlug(dims)}`;
  const units = price.rows.map((r) => r.unitPiasters);

  return (
    <>
      <JsonLd
        data={[
          productJsonLd({
            name: c.h1,
            description: c.description,
            url,
            image: `${base}${structureImage(s.code)}`,
            sku: `${s.code}-${sizeSlug(dims)}`,
            brand: t("meta.siteName"),
            lowPiasters: units.length ? Math.min(...units) : null,
            highPiasters: units.length ? Math.max(...units) : null,
            offerCount: price.vendorCount || undefined,
            priceValidUntil: price.validUntil ?? undefined,
            material: t(`materials.${price.material}` as DictKey),
            size: dims,
          }),
          breadcrumbJsonLd([
            { name: t("nav.home"), url: `${base}/${locale}` },
            { name: t("nav.catalog"), url: `${base}/${locale}/catalog` },
            { name: pick(locale, s.name.ar, s.name.en), url: `${base}/${locale}/boxes/${p.structure}` },
            { name: c.h1, url },
          ]),
        ]}
      />
      <StructureDetail
        locale={locale}
        structure={s}
        dims={dims}
        materials={materials}
        price={price}
        vendors={vendors}
        title={c.h1}
        intro={c.intro}
        currentSize={dims}
      />
    </>
  );
}
