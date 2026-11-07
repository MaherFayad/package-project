import { requireAdminPage } from "@/lib/auth/session";
import type { Metadata } from "next";
import { getT, toLocale } from "@/i18n";
import { UsersIndex } from "@/components/admin/UsersIndex";
import { loadUsers } from "@/components/admin/server/queries";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = getT(toLocale((await params).locale));
  return { title: `${t("admin.users.title")} · ${t("admin.title")}` };
}

export default async function AdminUsersPage() {
  await requireAdminPage(); // R6-SEC-09: the layout redirect does not stop this page rendering
  return <UsersIndex rows={await loadUsers()} />;
}
