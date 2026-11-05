"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";
import type { Locale } from "@/types";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n/types";
import { Banner } from "@/components/ui";
import { designerPath } from "./lib/catalog";
import { loadLocalDraft, type LocalDraft } from "./lib/storage";

/** "Continue your last design" from this device's autosave (shown only when one exists). */
export function ResumeCard({ locale }: { locale: Locale }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<LocalDraft | null>(null);
  useEffect(() => setDraft(loadLocalDraft()), []);
  if (!draft) return null;
  const name = draft.doc.name.trim() || t(`structures.${draft.doc.structureCode}` as DictKey);
  const url = designerPath(locale, draft.doc.structureCode, draft.designId ? { d: draft.designId } : { resume: "1" });
  return (
    <Banner tone="info" title={t("designer.picker.resume")} action={{ content: t("designer.picker.resumeAction"), url }}>
      <span>
        <History aria-hidden size={14} /> {t("designer.picker.resumeBody", { name })}
      </span>
    </Banner>
  );
}
