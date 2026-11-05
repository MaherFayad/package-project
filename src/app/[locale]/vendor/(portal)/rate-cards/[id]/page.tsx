import { Button, Card, EmptyBoxIllustration, EmptyState, Page } from "@/components/ui";
import { RateCardForm } from "@/components/vendor/RateCardForm";
import { requireVendorContext } from "@/components/vendor/server/context";
import { getRateCard } from "@/components/vendor/server/queries";
import { getT, toLocale } from "@/i18n";
import { fromJson } from "@/lib/json";
import type { VendorCapabilities } from "@/types";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const t = getT(toLocale((await params).locale));
  return { title: `${t("vendorPortal.rateCards.title")} · ${t("vendorPortal.title")}` };
}

export default async function RateCardPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const p = await params;
  const locale = toLocale(p.locale);
  const t = getT(locale);
  const { vendor } = await requireVendorContext(locale, `/${locale}/vendor/rate-cards/${encodeURIComponent(p.id)}`);
  if (!vendor || vendor.status === "PENDING") return null;
  const card = /^[A-Za-z0-9_-]{1,40}$/.test(p.id) ? await getRateCard(vendor.id, p.id) : null;
  if (!card) {
    return (
      <Page narrowWidth title={t("vendorPortal.rateCards.title")} backAction={{ content: t("vendorPortal.rateCards.back"), url: `/${locale}/vendor/rate-cards` }}>
        <Card>
          <EmptyState heading={t("vendorPortal.errors.NOT_FOUND")} image={<EmptyBoxIllustration />} action={<Button url={`/${locale}/vendor/rate-cards`}>{t("vendorPortal.rateCards.back")}</Button>} />
        </Card>
      </Page>
    );
  }
  const caps = fromJson<VendorCapabilities>(vendor.capabilities);
  return <RateCardForm key={card.updatedAt} card={card} offeredFinishes={caps?.finishes ?? []} />;
}
