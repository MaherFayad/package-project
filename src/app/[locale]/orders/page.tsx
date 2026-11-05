import { Placeholder } from "@/components/placeholder/Placeholder";
import { getT, toLocale } from "@/i18n";
import { requireUser } from "@/lib/auth/session";

/** FOUNDATION PLACEHOLDER — owner: checkout agent. Replace this page. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  await requireUser(locale, `/${locale}/orders`);
  const t = getT(locale);
  return <Placeholder title={t("orders.title")} note={t("common.placeholderPage")} />;
}
