import type { Metadata } from "next";
import { cache } from "react";
import { getT, toLocale } from "@/i18n";
import { getSession } from "@/lib/auth/session";
import type { DictKey } from "@/i18n/types";
import { formatDims, formatMoney } from "@/lib/format";
import { quoteDesign, tierPrices } from "@/lib/orders/service";
import { loadCheckoutSettings } from "@/lib/orders/checkout-settings";
import { Badge } from "@/components/ui/Badge";
import { BlockStack, InlineStack } from "@/components/ui/Stack";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState, EmptyBoxIllustration } from "@/components/ui/EmptyState";
import { Layout, LayoutSection } from "@/components/ui/Layout";
import { Page } from "@/components/ui/Page";
import { Text } from "@/components/ui/Text";
import { SharedViewerLazy } from "./SharedViewerLazy";
import { inlinePublicImage } from "@/app/model-poster";
import styles from "./share.module.css";
import { designerPath } from "@/components/designer/lib/catalog";
import { loadSharedDesign } from "@/components/designer/server";
import { modelByCode } from "@/lib/library";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { ANON_COOKIE } from "@/lib/auth/constants";
import { track } from "@/lib/analytics/track";
import { rateLimit } from "@/lib/rate-limit";
import { ORDER_MODE_COPY, orderModeOf, type OrderModeReason } from "@/data/catalogue/order-mode";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string; id: string }>;

const getShared = cache((token: string) => loadSharedDesign(token));

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale: l, id } = await params;
  const locale = toLocale(l);
  const t = getT(locale);
  const shared = await getShared(id);
  const name = shared ? shared.doc.name.trim() || t(`structures.${shared.doc.structureCode}` as DictKey) : t("designer.shared.notFoundTitle");
  return { title: name, description: t("designer.shared.ctaHelp"), robots: { index: false, follow: false } };
}

