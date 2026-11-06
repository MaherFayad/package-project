import type { Metadata } from "next";
import { Suspense } from "react";
import { getT, toLocale } from "@/i18n";
import { ModerationQueue } from "@/components/admin/ModerationQueue";
import { loadModeration } from "@/components/admin/server/queries";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = getT(toLocale((await params).locale));
  return { title: `${t("admin.moderation.title")} · ${t("admin.title")}` };
}

export default async function AdminModerationPage({ params }: { params: Promise<{ locale: string }> }) {
  const data = await loadModeration(toLocale((await params).locale));
  return (
    <Suspense>
      <ModerationQueue photos={data.photos} bios={data.bios} />
    </Suspense>
  );
}
