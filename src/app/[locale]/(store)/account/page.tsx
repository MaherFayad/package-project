import type { Metadata } from "next";
import Link from "next/link";
import { getT, toLocale } from "@/i18n";
import type { DictKey } from "@/i18n";
import { db } from "@/lib/db";
import { fromJson } from "@/lib/json";
import { requireUser } from "@/lib/auth/session";
import { formatDate, formatDateTime, formatDims, formatMoney } from "@/lib/format";
import type { Dims, OrderStatus } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyBoxIllustration, EmptyState } from "@/components/ui/EmptyState";
import { Layout, LayoutSection } from "@/components/ui/Layout";
import { Text } from "@/components/ui/Text";
import { Thumbnail } from "@/components/ui/Thumbnail";
import { designHref } from "@/components/store/catalog";
import type { DataRequestStatus } from "@/components/store/account-logic";
import { modelPoster } from "@/lib/orders/poster";
import { statusTone } from "@/lib/orders/status-tone";
import { AccountSignOut, DataRights, DeleteDesignButton, MarketingConsent, ProfileForm } from "./AccountClient";
import styles from "@/components/store/store.module.css";
import accountStyles from "./account.module.css";
import { formatEgyptPhone } from "@/lib/phone";
import { QUOTE_PRICED, QUOTE_REQUESTED, quoteCheckoutPath } from "@/lib/orders/quote-status";

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

  const [user, designs, orderCount, orders, consents, pendingDelete, quoteRows] = await Promise.all([
    db.user.findUnique({ where: { id: session.id }, select: { name: true, email: true, phone: true, marketingConsent: true } }),
    db.design.findMany({ where: { ownerId: session.id }, orderBy: { updatedAt: "desc" }, take: 50 }),
    db.order.count({ where: { buyerId: session.id } }),
    db.order.findMany({ where: { buyerId: session.id }, orderBy: { placedAt: "desc" }, take: 3, select: { id: true, number: true, status: true, totalPiasters: true, placedAt: true } }),
    db.consent.findMany({ where: { userId: session.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.dataRequest.findFirst({ where: { userId: session.id, kind: "DELETE", status: { in: ["OPEN", "IN_PROGRESS"] } }, orderBy: { createdAt: "desc" } }),
    db.quote.findMany({ where: { userId: session.id, status: { in: [QUOTE_REQUESTED, QUOTE_PRICED] } }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, designId: true, lines: true, createdAt: true, validUntil: true, status: true, totalPiasters: true } }),
  ]);
  // Price requests above the instant cap (CO-06). The quantity is the single line's quantity.
  const now = new Date();
  const quoteRequests = quoteRows.map((q) => {
    const lines = fromJson<{ quantity?: number; name?: { ar?: string; en?: string } }[]>(q.lines);
    const design = designs.find((d) => d.id === q.designId);
    // Catalogue requests (no design) carry the model name (R4-05).
    const modelName = Array.isArray(lines) ? lines[0]?.name?.[locale] : undefined;
    return {
      id: q.id,
      quantity: Array.isArray(lines) ? (lines[0]?.quantity ?? 0) : 0,
      design: design ? design.name || t("account.untitled") : modelName || t("account.untitled"),
      createdAt: q.createdAt,
      open: q.validUntil > now,
      // R4-B-03: the team sent a price; the buyer reviews it and pays in checkout.
      priced: q.status === QUOTE_PRICED && q.validUntil > now ? { total: q.totalPiasters, validUntil: q.validUntil, url: quoteCheckoutPath(locale, q) } : null,
    };
  });
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
                        <li key={d.id} className={`${styles.designRow} ${accountStyles.designRow}`}>
                          <Thumbnail source={d.thumbnailUrl ?? modelPoster(d.modelCode, d.structureCode)} alt="" size="small" />
                          <div className={styles.designMain}>
                            <Text as="span" fontWeight="semibold" breakWord>
                              {label}
                            </Text>
                            <Text as="span" variant="bodySm" tone="subdued">
                              {t(`structures.${d.structureCode}` as DictKey)} · {formatDims(dims, locale)}
                            </Text>
                            <Text as="span" variant="bodySm" tone="subdued">
                              {t("account.edited", { date: formatDate(d.updatedAt, locale) })}
                            </Text>
                          </div>
                          <div className={`${styles.designActions} ${accountStyles.designActions}`}>
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
                            {formatDate(o.placedAt, locale)} · <bdi>{formatMoney(o.totalPiasters, locale, { alwaysDecimals: true })}</bdi>
                          </Text>
                        </div>
                        <Badge tone={statusTone(o.status as OrderStatus).tone} progress={statusTone(o.status as OrderStatus).progress}>
                          {o.status === "PAID" ? t("buyer.awaitingPrinter") : t(`orderStatus.${o.status}` as DictKey)}
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

              {quoteRequests.length ? (
                <section id="quote-requests" aria-labelledby="quote-requests-title" style={{ scrollMarginBlockStart: "calc(var(--p-top-bar-height) + var(--p-space-400))" }}>
                  <Card title={<span id="quote-requests-title">{t("buyer.quote.listTitle")}</span>}>
                    <ul className={styles.plainList}>
                      {quoteRequests.map((q) => (
                        // R5-03: same phone layout as saved designs (actions on their own row).
                        <li key={q.id} className={`${styles.designRow} ${accountStyles.designRow}`}>
                          <div className={styles.designMain}>
                            {/* a11y R5-AX-12: wraps instead of an ellipsis, so 1.4.12 text spacing never hides the design name */}
                            <Text as="span" fontWeight="semibold" breakWord>
                              {t("buyer.quote.listItem", { qty: q.quantity.toLocaleString("en-US"), design: q.design })}
                            </Text>
                            <Text as="span" variant="bodySm" tone="subdued">
                              {q.priced
                                ? t("buyer.quoted.priced", { total: formatMoney(q.priced.total, locale, { alwaysDecimals: true }), qty: q.quantity, date: formatDateTime(q.priced.validUntil, locale) })
                                : t("buyer.quote.listSent", { date: formatDateTime(q.createdAt, locale) })}
                            </Text>
                          </div>
                          {q.priced?.url ? (
                            <div className={`${styles.designActions} ${accountStyles.designActions} ${accountStyles.quoteActions}`}>
                              <Badge tone="success" progress="complete">
                                {t("buyer.quoted.statusPriced")}
                              </Badge>
                              <Button variant="primary" size="slim" url={q.priced.url}>
                                {t("buyer.quoted.action")}
                              </Button>
                            </div>
                          ) : (
                            <Badge tone={q.open ? "attention" : undefined} progress={q.open ? "incomplete" : "complete"}>
                              {q.open ? t("buyer.quote.statusOpen") : t("buyer.quote.statusExpired")}
                            </Badge>
                          )}
                        </li>
                      ))}
                    </ul>
                    <Text as="p" variant="bodySm" tone="subdued">
                      {t("buyer.quote.listHelp")}
                    </Text>
                  </Card>
                </section>
              ) : null}

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
                        {consents.map((c, i) => {
                          // R4-07: a refusal that never followed a "yes" (the unticked marketing box at
                          // sign-up) is "Not given", not "Withdrawn" (PDPL: an accurate record).
                          const wasGiven = consents.slice(i + 1).some((o) => o.kind === c.kind && o.granted);
                          const state = c.granted ? t("account.granted") : wasGiven ? t("account.withdrawn") : t("account.notGiven");
                          return (
                            <li key={c.id} className={accountStyles.historyItem}>
                              <span>
                                {t(`account.consentKind.${c.kind}` as DictKey)}: <strong>{state}</strong>
                              </span>
                              <Text as="span" variant="bodySm" tone="subdued">
                                {formatDateTime(c.createdAt, locale)}
                              </Text>
                            </li>
                          );
                        })}
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
              <ProfileForm name={user?.name ?? ""} email={user?.email ?? ""} phone={formatEgyptPhone(user?.phone ?? session.phone)} />
            </Card>
          </LayoutSection>
        </Layout>
      </div>
    </div>
  );
}
