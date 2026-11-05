"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { signOut } from "./useSession";

export function SignOutButton({ className }: { className?: string }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await signOut();
        router.push(`/${locale}`);
        router.refresh();
      }}
    >
      {t("nav.signOut")}
    </button>
  );
}
