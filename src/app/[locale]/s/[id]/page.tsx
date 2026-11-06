import type { Metadata } from "next";
import { cache } from "react";
import { getT, toLocale } from "@/i18n";
import { getSession } from "@/lib/auth/session";
import type { DictKey } from "@/i18n/types";
import { formatDims, formatMoney } from "@/lib/format";
import { quoteDesign, tierPrices } from "@/lib/orders/service";
import { Badge, BlockStack, Button, Card, EmptyState, EmptyBoxIllustration, InlineStack, Layout, LayoutSection, Page, Text } from "@/components/ui";
import { SharedViewerLazy } from "./SharedViewerLazy";
import styles from "./share.module.css";
import { designerPath } from "@/components/designer/lib/catalog";
import { loadSharedDesign } from "@/components/designer/server";
import { modelByCode } from "@/lib/library";
import { docModelCode } from "@/lib/library/doc";
import { orderModeOf } from "@/data/catalogue/order-mode";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { ANON_COOKIE } from "@/lib/auth/constants";
import { track } from "@/lib/analytics/track";
import { rateLimit } from "@/lib/rate-limit";

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
  // R4-B-01 (designer half): the page names and links the library model, not its base structure,
  // so the visitor sees (and forks) the aseptic brick, crash-lock or bottle that was shared.
  const modelCode = docModelCode(doc);
  const libModel = modelByCode(modelCode);
  const styleName = libModel?.name[locale] ?? t(`structures.${doc.structureCode}` as DictKey);
  const isVessel = libModel?.kind === "vessel";
  const byQuote = ["quote", "preview"].includes(orderModeOf(modelCode).mode);
  const ctaLabel = byQuote ? t("designer.price.quoteAction") : isVessel ? t("designer.container.order") : t("designer.shared.cta");
  const name = doc.name.trim() || styleName;
  // R4-12: the visitor sees the price before being asked to sign in, the same figure checkout
  // shows for 500 boxes (best match, prepay discount, delivery to Greater Cairo, excl. VAT).
  const price = await sharePrice(doc);
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
          <SharedViewerLazy doc={doc} poster={`/models/${libModel?.slug ?? "mailer-box"}.svg`} />
        </LayoutSection>
        <LayoutSection variant="oneThird" as="aside">
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="300">
                {price ? (
                  <p className={styles.price} data-testid="share-price">
                    {t("buyer.sharePrice", { qty: price.quantity, price: formatMoney(price.unitPiasters, locale), days: price.days })}
                  </p>
                ) : null}
                <Text as="p">{t("designer.shared.ctaHelp")}</Text>
                {/* The model travels with the fork request; checkout re-checks it against the saved design. */}
                <Button
                  variant="primary"
                  fullWidth
                  url={`/${locale}/checkout/${encodeURIComponent(designId)}?share=${encodeURIComponent(id)}&model=${encodeURIComponent(modelCode)}`}>
                  {ctaLabel}
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
async function sharePrice(doc: Parameters<typeof quoteDesign>[0]): Promise<{ quantity: number; unitPiasters: number; days: number } | null> {
  try {
    const [tiers, outcome] = await Promise.all([tierPrices(doc), quoteDesign(doc, { quantity: SHARE_PRICE_QTY })]);
    const unit = tiers.find((x) => x.quantity === SHARE_PRICE_QTY)?.unitPiasters ?? null;
    const best = outcome.mode === "instant" ? outcome.offers[0] : null;
    return unit !== null && best ? { quantity: SHARE_PRICE_QTY, unitPiasters: unit, days: best.deliveryDays } : null;
  } catch {
    return null;
  }
}
