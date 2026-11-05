import type { ReactNode } from "react";
import type { Metadata } from "next";
import { AppProvider, Banner, BlockStack, Box, Button, Card, EmptyState, EmptyBoxIllustration, Page } from "@/components/ui";
import { VendorFrame } from "@/components/vendor/VendorFrame";
import { requireVendorContext } from "@/components/vendor/server/context";
import { countAwaiting } from "@/components/vendor/server/queries";
import { getT, pick, toLocale } from "@/i18n";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Vendor portal chrome: admin frame (near-black top bar with job search, light-grey side nav,
 * #f1f1f1 canvas). Requires role VENDOR (ADMIN passes); renders the page's single <main id="main">
 * through <Frame>.
 */
export default async function PortalLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const { user, vendor } = await requireVendorContext(locale, `/${locale}/vendor`);
  const awaiting = vendor ? await countAwaiting(vendor.id) : 0;

  let content: ReactNode = children;
  if (!vendor || vendor.status === "PENDING") {
    content = (
      <Page narrowWidth title={t("vendorPortal.title")}>
        <Card>
          <EmptyState
            heading={vendor ? t("vendorPortal.common.pendingTitle") : t("vendorPortal.common.notLinkedTitle")}
            image={<EmptyBoxIllustration />}
            action={vendor ? undefined : <Button variant="primary" url={`/${locale}/vendor/apply`}>{t("vendorPortal.common.applyCta")}</Button>}
          >
            {vendor ? t("vendorPortal.common.pendingBody") : t("vendorPortal.common.notLinkedBody")}
          </EmptyState>
        </Card>
      </Page>
    );
  } else if (vendor.status === "SUSPENDED") {
    content = (
      <BlockStack gap="0">
        <Box paddingInline={{ xs: "400", md: "600" }} paddingBlockStart="400">
          <Banner tone="critical" title={t("vendorPortal.common.suspendedTitle")}>
            {t("vendorPortal.common.suspendedBody")}
          </Banner>
        </Box>
        {children}
      </BlockStack>
    );
  }

  return (
    <AppProvider locale={locale}>
      <VendorFrame
        locale={locale}
        userName={user.name ?? t("vendorPortal.topBar.account")}
        vendor={vendor && vendor.status !== "PENDING" ? { name: pick(locale, vendor.nameAr, vendor.nameEn), slug: vendor.slug, status: vendor.status } : null}
        awaitingCount={awaiting}
      >
        {content}
      </VendorFrame>
    </AppProvider>
  );
}
