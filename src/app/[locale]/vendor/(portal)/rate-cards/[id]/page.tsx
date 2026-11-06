import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyBoxIllustration, EmptyState } from "@/components/ui/EmptyState";
import { Page } from "@/components/ui/Page";
import { RateCardForm } from "@/components/vendor/RateCardForm";
import { requireVendorContext } from "@/components/vendor/server/context";
import { getRateCard } from "@/components/vendor/server/queries";
import { modelsForCard } from "@/components/vendor/lib/coverage";
import { getT, toLocale, type DictKey } from "@/i18n";
import { fromJson } from "@/lib/json";
import type { VendorCapabilities } from "@/types";

/** Detail pages lead with the entity, then the section (WCAG 2.4.2): "Mailer box, E-flute kraft · Rate cards · …". */
export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const p = await params;
  const locale = toLocale(p.locale);
  const t = getT(locale);
  const section = `${t("vendorPortal.rateCards.title")} · ${t("vendorPortal.title")}`;
  const { vendor } = await requireVendorContext(locale, `/${locale}/vendor/rate-cards/${encodeURIComponent(p.id)}`);
  const card = vendor && /^[A-Za-z0-9_-]{1,40}$/.test(p.id) ? await getRateCard(vendor.id, p.id) : null;
  if (!card) return { title: section };
  const name = (key: string, fallback: string) => {
    const v = t(key as DictKey);
    return v === key ? fallback : v;
  };
  const sep = locale === "ar" ? "، " : ", ";
  const entity = name(`structures.${card.structureCode}`, card.structureCode) + sep + name(`materials.${card.materialCode}`, card.materialCode);
  return { title: `${entity} · ${section}` };
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
  return <RateCardForm key={card.updatedAt} card={card} offeredFinishes={caps?.finishes ?? []} models={modelsForCard(card.structureCode, card.materialCode)} listed={caps?.models ?? []} />;
}
