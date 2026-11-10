"use client";

import { useId, useState } from "react";
import type { Dims, Locale } from "@/types";
import { modelByCode } from "@/lib/library/registry";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/i18n/client";
import { Banner } from "@/components/ui/Banner";
import { BlockStack } from "@/components/ui/Stack";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { parseNumberInput } from "@/lib/money/input";
import type { Recognised } from "./lib/dielineRemap/recognise";
import { formatSheetCm } from "./SheetArtwork";
import { dimsFromLidWidth, type RecogniseState } from "./useSheetRemap";
import s from "./sheetArtwork.module.css";

/**
 * "We recognised: Mailer box, 25 × 18 × 8 cm" for a full artwork made on the buyer's own printer
 * template, with apply, one measurement when the file has no print size, and the next matches.
 */
export function RecognisedCard(p: {
  locale: Locale;
  state: RecogniseState | undefined;
  /** The open model's code: a match of the same model and size needs no apply. */
  current: { code: string; dims: Dims };
  onApply: (match: Recognised, dims: Dims) => void;
}) {
  const { t } = useI18n();
  const st = p.state;
  if (!st) return null;
  if (st.status === "reading")
    return (
      <Text as="p" variant="bodySm" tone="subdued">
        <span role="status" data-testid="sheet-recog-reading">
          {t("designer.artworkFit.recogReading")}
        </span>
      </Text>
    );
  if (st.status === "error")
    return (
      <Banner tone="info" inCard>
        <span data-testid="sheet-recog" data-mode="error">
          {t("designer.artworkFit.recogFailed")}
        </span>
      </Banner>
    );
  const { result } = st;
  if (!result.found || !result.matches.length) {
    return (
      <Banner tone="info" inCard>
        <span data-testid="sheet-recog" data-mode={st.mode ?? "none"}>
          {t(st.mode === "faces" ? "designer.artworkFit.recogFaces" : "designer.artworkFit.recogNone")}
        </span>
      </Banner>
    );
  }
  return <Found {...p} matches={result.matches} />;
}

function Found(p: { locale: Locale; matches: Recognised[]; current: { code: string; dims: Dims }; onApply: (match: Recognised, dims: Dims) => void }) {
  const { t } = useI18n();
  const id = useId();
  const [pick, setPick] = useState(0);
  const [lid, setLid] = useState("");
  const top = p.matches[pick] ?? p.matches[0];
  const nameOf = (m: Recognised) => modelByCode(m.code)?.name[p.locale] ?? (p.locale === "ar" ? m.nameAr : m.name) ?? m.code;
  // One measurement fixes the size when the file has none: the lid's length (L), typed in cm.
  // parseNumberInput reads a plain decimal number with Western or Arabic-Indic digits.
  const typed = lid.trim() ? parseNumberInput(lid) : NaN;
  const lidMm = Number.isFinite(typed) && typed > 0 ? typed * 10 : null;
  const dims = !top.scaleKnown && lidMm ? dimsFromLidWidth(top.proportions, lidMm) : top.dims;
  const same = p.current.code === top.code && p.current.dims.L === dims.L && p.current.dims.W === dims.W && p.current.dims.H === dims.H;
  const others = p.matches.filter((_, i) => i !== pick).slice(0, 3);
  return (
    <Banner tone="success" inCard>
      <BlockStack gap="200">
        <span data-testid="sheet-recog" data-mode="model" data-code={top.code} data-score={top.score}>
          <strong>{t("designer.artworkFit.recogTitle", { name: nameOf(top), size: formatSheetCm(dims, p.locale) })}</strong>
        </span>
        <Text as="p" variant="bodySm">
          {t("designer.artworkFit.recogArranged")}
        </Text>
        {!top.scaleKnown ? (
          <BlockStack gap="100">
            <Text as="p" variant="bodySm" tone="subdued">
              {t("designer.artworkFit.recogSizeEstimate")}
            </Text>
            <label htmlFor={id} className={s.measureLabel}>
              {t("designer.artworkFit.recogMeasure")}
            </label>
            <input
              id={id}
              className={s.measure}
              inputMode="decimal"
              dir="ltr"
              value={lid}
              placeholder={formatNumber(top.dims.L / 10, 1)}
              aria-describedby={`${id}-help`}
              data-testid="sheet-recog-measure"
              onChange={(e) => setLid(e.currentTarget.value)}
            />
            <Text as="p" variant="bodySm" tone="subdued">
              <span id={`${id}-help`}>{t("designer.artworkFit.recogMeasureHelp")}</span>
            </Text>
          </BlockStack>
        ) : null}
        <div className={s.actions} data-testid="sheet-recog-apply">
          <Button variant="primary" disabled={same} onClick={() => p.onApply(top, dims)}>
            {t("designer.artworkFit.recogApply")}
          </Button>
        </div>
        {others.length ? (
          <BlockStack gap="100">
            <Text as="p" variant="bodySm" tone="subdued">
              {t("designer.artworkFit.recogOthers")}
            </Text>
            <div className={s.actions} role="group" aria-label={t("designer.artworkFit.recogOthers")}>
              {others.map((m) => (
                <Button key={m.code} variant="tertiary" onClick={() => setPick(p.matches.indexOf(m))}>
                  {`${nameOf(m)}${p.locale === "ar" ? "، " : ", "}${formatSheetCm(m.dims, p.locale)}`}
                </Button>
              ))}
            </div>
          </BlockStack>
        ) : null}
      </BlockStack>
    </Banner>
  );
}
