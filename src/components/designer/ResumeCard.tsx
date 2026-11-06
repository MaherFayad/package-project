"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/types";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n/types";
import { modelByCode } from "@/lib/library";
import { docModelCode } from "@/lib/library/doc";
import { Banner } from "@/components/ui";
import { designerPath } from "./lib/catalog";
import { loadLocalDraft, type LocalDraft } from "./lib/storage";

/**
 * "Continue your last design" from this device's autosave (shown only when one exists). Links to
 * the draft's own library model (a family style or container), not just its base structure, so
 * ?resume=1 finds the draft again.
 */
export function ResumeCard({ locale }: { locale: Locale }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<LocalDraft | null>(null);
  useEffect(() => setDraft(loadLocalDraft()), []);
  if (!draft) return null;
  const code = docModelCode(draft.doc);
  const model = modelByCode(code);
  const name = draft.doc.name.trim() || model?.name[locale] || t(`structures.${draft.doc.structureCode}` as DictKey);
  const url = designerPath(locale, code, draft.designId ? { d: draft.designId } : { resume: "1" });
  return (
    <Banner tone="info" title={t("designer.picker.resume")} action={{ content: t("designer.picker.resumeAction"), url }}>
      <p>{t("designer.picker.resumeBody", { name })}</p>
    </Banner>
  );
}
