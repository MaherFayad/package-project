import type { Metadata } from "next";
import { getT, toLocale, type DictKey } from "@/i18n";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { fromJson } from "@/lib/json";
import { formatDate, formatDims } from "@/lib/format";
import type { Dims, StructureCode } from "@/types";
import { designerPath } from "@/components/designer/lib/catalog";
import { modelPoster } from "@/lib/orders/poster";
import { BlockStack, Button, Card, EmptyState, EmptyBoxIllustration, InlineStack, Page, Text, Thumbnail } from "@/components/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getT(toLocale(locale))("checkout.start.title"), robots: { index: false } };
}

/** /[locale]/checkout — pick one of your saved designs to order. */
export default async function CheckoutStartPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const user = await requireUser(locale, `/${locale}/checkout`);
  const designs = await db.design.findMany({
    where: { ownerId: user.id },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, name: true, structureCode: true, modelCode: true, dims: true, thumbnailUrl: true, updatedAt: true },
  });

  return (
    <Page title={t("checkout.start.title")} subtitle={t("checkout.start.subtitle")}>
      {designs.length === 0 ? (
        <Card>
          <EmptyState
            heading={t("checkout.start.emptyTitle")}
            image={<EmptyBoxIllustration />}
            action={
              <Button variant="primary" url={`/${locale}/design`}>
                {t("checkout.start.openDesigner")}
              </Button>
            }
          >
            {t("checkout.start.emptyBody")}
          </EmptyState>
        </Card>
      ) : (
        <BlockStack gap="300">
          {designs.map((d) => {
            const code = d.structureCode as StructureCode;
            const name = d.name || t("checkout.untitled");
            return (
              <Card key={d.id}>
                <InlineStack gap="300" blockAlign="center" align="space-between">
                  <InlineStack gap="300" blockAlign="center" wrap={false}>
                    <Thumbnail source={d.thumbnailUrl ?? modelPoster(d.modelCode, d.structureCode)} alt={name} size="medium" />
                    <BlockStack gap="050">
                      <Text as="h2" variant="headingSm">
                        {name}
                      </Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        {t(`structures.${code}` as DictKey)} · {formatDims(fromJson<Dims>(d.dims), locale)}
                      </Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        {t("checkout.start.updated", { date: formatDate(d.updatedAt, locale) })}
                      </Text>
                    </BlockStack>
                  </InlineStack>
                  <InlineStack gap="200">
                    <Button variant="plain" url={designerPath(locale, code, { d: d.id })}>
                      {t("checkout.proof.edit")}
                    </Button>
                    <Button variant="primary" url={`/${locale}/checkout/${d.id}`}>
                      {t("checkout.start.orderThis")}
                    </Button>
                  </InlineStack>
                </InlineStack>
              </Card>
            );
          })}
        </BlockStack>
      )}
    </Page>
  );
}
