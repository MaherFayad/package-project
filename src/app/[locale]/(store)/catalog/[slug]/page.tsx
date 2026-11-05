import { permanentRedirect } from "next/navigation";
import { toLocale } from "@/i18n";

/** Old catalogue detail URL: structure pages live at /[locale]/boxes/[structure]. */
export default async function Page({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  permanentRedirect(`/${toLocale(locale)}/boxes/${encodeURIComponent(slug)}`);
}
