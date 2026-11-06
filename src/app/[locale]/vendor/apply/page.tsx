import type { Metadata } from "next";
import { Badge, BlockStack, Button, Card, InlineStack, Layout, LayoutSection, Text } from "@/components/ui";
import { ApplyForm } from "@/components/vendor/ApplyForm";
import styles from "@/components/vendor/vendor.module.css";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { formatEgyptPhone } from "@/lib/phone";
import { getT, toLocale, type DictKey } from "@/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  return {
    title: `${t("vendorPortal.apply.title")} · ${t("meta.siteName")}`,
    description: t("vendorPortal.apply.subtitle"),
    alternates: { languages: { ar: "/ar/vendor/apply", en: "/en/vendor/apply" } },
  };
}

const STATUS_TONE = { SUBMITTED: "info", UNDER_REVIEW: "attention", APPROVED: "success", REJECTED: "critical" } as const;

export default async function ApplyPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const session = await getSession();
  const user = session?.user ?? null;
  const application = user ? await db.vendorApplication.findFirst({ where: { applicantId: user.id }, orderBy: { createdAt: "desc" } }) : null;
  const next = encodeURIComponent(`/${locale}/vendor/apply`);

  let main: React.ReactNode;
  if (!user) {
    main = (
      <Card title={t("vendorPortal.apply.signInTitle")}>
        <BlockStack gap="300">
          <Text as="p">{t("vendorPortal.apply.signInBody")}</Text>
          <InlineStack>
            <Button variant="primary" url={`/${locale}/login?next=${next}`}>
              {t("vendorPortal.apply.signIn")}
            </Button>
          </InlineStack>
        </BlockStack>
      </Card>
    );
  } else if (user.vendorId || user.role === "VENDOR") {
    main = (
      <Card title={t("vendorPortal.apply.alreadyVendorTitle")}>
        <BlockStack gap="300">
          <Text as="p">{t("vendorPortal.apply.alreadyVendorBody")}</Text>
          <InlineStack>
            <Button variant="primary" url={`/${locale}/vendor`}>
              {t("vendorPortal.apply.goToPortal")}
            </Button>
          </InlineStack>
        </BlockStack>
      </Card>
    );
  } else if (application && application.status !== "REJECTED") {
    main = (
      <Card title={t("vendorPortal.apply.statusTitle")}>
        <BlockStack gap="300" >
          <div role="status">
            <BlockStack gap="200">
              <InlineStack gap="200" blockAlign="center">
                <Text as="h2" variant="headingMd">
                  {t("vendorPortal.apply.submittedTitle")}
                </Text>
                <Badge tone={STATUS_TONE[application.status as keyof typeof STATUS_TONE] ?? "info"} progress={application.status === "APPROVED" ? "complete" : "incomplete"}>
                  {t(`vendorPortal.apply.statuses.${application.status}` as DictKey)}
                </Badge>
              </InlineStack>
              <Text as="p">{t("vendorPortal.apply.submittedBody", { phone: `\u2066${formatEgyptPhone(application.contactPhone)}\u2069` })}</Text>
              <Text as="p" tone="subdued" variant="bodySm">
                {t("vendorPortal.apply.submittedOn", { date: formatDate(application.createdAt, locale) })}
              </Text>
              {application.reviewNote ? <Text as="p">{t("vendorPortal.apply.reviewNote", { note: application.reviewNote })}</Text> : null}
            </BlockStack>
          </div>
        </BlockStack>
      </Card>
    );
  } else {
    main = (
      <BlockStack gap="400">
        {application?.status === "REJECTED" && application.reviewNote ? (
          <Card>
            <Text as="p">{t("vendorPortal.apply.reviewNote", { note: application.reviewNote })}</Text>
          </Card>
        ) : null}
        <ApplyForm defaultName={user.name ?? ""} defaultPhone={formatEgyptPhone(user.phone)} />
      </BlockStack>
    );
  }

  return (
    <div className={styles.Apply}>
      <BlockStack gap="600">
        <BlockStack gap="200">
          <Text as="h1" variant="headingXl">
            {t("vendorPortal.apply.title")}
          </Text>
          <Text as="p" variant="bodyLg" tone="subdued">
            {t("vendorPortal.apply.subtitle")}
          </Text>
        </BlockStack>
        <Layout>
          <LayoutSection>{main}</LayoutSection>
          <LayoutSection variant="oneThird" as="aside" aria-label={t("vendorPortal.apply.benefitsTitle")}>
            <BlockStack gap="400">
              <Card title={t("vendorPortal.apply.benefitsTitle")}>
                <ul className={styles.Steps}>
                  <li>{t("vendorPortal.apply.benefits.prepaid")}</li>
                  <li>{t("vendorPortal.apply.benefits.files")}</li>
                  <li>{t("vendorPortal.apply.benefits.demand")}</li>
                </ul>
              </Card>
              <Card title={t("vendorPortal.apply.stepsTitle")}>
                <ol className={styles.Steps}>
                  <li>{t("vendorPortal.apply.steps.apply")}</li>
                  <li>{t("vendorPortal.apply.steps.visit")}</li>
                  <li>{t("vendorPortal.apply.steps.live")}</li>
                </ol>
              </Card>
            </BlockStack>
          </LayoutSection>
        </Layout>
      </BlockStack>
    </div>
  );
}
