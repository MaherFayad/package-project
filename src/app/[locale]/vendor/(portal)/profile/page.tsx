import { ProfileForm } from "@/components/vendor/ProfileForm";
import { requireVendorContext } from "@/components/vendor/server/context";
import { getProfile } from "@/components/vendor/server/queries";
import { listedGroups, structureCoverage } from "@/components/vendor/lib/coverage";
import { getT, toLocale } from "@/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const t = getT(toLocale((await params).locale));
  return { title: `${t("vendorPortal.profile.title")} · ${t("vendorPortal.title")}` };
}

export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const { vendor } = await requireVendorContext(locale, `/${locale}/vendor/profile`);
  if (!vendor || vendor.status === "PENDING") return null;
  const data = await getProfile(vendor.id);
  if (!data) return null;
  // Remount the form when the stored profile changes (after save or a refresh from another tab).
  return <ProfileForm key={data.profile.updatedAt} profile={data.profile} portfolio={data.portfolio} coverage={structureCoverage(locale, 2)} gluing={listedGroups()} />;
}
