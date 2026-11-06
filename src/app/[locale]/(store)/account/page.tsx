import type { Metadata } from "next";
import Link from "next/link";
import { getT, toLocale } from "@/i18n";
import type { DictKey } from "@/i18n";
import { db } from "@/lib/db";
import { fromJson } from "@/lib/json";
import { requireUser } from "@/lib/auth/session";
import { formatDate, formatDateTime, formatDims, formatMoney } from "@/lib/format";
import type { Dims, OrderStatus } from "@/types";
import { Badge, Button, Card, EmptyBoxIllustration, EmptyState, Layout, LayoutSection, Text, Thumbnail } from "@/components/ui";
import { designHref } from "@/components/store/catalog";
import type { DataRequestStatus } from "@/components/store/account-logic";
import { statusBadge } from "@/lib/orders/state";
import { AccountSignOut, DataRights, DeleteDesignButton, MarketingConsent, ProfileForm } from "./AccountClient";
import styles from "@/components/store/store.module.css";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = toLocale((await params).locale);
  return { title: getT(locale)("account.title"), robots: { index: false, follow: false } };
}

/** Buyer account: saved designs, orders, profile, consent management and PDPL data rights. */
export default async function AccountPage({ params }: Props) {
  const locale = toLocale((await params).locale);
  const session = await requireUser(locale, `/${locale}/account`);
  const t = getT(locale);

  const [user, designs, orderCount, orders, consents, pendingDelete] = await Promise.all([
    db.user.findUnique({ where: { id: session.id }, select: { name: true, email: true, phone: true, marketingConsent: true } }),
    db.design.findMany({ where: { ownerId: session.id }, orderBy: { updatedAt: "desc" }, take: 50 }),
    db.order.count({ where: { buyerId: session.id } }),
    db.order.findMany({ where: { buyerId: session.id }, orderBy: { placedAt: "desc" }, take: 3, select: { id: true, number: true, status: true, totalPiasters: true, placedAt: true } }),
    db.consent.findMany({ where: { userId: session.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.dataRequest.findFirst({ where: { userId: session.id, kind: "DELETE", status: { in: ["OPEN", "IN_PROGRESS"] } }, orderBy: { createdAt: "desc" } }),
  ]);
  const name = user?.name ?? session.name;

  return (
    <div className={styles.page}>
      <div className={styles.stack}>
        <div className={styles.sectionHead}>
          <div className={styles.headerBlock}>
            <h1 className={styles.pageTitle}>{t("account.title")}</h1>
            <Text as="p" tone="subdued">
              {name ? t("account.greeting", { name }) : t("account.greetingNoName")}
            </Text>
            {!name ? (
              <Text as="p" variant="bodySm" tone="subdued">
                {t("buyer.addName")}
              </Text>
            ) : null}
          </div>
          <AccountSignOut />
        </div>

        <Layout>
          <LayoutSection>
            <div className={styles.stack}>
              <Card
                title={t("account.designsTitle")}
                as="section"
                headerActions={
                  <Button url={designHref(locale)} variant="plain">
                    {t("account.startDesign")}
                  </Button>
                }
              >
                {designs.length ? (
                  <ul className={styles.plainList} data-testid="saved-designs">
                    {designs.map((d) => {
                      const dims = fromJson<Dims>(d.dims);
                      const label = d.name || t("account.untitled");
                      return (
                        <li key={d.id} className={styles.designRow}>
                          <Thumbnail source={d.thumbnailUrl ?? undefined} alt="" size="small" />
                          <div className={styles.designMain}>
                            <Text as="span" fontWeight="semibold" truncate>
                              {label}
                            </Text>
                            <Text as="span" variant="bodySm" tone="subdued">
                              {t(`structures.${d.structureCode}` as DictKey)} · {formatDims(dims, locale)}
                            </Text>
                            <Text as="span" variant="bodySm" tone="subdued">
                              {t("account.edited", { date: formatDate(d.updatedAt, locale) })}
                            </Text>
                          </div>
                          <div className={styles.designActions}>
                            <Button url={designHref(locale, { design: d.id })} size="slim" variant="plain" accessibilityLabel={`${t("account.openDesign")}: ${label}`}>
                              {t("account.openDesign")}
                            </Button>
                            <Button url={`/${locale}/checkout/${encodeURIComponent(d.id)}`} size="slim" accessibilityLabel={`${t("buyer.order")}: ${label}`}>
                              {t("buyer.order")}
                            </Button>
                            <DeleteDesignButton id={d.id} name={label} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <EmptyState
                    heading={t("account.designsEmpty")}
                    headingAs="h3"
                    compact
                    image={<EmptyBoxIllustration size={80} />}
                    action={<Button url={designHref(locale, { structure: "FEFCO_0427" })} variant="primary">{t("account.startDesign")}</Button>}
                  >
                    {t("account.designsEmptyBody")}
                  </EmptyState>
                )}
              </Card>

              <Card
                title={t("account.ordersTitle")}
                as="section"
                headerActions={
                  <Button url={`/${locale}/orders`} variant="plain">
                    {t("account.viewOrders")}
                  </Button>
                }
              >
                {orders.length ? (
                  <ul className={styles.plainList}>
                    {orders.map((o) => (
                      <li key={o.id} className={styles.designRow}>
                        <div className={styles.designMain}>
                          <Link href={`/${locale}/orders/${o.id}`}>
                            <bdi>{o.number}</bdi>
                          </Link>
                          <Text as="span" variant="bodySm" tone="subdued">
                            {formatDate(o.placedAt, locale)} · <bdi>{formatMoney(o.totalPiasters, locale)}</bdi>
                          </Text>
                        </div>
                        <Badge tone={statusBadge(o.status as OrderStatus).tone} progress={statusBadge(o.status as OrderStatus).progress}>
                          {t(`orderStatus.${o.status}` as DictKey)}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Text as="p" tone="subdued">
                    {t("account.ordersNone")}
                  </Text>
                )}
                {orderCount > orders.length ? (
                  <Text as="p" variant="bodySm" tone="subdued">
                    {t("account.ordersCount", { count: orderCount })}
                  </Text>
                ) : null}
              </Card>

              <Card title={t("account.consentTitle")} as="section">
                <div className={styles.prose}>
                  <Text as="p" tone="subdued">
                    {t("account.consentIntro")}
                  </Text>
                  <MarketingConsent granted={!!user?.marketingConsent} />
                  {consents.length ? (
                    <>
                      <Text as="h3" variant="headingSm">
                        {t("account.consentHistory")}
                      </Text>
                      <ul className={styles.historyList}>
                        {consents.map((c) => (
                          <li key={c.id}>
                            <span>
                              {t(`account.consentKind.${c.kind}` as DictKey)}:{" "}
                              <strong>{c.granted ? t("account.granted") : t("account.withdrawn")}</strong>
                            </span>
                            <Text as="span" variant="bodySm" tone="subdued">
                              {formatDateTime(c.createdAt, locale)}
                            </Text>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </div>
              </Card>

              <Card title={t("account.dataTitle")} as="section">
                <div className={styles.prose}>
                  <Text as="p" tone="subdued">
                    {t("account.dataIntro")}
                  </Text>
                  <DataRights
                    pending={pendingDelete ? { status: pendingDelete.status as DataRequestStatus, createdAt: pendingDelete.createdAt.toISOString() } : null}
                  />
                </div>
              </Card>
            </div>
          </LayoutSection>

          <LayoutSection variant="oneThird" as="aside" aria-label={t("account.profileTitle")}>
            <Card title={t("account.profileTitle")} as="section">
              <ProfileForm name={user?.name ?? ""} email={user?.email ?? ""} phone={user?.phone ?? session.phone} />
            </Card>
          </LayoutSection>
        </Layout>
      </div>
    </div>
  );
}
