"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/types";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n/types";
import { Banner } from "@/components/ui/Banner";
import { designerPathLite, readDraftSummary, type DraftSummary } from "./lib/paths";

/**
 * "Continue your last design" from this device's autosave (shown only when one exists). Links to
 * the draft's own library model (a family style or container), not just its base structure, so
 * ?resume=1 finds the draft again. Reads only a summary of the draft: no model library, no
 * three.js on the start page (PERF-03).
 */
export function ResumeCard({ locale }: { locale: Locale }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<DraftSummary | null>(null);
  useEffect(() => setDraft(readDraftSummary()), []);
  if (!draft) return null;
  const name = draft.name.trim() || t(`structures.${draft.structureCode}` as DictKey);
  const url = designerPathLite(locale, draft.modelCode, draft.designId ? { d: draft.designId } : { resume: "1" });
  return (
    <Banner tone="info" title={t("designer.picker.resume")} action={{ content: t("designer.picker.resumeAction"), url }}>
      <p>{t("designer.picker.resumeBody", { name })}</p>
    </Banner>
  );
}