/** Read-only share link: 3D preview + specs + "Order this box". */
export default async function SharedDesignPage({ params }: { params: Params }) {
  const { locale: l, id } = await params;
  const locale = toLocale(l);
  const t = getT(locale);
  const [shared, session] = await Promise.all([getShared(id), getSession()]);

  if (!shared) {
    return (
      <Page narrowWidth title={t("designer.shared.notFoundTitle")}>
        <Card>
          <EmptyState
            heading={t("designer.shared.notFoundTitle")}
            image={<EmptyBoxIllustration />}
            action={
              <Button variant="primary" url={`/${locale}/design`}>
                {t("designer.shared.copyDesign")}
              </Button>
            }
          >
            <p>{t("designer.shared.notFoundBody")}</p>
          </EmptyState>
        </Card>
      </Page>
    );
  }

  const { doc, designId } = shared;
  // The owner opening their own link orders the original; nobody else gets a copy notice wrong.
  const isOwner = session
    ? (await db.design.findUnique({ where: { id: designId }, select: { ownerId: true } }))?.ownerId === session.user.id
    : false;
  // launch-metrics.md §1 `share_link_visit` (the owner opening their own link is not a visit).
  // "returning" = the browser already had an Elba id (account session or anonymous designer cookie).
  if (!isOwner) {
    const rawAnon = (await cookies()).get(ANON_COOKIE)?.value ?? null;
    const anonId = rawAnon && /^[\w-]{16,64}$/.test(rawAnon) ? rawAnon : null;
    const who = session?.user.id ?? anonId;
    if (!who || rateLimit("analytics:share_visit", `${who}:${designId}`, 1, 1_800_000).ok) {
      void track(
        "share_link_visit",
        { locale, returning: !!(session || anonId), structure_code: doc.structureCode, referrer_type: "share_link" },
        { userId: session?.user.id ?? null, anonId, designId },
      );
    }
  }
  // The library model (aseptic brick, crash-lock…), not only the base structure it is priced as.
  const lib = modelByCode(doc.modelCode ?? doc.structureCode);
  const modelCode = lib?.code ?? doc.structureCode;
  const styleName = lib?.name[locale] ?? t(`structures.${doc.structureCode}` as DictKey);
  const name = doc.name.trim() || styleName;
  // B-16: a model no Egyptian SME printer makes is requested by quote, never "Order this box".
  const isVessel = lib?.kind === "vessel";
  // R4-12: the visitor sees the price before being asked to sign in, the same figure checkout
  // shows for 500 boxes (best match, prepay discount, delivery to Greater Cairo, excl. VAT).
  const [{ price, quoteReason }, { prepayDiscountPct }] = await Promise.all([sharePrice(doc), loadCheckoutSettings()]);
  // R6-05: also a special-gluing model that no printer lists yet (the engine says "by quote").
  const order = orderModeOf(doc.modelCode);
  const reason = order.mode === "quote" || order.mode === "preview" ? order.reason : quoteReason;
  const byQuote = !!reason;
  const specs: [string, string][] = [
    [t("designer.shared.style"), styleName],
    [t("designer.shared.model"), modelCode.replace(/_/g, " ")],
    // Containers: their own size (Ø × H, or W × G × H for pouches), not the box dims of the label
    // sheet ("100 × 1 × 100 mm"), and "print material" rather than "board".
    doc.vessel
      ? [t("designer.shared.sizeVessel"), vesselSize(doc.vessel.dims, t("common.mm"))]
      : [t("designer.shared.size"), formatDims(doc.dims, locale)],
    [t(doc.vessel ? "designer.shared.printMaterial" : "designer.shared.board"), t(`materials.${doc.materialCode}` as DictKey)],
    [t("designer.shared.finish"), t(`finishes.${doc.finishCode}` as DictKey)],
    [t("designer.shared.printing"), doc.printSides === "BOTH" ? t("designer.box.printBoth") : t("designer.box.printOutside")],
  ];

  return (
    <Page title={name} subtitle={t(isVessel ? "designer.shared.subtitleDesign" : "designer.shared.subtitle")} titleMetadata={<Badge tone="info">{styleName}</Badge>}>
      <Layout>
        <LayoutSection>
          <SharedViewerLazy doc={doc} poster={inlinePublicImage(`/models/${encodeURIComponent(modelCode)}.webp`)} />
        </LayoutSection>
        <LayoutSection variant="oneThird" as="aside">
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="300">
                {price ? (
                  <p className={styles.price} data-testid="share-price">
                    {price.prepayPct > 0
                      ? t("buyer.sharePricePrepay", { qty: price.quantity, price: formatMoney(price.unitPiasters, locale), days: price.days, pct: price.prepayPct })
                      : t("buyer.sharePrice", { qty: price.quantity, price: formatMoney(price.unitPiasters, locale), days: price.days })}
                  </p>
                ) : null}
                {/* R5-JR-15: this unit is after the prepay discount (tierPrices), the designer's badge is
                    before it; say which, so the two numbers read as one price. */}
                {price && prepayDiscountPct > 0 ? (
                  <Text as="p" variant="bodySm" tone="subdued">
                    {t("designer.shared.prepayNote", { pct: prepayDiscountPct })}
                  </Text>
                ) : null}
                <Text as="p">{reason ? ORDER_MODE_COPY[reason][locale] : t("designer.shared.ctaHelp")}</Text>
                <Button variant="primary" fullWidth url={`/${locale}/checkout/${encodeURIComponent(designId)}?share=${encodeURIComponent(id)}&model=${encodeURIComponent(modelCode)}`}>
                  {byQuote ? t("designer.price.quoteAction") : isVessel ? t("designer.container.order") : t("designer.shared.cta")}
                </Button>
                <Text as="p" variant="bodySm" tone="subdued">
                  {isOwner ? t("buyer.shareOwner") : <>{t("buyer.shareOwnCopy")} {session ? null : t("buyer.shareSignIn")}</>}
                </Text>
                <Button fullWidth url={isOwner ? designerPath(locale, modelCode, { d: designId }) : designerPath(locale, modelCode)}>
                  {isOwner ? t("account.openDesign") : t("designer.shared.copyDesign")}
                </Button>
              </BlockStack>
            </Card>
            <Card title={t("designer.shared.specs")}>
              <BlockStack as="dl" gap="200">
                {specs.map(([k, v]) => (
                  <InlineStack key={k} as="div" align="space-between" gap="200" wrap>
                    <Text as="dt" tone="subdued">
                      {k}
                    </Text>
                    <Text as="dd" fontWeight="medium">
                      {v}
                    </Text>
                  </InlineStack>
                ))}
              </BlockStack>
            </Card>
          </BlockStack>
        </LayoutSection>
      </Layout>
    </Page>
  );
}

const SHARE_PRICE_QTY = 500;

/** "Ø 66 × 210 mm" (round) or "120 × 60 × 200 mm" (with a gusset), isolated left to right. */
function vesselSize(d: { D: number; H: number; G?: number }, mm: string): string {
  const n = (v: number) => String(Math.round(v * 10) / 10);
  const body = d.G ? `${n(d.D)} × ${n(d.G)} × ${n(d.H)}` : `Ø ${n(d.D)} × ${n(d.H)}`;
  return `\u2066${body}\u2069 ${mm}`;
}

/** Headline price for the share page, or null when the box has no instant price (quote only). */
async function sharePrice(doc: Parameters<typeof quoteDesign>[0]): Promise<{ price: { quantity: number; unitPiasters: number; days: number; prepayPct: number } | null; quoteReason: OrderModeReason | null }> {
  try {
    const [tiers, outcome, settings] = await Promise.all([tierPrices(doc), quoteDesign(doc, { quantity: SHARE_PRICE_QTY }), loadCheckoutSettings()]);
    const unit = tiers.find((x) => x.quantity === SHARE_PRICE_QTY)?.unitPiasters ?? null;
    const best = outcome.mode === "instant" ? outcome.offers[0] : null;
    const quoteReason = outcome.mode === "manual_quote" && outcome.reason === "MODEL_BY_QUOTE" ? (outcome.orderReason ?? "QUOTE_ONLY_STOCK") : null;
    return { price: unit !== null && best ? { quantity: SHARE_PRICE_QTY, unitPiasters: unit, days: best.deliveryDays, prepayPct: settings.prepayDiscountPct } : null, quoteReason };
  } catch {
    return { price: null, quoteReason: null };
  }
}
