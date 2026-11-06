import type { Metadata } from "next";
import { cache } from "react";
import { getT, toLocale } from "@/i18n";
import { getSession } from "@/lib/auth/session";
import type { DictKey } from "@/i18n/types";
import { formatDims } from "@/lib/format";
import { Badge, BlockStack, Button, Card, EmptyState, EmptyBoxIllustration, InlineStack, Layout, LayoutSection, Page, Text } from "@/components/ui";
import { SharedViewerLazy } from "./SharedViewerLazy";
import { designerPath } from "@/components/designer/lib/catalog";
import { loadSharedDesign } from "@/components/designer/server";
import { modelByCode } from "@/lib/library";
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
  const name = doc.name.trim() || t(`structures.${doc.structureCode}` as DictKey);
  const specs: [string, string][] = [
    [t("designer.shared.style"), t(`structures.${doc.structureCode}` as DictKey)],
    [t("designer.shared.size"), formatDims(doc.dims, locale)],
    [t("designer.shared.board"), t(`materials.${doc.materialCode}` as DictKey)],
    [t("designer.shared.finish"), t(`finishes.${doc.finishCode}` as DictKey)],
    [t("designer.shared.printing"), doc.printSides === "BOTH" ? t("designer.box.printBoth") : t("designer.box.printOutside")],
  ];

  return (
    <Page title={name} subtitle={t("designer.shared.subtitle")} titleMetadata={<Badge tone="info">{t(`structures.${doc.structureCode}` as DictKey)}</Badge>}>
      <Layout>
        <LayoutSection>
          <SharedViewerLazy doc={doc} poster={`/models/${modelByCode(doc.modelCode ?? doc.structureCode)?.slug ?? "mailer-box"}.svg`} />
        </LayoutSection>
        <LayoutSection variant="oneThird" as="aside">
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="300">
                <Text as="p">{t("designer.shared.ctaHelp")}</Text>
                <Button variant="primary" fullWidth url={`/${locale}/checkout/${encodeURIComponent(designId)}?share=${encodeURIComponent(id)}`}>
                  {t("designer.shared.cta")}
                </Button>
                <Text as="p" variant="bodySm" tone="subdued">
                  {isOwner ? t("buyer.shareOwner") : <>{t("buyer.shareOwnCopy")} {session ? null : t("buyer.shareSignIn")}</>}
                </Text>
                <Button fullWidth url={isOwner ? designerPath(locale, doc.structureCode, { d: designId }) : designerPath(locale, doc.structureCode)}>
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
