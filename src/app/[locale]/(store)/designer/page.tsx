import { publicFileExists } from "@/lib/runtime/public-files";
import type { Metadata } from "next";
import { getT, pick, toLocale } from "@/i18n";
import { formatMoney } from "@/lib/format";
import { isRealDeployment, siteUrl } from "@/lib/env";
import { DEFAULT_DIMS, defaultMaterialFor, dielineToSvg, generateDielineForMaterial } from "@/lib/dieline";
import { paymentConfig } from "@/lib/payments/config";
import { VAT_RATE } from "@/types";
import { getPriceFrom, listStructures, listVendors } from "@/components/store/data";
import { DesignerPage } from "@/components/marketing/designer-page/DesignerPage";
import { designerPageCopy } from "@/components/marketing/designer-page/copy";
import type { LoopSource } from "@/components/marketing/designer-page/LiveBox";
import { R6 } from "@/components/marketing/kit/assets";

/**
 * The mailer turntable loop (ASSETS kit) when its files are deployed: 1080p on wide screens,
 * 720p otherwise, WebM before MP4. Checked once per render on the server, so the page works the
 * same before the loops land (poster + on-demand 3D only).
 */
function mailerLoop(): LoopSource[] | undefined {
  const sources = R6.loops.mailer.sources;
  const present = sources.filter((s) => publicFileExists(s.src));
  if (present.length !== sources.length) return undefined;
  const wide = "(min-width: 900px)";
  return [...present.filter((s) => s.height === 1080).map((s) => ({ src: s.src, type: s.type, media: wide })), ...present.filter((s) => s.height === 720).map((s) => ({ src: s.src, type: s.type }))];
}

type Props = { params: Promise<{ locale: string }> };

/** Prerendered; prices and the printer count refresh hourly. */
export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const c = designerPageCopy(locale);
  return {
    title: c.meta.title,
    description: c.meta.description,
    alternates: { canonical: `/${locale}/designer`, languages: { ar: "/ar/designer", en: "/en/designer" } },
    openGraph: {
      title: c.meta.title,
      description: c.meta.description,
      url: `${siteUrl()}/${locale}/designer`,
      siteName: t("meta.siteName"),
      locale: locale === "ar" ? "ar_EG" : "en_EG",
      type: "website",
      images: ["/marketing/renders/fefco-0427.webp"],
    },
  };
}

/** /[locale]/designer: "see your printed box before you order", the page for the free 3D preview (R6, R2-04). */
export default async function DesignerProductPage({ params }: Props) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const [structures, vendors, mailerPrice] = await Promise.all([
    listStructures(),
    listVendors(),
    getPriceFrom("FEFCO_0427", DEFAULT_DIMS.FEFCO_0427).catch(() => null),
  ]);
  const row500 = mailerPrice?.rows.find((r) => r.quantity === 500) ?? mailerPrice?.rows[0];
  const model = generateDielineForMaterial("FEFCO_0427", DEFAULT_DIMS.FEFCO_0427, defaultMaterialFor("FEFCO_0427"));
  const dielineSvg = dielineToSvg(model, { showBleed: true, showSafeZones: true, showLabels: false, strokeMm: 1.2 });
  return (
    <DesignerPage
      locale={locale}
      t={t}
      styles={structures.map((s) => ({ code: s.code, family: s.family, name: pick(locale, s.name.ar, s.name.en) }))}
      mailerUnit500={row500 ? formatMoney(row500.unitPiasters, locale, { alwaysDecimals: true }) : null}
      vendorCount={vendors.length}
      vatPct={Math.round(VAT_RATE * 100)}
      payMethods={paymentConfig().methods}
      dielineSvg={dielineSvg}
      // A sample share link: the real host on a deployment, the brand domain elsewhere (never «localhost», R2-04).
      host={isRealDeployment() ? siteUrl().replace(/^https?:\/\//, "").replace(/\/$/, "") : "elba.eg"}
      loop={mailerLoop()}
    />
  );
}
