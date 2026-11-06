import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BlockStack, Card, InlineStack, Layout, LayoutSection, Link, Page, Text } from "@/components/ui";
import { ApplicationReview } from "@/components/admin/VendorActions";
import { ApplicationStatusBadge } from "@/components/admin/VendorsIndex";
import { adminStyles } from "@/components/admin/charts";
import { loadApplication } from "@/components/admin/server/queries";
import { decodeReviewNote } from "@/components/admin/lib/ops";
import { getT, toLocale, type DictKey } from "@/i18n";
import { fromJson } from "@/lib/json";
import { formatDate, formatDateTime } from "@/lib/format";
import type { VendorApplicationDocument } from "@/types";

type Params = Promise<{ locale: string; id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const t = getT(toLocale((await params).locale));
  return { title: `${t("admin.vendors.tabs.applications")} · ${t("admin.title")}` };
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <BlockStack gap="050">
      <Text as="dt" variant="bodySm" tone="subdued">
        {label}
      </Text>
      <Text as="dd">{children}</Text>
    </BlockStack>
  );
}

export default async function AdminApplicationPage({ params }: { params: Params }) {
  const { locale: raw, id } = await params;
  const locale = toLocale(raw);
  const t = getT(locale);
  const base = `/${locale}/admin`;
  const data = await loadApplication(id);
  if (!data) notFound();
  const { app, vendor, applicant } = data;
  const docs = fromJson<VendorApplicationDocument[]>(app.documents) ?? [];
  const review = decodeReviewNote(app.reviewNote);

  return (
    <Page
      title={t("admin.application.title", { name: app.legalName })}
      titleMetadata={<ApplicationStatusBadge status={app.status} />}
      subtitle={`${t("admin.application.submitted", { date: formatDateTime(app.createdAt, locale) })}${app.reviewedAt ? ` · ${t("admin.application.decision.decided", { date: formatDate(app.reviewedAt, locale, "medium") })}` : ""}`}
      backAction={{ content: t("admin.application.back"), url: `${base}/vendors?tab=applications` }}
    >
      <Layout>
        <LayoutSection>
          <BlockStack gap="400">
            <Card title={t("admin.application.company")}>
              <BlockStack as="dl" gap="300" className={adminStyles.PlainList}>
                  <Field label={t("admin.application.fields.legalName")}>{app.legalName}</Field>
                  <Field label={t("admin.application.fields.commercialRegister")}>
                    <bdi dir="ltr">{app.commercialRegisterNo}</bdi>
                  </Field>
                  <Field label={t("admin.application.fields.taxCard")}>
                    <bdi dir="ltr">{app.taxCardNo}</bdi>
                  </Field>
                  <Field label={t("admin.application.fields.address")}>{app.factoryAddress}</Field>
                  <Field label={t("admin.application.fields.city")}>{t(`cities.${app.factoryCity}` as DictKey)}</Field>
              </BlockStack>
            </Card>
            <Card title={t("admin.application.documents")}>
              {docs.length ? (
                <BlockStack gap="200" as="ul">
                  {docs.map((d) => (
                    <li key={d.key}>
                      <InlineStack gap="200" blockAlign="center">
                        <Text as="span" fontWeight="semibold">
                          {t(`admin.application.docKinds.${d.kind}` as DictKey)}
                        </Text>
                        <Link url={`/api/vendor/files/${d.key}`} external>
                          {d.name}
                        </Link>
                      </InlineStack>
                    </li>
                  ))}
                </BlockStack>
              ) : (
                <Text as="p" tone="subdued">
                  {t("admin.application.noDocuments")}
                </Text>
              )}
            </Card>
            {app.message ? (
              <Card title={t("admin.application.message")}>
                <Text as="p">
                  <span className={adminStyles.PreWrap}>{app.message}</span>
                </Text>
              </Card>
            ) : null}
            <ApplicationReview applicationId={app.id} status={app.status} initialChecklist={review.checklist} initialNote={review.note} />
          </BlockStack>
        </LayoutSection>
        <LayoutSection variant="oneThird" as="aside">
          <BlockStack gap="400">
            <Card title={t("admin.application.contact")}>
              <BlockStack as="dl" gap="300" className={adminStyles.PlainList}>
                  <Field label={t("admin.application.fields.contactName")}>{app.contactName}</Field>
                  <Field label={t("admin.application.fields.contactPhone")}>
                    <bdi dir="ltr">{app.contactPhone}</bdi>
                  </Field>
                  {applicant ? (
                    <Field label={t("admin.application.fields.applicant")}>
                      <Link url={`${base}/users/${applicant.id}`}>{applicant.name ?? applicant.phone}</Link>
                    </Field>
                  ) : null}
              </BlockStack>
            </Card>
            {vendor ? (
              <Card title={t("admin.order.vendorCard.title")}>
                <Link url={`${base}/vendors/${vendor.slug}`}>{locale === "ar" ? vendor.nameAr : vendor.nameEn}</Link>
              </Card>
            ) : null}
          </BlockStack>
        </LayoutSection>
      </Layout>
    </Page>
  );
}
