"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n";
import type { ActionResponse } from "./server/context";

/** Map a server error code (or upload error) to a translated message. */
export function useVendorErrorText() {
  const { t } = useI18n();
  return useCallback(
    (code: string | undefined, vars?: Record<string, string | number>) => {
      if (!code) return t("vendorPortal.errors.generic");
      if (["TYPE", "TOO_LARGE", "EMPTY", "FAILED"].includes(code)) return t(`vendorPortal.errors.upload.${code}` as DictKey, vars);
      const key = `vendorPortal.errors.${code}` as DictKey;
      const s = t(key, vars);
      return s === key ? t("vendorPortal.errors.generic") : s;
    },
    [t],
  );
}

/**
 * Run a server action with a busy flag, a toast for the outcome and a refresh. Returns the result
 * so callers can read field errors. STALE refreshes the page so the user sees the current state.
 */
export function useVendorAction() {
  const router = useRouter();
  const toast = useToast();
  const errorText = useVendorErrorText();
  const [busy, setBusy] = useState<string | null>(null);

  const run = useCallback(
    async <T,>(key: string, fn: () => Promise<ActionResponse<T>>, success?: string): Promise<ActionResponse<T> | null> => {
      setBusy(key);
      try {
        const res = await fn();
        if (res.ok) {
          if (success) toast.show(success);
          router.refresh();
        } else if (res.error !== "INVALID" || !res.fieldErrors) {
          toast.show(errorText(res.error), { tone: "critical" });
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
    [router, toast, errorText],
  );

  return { run, busy };
}

export interface UploadOk {
  ok: true;
  key: string;
  url: string;
  name?: string;
  size?: number;
  type?: string;
}

/** POST a file to /api/vendor/uploads. */
export async function uploadFile(file: File, fields: Record<string, string>): Promise<UploadOk | { ok: false; error: string }> {
  const fd = new FormData();
  fd.set("file", file);
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  try {
    const res = await fetch("/api/vendor/uploads", { method: "POST", body: fd, credentials: "same-origin" });
    const json = (await res.json().catch(() => ({ ok: false, error: "FAILED" }))) as UploadOk | { ok: false; error: string };
    return json;
  } catch {
    return { ok: false, error: "FAILED" };
  }
}
