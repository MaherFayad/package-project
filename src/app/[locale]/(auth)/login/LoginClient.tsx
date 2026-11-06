"use client";

import { useRouter } from "next/navigation";
import { OtpForm } from "@/components/auth/OtpForm";
import { useI18n } from "@/i18n/client";
import type { Role } from "@/types";

/** Where each role lands after signing in when no ?next= was given. */
export function homeForRole(role: Role, locale: string): string {
  if (role === "ADMIN") return `/${locale}/admin`;
  if (role === "VENDOR") return `/${locale}/vendor`;
  return `/${locale}`;
}

export function LoginClient({ next, explicit }: { next: string; explicit: boolean }) {
  const router = useRouter();
  const { locale } = useI18n();
  return (
    <OtpForm
      onSuccess={(u) => {
        router.replace(explicit ? next : homeForRole(u.role, locale));
        router.refresh();
      }}
    />
  );
}
