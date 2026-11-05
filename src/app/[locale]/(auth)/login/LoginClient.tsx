"use client";

import { useRouter } from "next/navigation";
import { OtpForm } from "@/components/auth/OtpForm";

export function LoginClient({ next }: { next: string }) {
  const router = useRouter();
  return (
    <OtpForm
      onSuccess={() => {
        router.replace(next);
        router.refresh();
      }}
    />
  );
}
