"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { OtpForm, type OtpSuccess } from "./OtpForm";
import styles from "./AuthGateDialog.module.css";

/**
 * Soft gate G2 (see docs/research-report.md §1.3). Open it when an anonymous user tries
 * to export, save, share or see the instant price:
 *   <AuthGateDialog open={open} onClose={() => setOpen(false)} onSuccess={() => { router.refresh(); doTheThing(); }} />
 * Native <dialog>: focus trap, Esc to close, focus returns to the opener.
 */
export function AuthGateDialog({
  open,
  onClose,
  onSuccess,
  reason,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (u: OtpSuccess) => void;
  reason?: string;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} className={styles.dialog} onClose={onClose} aria-labelledby="auth-gate-title">
      <div className={styles.header}>
        <h2 id="auth-gate-title" className={styles.title}>
          {t("auth.title")}
        </h2>
        <button type="button" className={styles.close} onClick={onClose} aria-label={t("common.close")}>
          <X aria-hidden size={20} />
        </button>
      </div>
      <div className={styles.body}>
        {open && <OtpForm reason={reason ?? t("auth.gateReason")} onSuccess={onSuccess} />}
      </div>
    </dialog>
  );
}
