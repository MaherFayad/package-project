import type { Metadata } from "next";
import { Footprints, Pizza, Shirt, SprayCan } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getT, toLocale } from "@/i18n";
import type { DictKey } from "@/i18n/types";
import { Badge, BlockStack, Box, EmptyState, EmptyBoxIllustration, Page, Text } from "@/components/ui";
import { PRODUCT_PRESETS, designerPath, structureFromParam } from "@/components/designer/lib/catalog";
import { loadPickerStructures } from "@/components/designer/server";
import { ResumeCard } from "@/components/designer/ResumeCard";
import { ModelLinks } from "@/components/designer/ModelLinks";
import { MODELS } from "@/lib/library";
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

const PRODUCT_ICONS = { tshirt: Shirt, shoe: Footprints, perfume50: SprayCan, pizza30: Pizza } as const;

/** Structure picker: pick a style (or a product shortcut), then design for free. */
export default async function DesignPickerPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = toLocale((await params).locale);
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
    <Page title={t("designer.picker.heading")} subtitle={t("designer.picker.subtitle")} titleMetadata={<Badge tone="success">{t("designer.freeBadge")}</Badge>}>
      <BlockStack gap="600">
        <ResumeCard locale={locale} />

        <section aria-labelledby="presets-heading">
          <BlockStack gap="300">
            <BlockStack gap="100">
              <Text as="h2" variant="headingMd" id="presets-heading">
                {t("designer.picker.presetsHeading")}
              </Text>
              <Text as="p" tone="subdued">
                {t("designer.picker.presetsSubtitle")}
              </Text>
            </BlockStack>
            <ul className={styles.productGrid}>
              {PRODUCT_PRESETS.map((p) => {
                const IconC = PRODUCT_ICONS[p.key];
                return (
                  <li key={p.key}>
                    <Link className={styles.productLink} href={designerPath(locale, p.structureCode, { preset: p.presetId })}>
                      <span className={styles.productIcon} aria-hidden="true">
                        <IconC size={20} />
                      </span>
                      <BlockStack gap="050">
                        <Text as="span" fontWeight="semibold">
                          {t(`designer.productPresets.${p.key}` as DictKey)}
                        </Text>
                        <Text as="span" variant="bodySm" tone="subdued">
                          {t(`structures.${p.structureCode}` as DictKey)}
                        </Text>
                      </BlockStack>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </BlockStack>
        </section>

        <section aria-labelledby="styles-heading">
          <BlockStack gap="300">
            <BlockStack gap="100">
              <Text as="h2" variant="headingMd" id="styles-heading">
                {t("library.picker.title")}
              </Text>
              <Text as="p" tone="subdued">
                {t("library.catalog.subtitle", { count: formatNumber(MODELS.length) })}
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
      </BlockStack>
    </Page>
  );
}
