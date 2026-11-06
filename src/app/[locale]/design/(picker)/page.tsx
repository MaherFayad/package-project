import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getT, toLocale } from "@/i18n";
import { BlockStack, Box } from "@/components/ui/Stack";
import { EmptyState, EmptyBoxIllustration } from "@/components/ui/EmptyState";
import { Text } from "@/components/ui/Text";
import { designerPath, structureFromParam } from "@/components/designer/lib/catalog";
import { loadPickerStructures } from "@/components/designer/server";
import { ResumeCard } from "@/components/designer/ResumeCard";
import { DesignStart } from "@/components/designer/DesignStart";
import { ModelLinks } from "@/components/designer/ModelLinks";
import { MODELS } from "@/lib/library";
import Link from "next/link";
import { preload } from "react-dom";
import { CATALOGUE } from "@/data/catalogue";
import { formatNumber } from "@/lib/format";
import styles from "@/components/designer/designer.module.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  return {
    title: t("designer.title"),
    description: t("designer.metaDescription"),
    alternates: { canonical: `/${locale}/design`, languages: { ar: "/ar/design", en: "/en/design" } },
  };
}

/** Structure picker: pick a style (or a product shortcut), then design for free. */
export default async function DesignPickerPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = toLocale((await params).locale);
  // The start stage's poster is the phone LCP: request it from <head> at high priority, ahead of
  // the page's ~25 script chunks (PERF R4-04; LCP 3.9 s without it after the R4-11 rework).
  preload("/models/mailer-box.svg", { as: "image", fetchPriority: "high" });
  // Storefront deep links (designHref in src/components/store/catalog.ts):
  // ?structure=CODE&L=&W=&H=&material=&vendor= opens the editor; ?design=<id> opens a saved design.
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const linkCode = one(sp.structure) ? structureFromParam(one(sp.structure)!) : null;
  const designId = one(sp.design);
  if (designId) redirect(designerPath(locale, linkCode ?? "FEFCO_0427", { d: designId }));
  if (linkCode) {
    redirect(
      designerPath(locale, linkCode, {
        L: one(sp.L),
        W: one(sp.W),
        H: one(sp.H),
        material: one(sp.material),
        vendor: one(sp.vendor),
      }),
    );
  }
  const t = getT(locale);
  const structures = await loadPickerStructures();

  return (
    <div className={styles.startPage}>
        <ResumeCard locale={locale} />
        <DesignStart locale={locale} />

        <section aria-labelledby="styles-heading" className={styles.startCatalog}>
          <BlockStack gap="300">
            <BlockStack gap="100">
              <Text as="h2" variant="headingLg" id="styles-heading">
                {t("library.picker.title")}
              </Text>
              <Text as="p" tone="subdued">
                {t("library.catalog.subtitle", { count: formatNumber(MODELS.length) })}{" "}
                {/* R4-CR-06: one source (the catalogue rows) for both totals. */}
                {t("library.catalog.more", { count: formatNumber(CATALOGUE.length - MODELS.length) })}{" "}
                <Link href={`/${locale}/catalog`}>{t("library.catalog.moreLink")}</Link>
              </Text>
            </BlockStack>
            {structures.length === 0 && MODELS.length === 0 ? (
              <Box background="bg-surface" borderRadius="300" padding="400">
                <EmptyState headingAs="h3" heading={t("designer.picker.emptyTitle")} image={<EmptyBoxIllustration />}>
                  <p>{t("designer.picker.emptyBody")}</p>
                </EmptyState>
              </Box>
            ) : (
              <ModelLinks locale={locale} />
            )}
          </BlockStack>
        </section>
    </div>
  );
}
