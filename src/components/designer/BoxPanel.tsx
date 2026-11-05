"use client";

import { useEffect, useState } from "react";
import { STRUCTURE_CODES, FINISH_CODES, type DesignDoc, type Dims, type DimsPreset, type FinishCode, type MaterialCode, type PrintSides, type StructureCode } from "@/types";
import { BOARD_SPECS, STRUCTURE_LIMITS, materialFitsStructure, validateDims, type DimsIssue } from "@/lib/dieline";
import { formatDims } from "@/lib/format";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n/types";
import { Badge, BlockStack, Button, ChoiceList, InlineGrid, InlineStack, Select, Text, TextField } from "@/components/ui";
import { matchingPreset } from "./lib/catalog";
import styles from "./designer.module.css";

const AXES = ["L", "W", "H"] as const;
const AXIS_KEY = { L: "designer.box.length", W: "designer.box.width", H: "designer.box.height" } as const;

export function BoxPanel({
  doc,
  presets,
  closedOuter,
  onStructure,
  onDims,
  onMaterial,
  onFinish,
  onPrintSides,
}: {
  doc: DesignDoc;
  presets: DimsPreset[];
  closedOuter: Dims | null;
  onStructure: (code: StructureCode) => void;
  onDims: (dims: Dims) => void;
  onMaterial: (m: MaterialCode) => void;
  onFinish: (f: FinishCode) => void;
  onPrintSides: (p: PrintSides) => void;
}) {
  const { t, locale } = useI18n();
  const code = doc.structureCode;
  const limits = STRUCTURE_LIMITS[code];
  const [draft, setDraft] = useState<Record<"L" | "W" | "H", string>>({ L: String(doc.dims.L), W: String(doc.dims.W), H: String(doc.dims.H) });
  const [issues, setIssues] = useState<DimsIssue[]>([]);

  // Follow outside changes (preset, undo, style change).
  useEffect(() => {
    setDraft({ L: String(doc.dims.L), W: String(doc.dims.W), H: String(doc.dims.H) });
    setIssues([]);
  }, [doc.dims.L, doc.dims.W, doc.dims.H, code]);

  const change = (axis: "L" | "W" | "H", v: string) => {
    const next = { ...draft, [axis]: v };
    setDraft(next);
    const nums = { L: Number(next.L), W: Number(next.W), H: Number(next.H) };
    const r = validateDims(code, Object.values(next).some((s) => s.trim() === "") ? { ...nums, [axis]: NaN } : nums);
    if (r.ok) {
      setIssues([]);
      onDims(r.dims);
    } else setIssues(r.issues);
  };

  const errorFor = (axis: "L" | "W" | "H"): string | undefined => {
    const i = issues.find((x) => x.path === axis);
    if (!i) return undefined;
    const axisName = t(AXIS_KEY[axis]);
    if (i.code === "RULE") return t("designer.box.errors.RULE", { rule: t(`designer.box.rules.${i.rule}` as DictKey) });
    return t(`designer.box.errors.${i.code}` as DictKey, { axis: axisName, limit: i.limit ?? "" });
  };
  const ruleIssue = issues.find((i) => i.code === "RULE");
  const ruleText = ruleIssue ? t("designer.box.errors.RULE", { rule: ruleRuleText(ruleIssue.rule, t) }) : null;

  const active = matchingPreset(code, doc.dims, presets);
  const materials = (Object.keys(BOARD_SPECS) as MaterialCode[]).filter((m) => materialFitsStructure(m, code));

  return (
    <BlockStack gap="400">
      <Select
        label={t("designer.box.structure")}
        value={code}
        options={STRUCTURE_CODES.map((c) => ({ value: c, label: t(`structures.${c}` as DictKey) }))}
        onChange={(v) => onStructure(v as StructureCode)}
      />

      {presets.length > 0 && (
        <BlockStack gap="200">
          <Text as="h3" variant="headingSm">
            {t("designer.box.presets")}
          </Text>
          <div className={styles.presetRow} role="group" aria-label={t("designer.box.presets")}>
            {presets.map((p) => (
              <Button key={p.id} size="slim" pressed={active?.id === p.id} onClick={() => onDims({ ...p.dims })}>
                {p.name[locale]}
              </Button>
            ))}
          </div>
          {active?.standard ? (
            <InlineStack>
              <Badge tone="success" progress="complete">
                {t("designer.box.standard")}
              </Badge>
            </InlineStack>
          ) : null}
        </BlockStack>
      )}

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldLegend}>{t("designer.box.size")}</legend>
        <InlineGrid columns={3} gap="200">
          {AXES.map((axis) => (
            <TextField
              key={axis}
              label={t(AXIS_KEY[axis])}
              type="number"
              inputMode="decimal"
              autoComplete="off"
              dir="ltr"
              min={limits[axis].min}
              max={limits[axis].max}
              value={draft[axis]}
              onChange={(v) => change(axis, v)}
              helpText={`${limits[axis].min}–${limits[axis].max}`}
              error={issues.some((i) => i.path === axis && i.code !== "RULE") ? errorFor(axis) : undefined}
            />
          ))}
        </InlineGrid>
        {ruleText ? (
          <Text as="p" variant="bodySm" tone="critical">
            {ruleText}
          </Text>
        ) : (
          <Text as="p" variant="bodySm" tone="subdued">
            {t("designer.box.sizeHelp")}
          </Text>
        )}
        {closedOuter ? (
          <Text as="p" variant="bodySm" tone="subdued">
            {t("designer.box.outer", { dims: formatDims(roundDims(closedOuter), locale) })}
          </Text>
        ) : null}
      </fieldset>

      <Select
        label={t("designer.box.material")}
        value={doc.materialCode}
        options={materials.map((m) => ({ value: m, label: t(`materials.${m}` as DictKey) }))}
        onChange={(v) => onMaterial(v as MaterialCode)}
      />
      <Select
        label={t("designer.box.finish")}
        value={doc.finishCode}
        options={FINISH_CODES.map((f) => ({ value: f, label: t(`finishes.${f}` as DictKey) }))}
        onChange={(v) => onFinish(v as FinishCode)}
      />
      <ChoiceList
        title={t("designer.box.printSides")}
        choices={[
          { value: "OUTSIDE", label: t("designer.box.printOutside") },
          { value: "BOTH", label: t("designer.box.printBoth") },
        ]}
        selected={[doc.printSides]}
        onChange={(v) => onPrintSides((v[0] as PrintSides) ?? "OUTSIDE")}
      />
    </BlockStack>
  );
}

function ruleRuleText(rule: string | undefined, t: ReturnType<typeof useI18n>["t"]): string {
  const key = rule === "H <= W" || rule === "L == W" ? rule : null;
  return key ? t(`designer.box.rules.${key}` as DictKey) : (rule ?? "");
}

function roundDims(d: Dims): Dims {
  return { L: Math.round(d.L), W: Math.round(d.W), H: Math.round(d.H) };
}
