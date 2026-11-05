import { Button, Card, EmptyBoxIllustration, EmptyState, Page } from "@/components/ui";
import { JobDetail } from "@/components/vendor/JobDetail";
import { requireVendorContext } from "@/components/vendor/server/context";
import { getJob } from "@/components/vendor/server/queries";
import { getT, pick, toLocale } from "@/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; number: string }> }) {
  const { locale, number } = await params;
  const t = getT(toLocale(locale));
  return { title: `${t("vendorPortal.job.title", { number: decodeURIComponent(number) })} · ${t("vendorPortal.title")}` };
}

export default async function JobPage({ params }: { params: Promise<{ locale: string; number: string }> }) {
  const p = await params;
  const locale = toLocale(p.locale);
  const number = decodeURIComponent(p.number).slice(0, 40);
  const t = getT(locale);
  const { vendor } = await requireVendorContext(locale, `/${locale}/vendor/jobs/${encodeURIComponent(number)}`);
  if (!vendor || vendor.status === "PENDING") return null;
  const job = await getJob(vendor.id, number);
  if (!job) {
    return (
      <Page narrowWidth title={t("vendorPortal.job.notFoundTitle")} backAction={{ content: t("vendorPortal.job.back"), url: `/${locale}/vendor/jobs` }}>
        <Card>
          <EmptyState
            heading={t("vendorPortal.job.notFoundTitle")}
            image={<EmptyBoxIllustration />}
            action={<Button url={`/${locale}/vendor/jobs`}>{t("vendorPortal.dashboard.viewAll")}</Button>}
          >
            {t("vendorPortal.job.notFoundBody")}
          </EmptyState>
        </Card>
      </Page>
    );
  }
  return <JobDetail job={job} vendorName={pick(locale, vendor.nameAr, vendor.nameEn)} />;
}
