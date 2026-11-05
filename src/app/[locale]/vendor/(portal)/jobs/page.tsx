import { Suspense } from "react";
import { JobsIndex } from "@/components/vendor/JobsIndex";
import { requireVendorContext } from "@/components/vendor/server/context";
import { listJobs } from "@/components/vendor/server/queries";
import { getT, toLocale } from "@/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const t = getT(toLocale((await params).locale));
  return { title: `${t("vendorPortal.jobs.title")} · ${t("vendorPortal.title")}` };
}

export default async function JobsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const { vendor } = await requireVendorContext(locale, `/${locale}/vendor/jobs`);
  if (!vendor || vendor.status === "PENDING") return null;
  const jobs = await listJobs(vendor.id);
  return (
    <Suspense>
      <JobsIndex jobs={jobs} />
    </Suspense>
  );
}
