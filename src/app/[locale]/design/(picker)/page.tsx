import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getT, toLocale } from "@/i18n";
import { BlockStack, Box } from "@/components/ui/Stack";
import { EmptyState, EmptyBoxIllustration } from "@/components/ui/EmptyState";
import { Text } from "@/components/ui/Text";
import { loadPickerStructures } from "@/components/designer/server";
import { startPageRedirect } from "@/components/designer/startRedirect";
import { ModelLinks } from "@/components/designer/ModelLinks";
import { MODELS } from "@/lib/library";
import Link from "next/link";
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
  // Deep links: the layout already redirected on a full load; this covers soft navigations.
  const search = await searchParams;
  const to = startPageRedirect(locale, search);
  if (to) redirect(to);
  // ?q= prefills the model search (the prompt bar on /[locale]/designer).
  const q = (Array.isArray(search.q) ? search.q[0] : search.q)?.trim().slice(0, 80) ?? "";
  const t = getT(locale);
  const structures = await loadPickerStructures();

  // The hero and the resume card render in the layout, above the Suspense boundary (R8-02).
  return (
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
              <ModelLinks locale={locale} query={q} />
            )}
          </BlockStack>
        </section>
  );
}
