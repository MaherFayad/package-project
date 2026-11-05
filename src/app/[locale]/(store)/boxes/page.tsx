import { permanentRedirect } from "next/navigation";
import { toLocale } from "@/i18n";

/** /boxes has no index of its own: the catalogue is at /[locale]/catalog. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  permanentRedirect(`/${toLocale((await params).locale)}/catalog`);
}
