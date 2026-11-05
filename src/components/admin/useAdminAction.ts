"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useToast } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n";
import type { AdminActionResponse } from "./server/context";

/** Translate an action error code (or a field error code) to text. */
export function useAdminErrorText() {
  const { t } = useI18n();
  return useCallback(
    (code: string | undefined) => {
      if (!code) return t("admin.errors.generic");
      const key = `admin.errors.${code}` as DictKey;
      const s = t(key);
      return s === key ? t("admin.errors.generic") : s;
    },
    [t],
  );
}

/**
 * Run an admin server action with a busy key, a toast for the outcome and a router refresh.
 * Field errors are returned to the caller (no toast) so forms can show them inline.
 */
export function useAdminAction() {
  const router = useRouter();
  const toast = useToast();
  const errorText = useAdminErrorText();
  const { t } = useI18n();
  const [busy, setBusy] = useState<string | null>(null);

  const run = useCallback(
    async <T,>(key: string, fn: () => Promise<AdminActionResponse<T>>, success?: string): Promise<AdminActionResponse<T> | null> => {
      setBusy(key);
      try {
        const res = await fn();
        if (res.ok) {
          if (success) toast.show(success);
          router.refresh();
        } else if (res.error !== "INVALID" || !res.fieldErrors) {
          const detailText = (res.detail ?? "")
            .split(",")
            .filter(Boolean)
            .map((d) => {
              const b = t(`admin.privacy.blockers.${d}` as DictKey);
              if (!b.startsWith("admin.")) return b;
              const e = t(`admin.errors.${d}` as DictKey);
              return e.startsWith("admin.") ? "" : e;
            })
            .filter(Boolean)
            .join(" ");
          toast.show(`${errorText(res.error)} ${detailText}`.trim(), { tone: "critical" });
          if (res.error === "STALE") router.refresh();
        }
        return res;
      } catch {
        toast.show(errorText(undefined), { tone: "critical" });
        return null;
      } finally {
        setBusy(null);
      }
    },
    [router, toast, errorText, t],
  );

  return { run, busy };
}

/** Field error text for a key from an action response. */
export function fieldError(res: AdminActionResponse<unknown> | null, key: string, errorText: (c: string | undefined) => string): string | undefined {
  if (!res || res.ok || !res.fieldErrors) return undefined;
  const hit = Object.entries(res.fieldErrors).find(([k]) => k === key || k.startsWith(`${key}.`));
  return hit ? errorText(hit[1]) : undefined;
}

/** EGP text field value (e.g. "1250.50") → piasters, or null when empty/invalid. */
export function egpToPiastersInput(v: string): number | null {
  const s = v.replace(/,/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return NaN;
  return Math.round(n * 100);
}

export function piastersToInput(p: number): string {
  return (p / 100).toFixed(2);
}
