import { Placeholder } from "@/components/placeholder/Placeholder";
import { getT, toLocale } from "@/i18n";


/** FOUNDATION PLACEHOLDER — owner: storefront agent (structure / SEO page per slug). Replace this page. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);

  const t = getT(locale);
  return <Placeholder title={t("catalog.title")} note={t("common.placeholderPage")} />;
}
