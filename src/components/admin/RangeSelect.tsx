"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Select } from "@/components/ui";

/** Period selector for the overview (state in the URL, ?range=7d|30d|90d). */
export function RangeSelect({ value, options, label }: { value: string; options: { value: string; label: string }[]; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  return (
    <Select
      label={label}
      labelInline
      size="slim"
      value={value}
      options={options}
      disabled={pending}
      onChange={(v) => {
        const next = new URLSearchParams(params.toString());
        if (v === "30d") next.delete("range");
        else next.set("range", v);
        const qs = next.toString();
        start(() => router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false }));
      }}
    />
  );
}
