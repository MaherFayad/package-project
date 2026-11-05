import { Placeholder } from "@/components/placeholder/Placeholder";
import { getT, toLocale } from "@/i18n";


/** FOUNDATION PLACEHOLDER — owner: vendor portal agent. Replace this page. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);

  const t = getT(locale);
  return <Placeholder title={t("vendorPortal.title")} note={t("common.placeholderPage")} />;
}
