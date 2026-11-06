"use client";

import { useCallback, useMemo, useState } from "react";
import { parseNumberInput } from "@/lib/money/input";
import { Banner } from "@/components/ui/Banner";
import { BlockStack, InlineGrid, InlineStack } from "@/components/ui/Stack";
import { Button, ButtonGroup } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { DataTable } from "@/components/ui/IndexTable";
import { Text } from "@/components/ui/Text";
import { TextField } from "@/components/ui/TextField";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
// Leaf modules only: the @/lib/pricing barrel pulls the quote engine, model library and dieline into this client bundle.
import { DELIVERY_ZONES, type DeliveryZone } from "@/lib/pricing/types";
import type { ZoneRate } from "@/lib/pricing/config";
import { MATERIAL_CODES, type MaterialCode } from "@/types";
import { applyIndexUpdateAction, previewPricingAction, savePricingSettingsAction, type PricingPreview } from "./server/actions";
import { bumpBoard, type SettingsForm } from "./lib/pricingSettings";
import { useAdminSaveBar } from "./AdminFrame";
import { adminStyles } from "./charts";
import { fieldError, useAdminAction, useAdminErrorText } from "./useAdminAction";
import type { AdminActionResponse } from "./server/context";

/* ───────────────────────── Preview table ───────────────────────── */

function PreviewResult({ preview }: { preview: PricingPreview }) {
  const { t, locale } = useI18n();
  const signed = (n: number | null) => (n === null ? t("admin.common.none") : `${n > 0 ? "+" : ""}${formatPercent(n, locale)}`);
  return (
    <BlockStack gap="300">
      <Banner tone={preview.affected ? "info" : "success"} inCard announce>
        {preview.affected
          ? t("admin.pricing.preview.affected", { count: formatNumber(preview.affected), total: formatNumber(preview.rows.length), pct: signed(preview.avgChangePct) })
          : t("admin.pricing.preview.none")}
      </Banner>
      <DataTable
        caption={t("admin.pricing.preview.caption")}
        condensed
        columnContentTypes={["text", "text", "numeric", "numeric", "numeric"]}
        headings={[t("admin.pricing.preview.columns.structure"), t("admin.pricing.preview.columns.material"), t("admin.pricing.preview.columns.current"), t("admin.pricing.preview.columns.proposed"), t("admin.pricing.preview.columns.change")]}
        rows={preview.rows.map((r) => [
          t(`structures.${r.structureCode}` as DictKey),
          t(`materials.${r.materialCode}` as DictKey),
          r.currentUnitPiasters === null ? t("admin.pricing.preview.notPriced") : formatMoney(r.currentUnitPiasters, locale, { alwaysDecimals: true }),
          r.proposedUnitPiasters === null ? t("admin.pricing.preview.notPriced") : formatMoney(r.proposedUnitPiasters, locale, { alwaysDecimals: true }),
          signed(r.changePct),
        ])}
      />
    </BlockStack>
  );
}

/* ───────────────────────── Settings (margin, validity, zones) ───────────────────────── */

type ZoneDraft = Record<DeliveryZone, Record<keyof ZoneRate, string>>;
const ZONE_FIELDS: (keyof ZoneRate)[] = ["basePiasters", "includedKg", "perExtraKgPiasters", "freightPerLoadPiasters", "transitDays"];
const ZONE_LABEL: Record<keyof ZoneRate, string> = { basePiasters: "base", includedKg: "includedKg", perExtraKgPiasters: "perKg", freightPerLoadPiasters: "freight", transitDays: "transit" };
const MONEY_FIELDS = new Set<keyof ZoneRate>(["basePiasters", "perExtraKgPiasters", "freightPerLoadPiasters"]);

function toDraft(s: SettingsForm) {
  return {
    margin: String(Math.round(s.marginPct * 1000) / 10),
    marginOnShipping: s.marginOnShipping,
    validity: String(s.quoteValidityHours),
    zones: Object.fromEntries(
      DELIVERY_ZONES.map((z) => [z, Object.fromEntries(ZONE_FIELDS.map((f) => [f, MONEY_FIELDS.has(f) ? (s.zones[z][f] / 100).toFixed(2) : String(s.zones[z][f])]))]),
    ) as ZoneDraft,
  };
}

function fromDraft(d: ReturnType<typeof toDraft>): SettingsForm {
  const num = parseNumberInput; // R6-AD: "750,50" is not 75050
  return {
    marginPct: Math.round(num(d.margin) * 10) / 1000,
    marginOnShipping: d.marginOnShipping,
    quoteValidityHours: num(d.validity),
    zones: Object.fromEntries(
      DELIVERY_ZONES.map((z) => [z, Object.fromEntries(ZONE_FIELDS.map((f) => [f, MONEY_FIELDS.has(f) ? Math.round(num(d.zones[z][f]) * 100) : num(d.zones[z][f])]))]),
    ) as SettingsForm["zones"],
  };
}

export function PricingSettingsForm({ initial }: { initial: SettingsForm }) {
  const { t } = useI18n();
  const { run, busy } = useAdminAction();
  const errorText = useAdminErrorText();
  const start = useMemo(() => toDraft(initial), [initial]);
  const [draft, setDraft] = useState(start);
  const [res, setRes] = useState<AdminActionResponse<unknown> | null>(null);
  const [preview, setPreview] = useState<PricingPreview | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(start);

  const save = useCallback(async () => {
    const r = await run("save", () => savePricingSettingsAction(fromDraft(draft)), t("admin.pricing.saved"));
    setRes(r);
    if (r?.ok) setPreview(null);
  }, [run, draft, t]);
  const discard = useCallback(() => {
    setDraft(start);
    setRes(null);
    setPreview(null);
  }, [start]);
  useAdminSaveBar({ dirty, saving: busy === "save", onSave: save, onDiscard: discard });

  const setZone = (z: DeliveryZone, f: keyof ZoneRate, v: string) => setDraft((d) => ({ ...d, zones: { ...d.zones, [z]: { ...d.zones[z], [f]: v } } }));
  const err = (k: string) => fieldError(res, k, errorText);
  // Business plan target: 20–30% on top of the vendor buy price. Allowed, but called out.
  const marginNum = Number(draft.margin);
  const marginOutside = draft.margin.trim() !== "" && Number.isFinite(marginNum) && (marginNum < 20 || marginNum > 30);

  return (
    <BlockStack gap="400">
      <Card title={t("admin.pricing.settings.title")}>
        <BlockStack gap="300">
          <InlineGrid columns={{ xs: 1, md: 2 }} gap="300">
            <TextField
              label={t("admin.pricing.settings.margin")}
              autoComplete="off"
              inputMode="decimal"
              dir="ltr"
              suffix="%"
              value={draft.margin}
              onChange={(v) => setDraft((d) => ({ ...d, margin: v }))}
              helpText={marginOutside ? t("admin.pricing.settings.marginOutside") : t("admin.pricing.settings.marginHelp")}
              error={err("marginPct")}
            />
            <TextField
              label={t("admin.pricing.settings.validity")}
              autoComplete="off"
              inputMode="numeric"
              dir="ltr"
              value={draft.validity}
              onChange={(v) => setDraft((d) => ({ ...d, validity: v }))}
              helpText={t("admin.pricing.settings.validityHelp")}
              error={err("quoteValidityHours")}
            />
          </InlineGrid>
          <Checkbox label={t("admin.pricing.settings.marginOnShipping")} checked={draft.marginOnShipping} onChange={(v) => setDraft((d) => ({ ...d, marginOnShipping: v }))} />
        </BlockStack>
      </Card>

      <Card title={t("admin.pricing.zones.title")}>
        <BlockStack gap="300">
          <Text as="p" variant="bodySm" tone="subdued">
            {t("admin.pricing.zones.help")}
          </Text>
          {/* One row per zone, labels once in the header (Polaris nested table in a card). Each input keeps a full hidden label. */}
          <div className={adminStyles.ZoneScroll}>
            <table className={adminStyles.ZoneTable} aria-label={t("admin.pricing.zones.caption")}>
              <thead>
                <tr>
                  <th scope="col">{t("admin.pricing.zones.columns.zone")}</th>
                  {ZONE_FIELDS.map((f) => (
                    <th key={f} scope="col">
                      {t(`admin.pricing.zones.columns.${ZONE_LABEL[f]}` as DictKey)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DELIVERY_ZONES.map((z) => (
                  <tr key={z}>
                    <th scope="row">{t(`pricing.zones.${z}` as DictKey)}</th>
                    {ZONE_FIELDS.map((f) => (
                      <td key={f}>
                        {/* R6-AD: under 490 px each zone is a stacked group, so the column name shows above
                            its field (the input keeps its full hidden label, so this is aria-hidden). */}
                        <span className={adminStyles.ZoneFieldLabel} aria-hidden="true">
                          {t(`admin.pricing.zones.columns.${ZONE_LABEL[f]}` as DictKey)}
                        </span>
                        <TextField
                          label={`${t(`pricing.zones.${z}` as DictKey)}: ${t(`admin.pricing.zones.columns.${ZONE_LABEL[f]}` as DictKey)}`}
                          labelHidden
                          autoComplete="off"
                          inputMode="decimal"
                          dir="ltr"
                          value={draft.zones[z][f]}
                          onChange={(v) => setZone(z, f, v)}
                          error={err(`zones.${z}.${f}`)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </BlockStack>
      </Card>

      <Card title={t("admin.pricing.preview.title")}>
        <BlockStack gap="300">
          <Text as="p" variant="bodySm" tone="subdued">
            {t("admin.pricing.preview.help", { qty: formatNumber(500) })}
          </Text>
          <InlineStack align="end">
            <ButtonGroup>
              <Button
                loading={busy === "preview"}
                onClick={async () => {
                  const r = await run("preview", () => previewPricingAction({ kind: "settings", settings: fromDraft(draft) }));
                  setRes(r);
                  if (r?.ok) setPreview(r.data);
                }}
              >
                {t("admin.pricing.preview.run")}
              </Button>
              <Button variant="primary" disabled={!dirty} loading={busy === "save"} onClick={save}>
                {t("admin.common.save")}
              </Button>
            </ButtonGroup>
          </InlineStack>
          {preview ? <PreviewResult preview={preview} /> : null}
        </BlockStack>
      </Card>
    </BlockStack>
  );
}

/* ───────────────────────── FX / board index bulk update ───────────────────────── */

export function PriceIndexForm({ current }: { current: { fx: number; board: Partial<Record<MaterialCode, number>> } }) {
  const { t } = useI18n();
  const { run, busy } = useAdminAction();
  const errorText = useAdminErrorText();
  const today = new Date().toISOString().slice(0, 10);
  const [fx, setFx] = useState(String(current.fx));
  const [board, setBoard] = useState<Record<MaterialCode, string>>(() => Object.fromEntries(MATERIAL_CODES.map((m) => [m, String(current.board[m] ?? 1)])) as Record<MaterialCode, string>);
  const [bump, setBump] = useState("");
  const [from, setFrom] = useState(today);
  const [note, setNote] = useState("");
  const [res, setRes] = useState<AdminActionResponse<unknown> | null>(null);
  const [preview, setPreview] = useState<PricingPreview | null>(null);
  const payload = () => ({ effectiveFrom: from, fx: Number(fx), board: Object.fromEntries(MATERIAL_CODES.map((m) => [m, Number(board[m])])) as Record<MaterialCode, number>, note });
  const err = (k: string) => fieldError(res, k, errorText);

  return (
    <BlockStack gap="300">
      <InlineGrid columns={{ xs: 1, md: 2 }} gap="300">
        <TextField label={t("admin.pricing.index.fx")} autoComplete="off" inputMode="decimal" dir="ltr" value={fx} helpText={t("admin.pricing.index.multiplierHelp")} onChange={setFx} error={err("fx")} />
        <TextField label={t("admin.pricing.index.effectiveFrom")} type="date" autoComplete="off" dir="ltr" value={from} onChange={setFrom} error={err("effectiveFrom")} />
      </InlineGrid>
      <BlockStack gap="050">
        <Text as="h3" variant="headingSm">
          {t("admin.pricing.index.board")}
        </Text>
        {/* CR-56: one explanation for the section instead of a "×" prefix in 16 fields (read as clear buttons). */}
        <Text as="p" variant="bodySm" tone="subdued">
          {t("admin.pricing.index.multiplierHelp")}
        </Text>
      </BlockStack>
      <InlineGrid columns={{ xs: 1, sm: 2, md: 3 }} gap="300">
        {MATERIAL_CODES.map((m) => (
          <TextField
            key={m}
            label={t(`materials.${m}` as DictKey)}
            autoComplete="off"
            inputMode="decimal"
            dir="ltr"
            value={board[m]}
            onChange={(v) => setBoard((b) => ({ ...b, [m]: v }))}
            error={err(`board.${m}`)}
          />
        ))}
      </InlineGrid>
      <InlineStack gap="200" blockAlign="end" wrap>
        <TextField label={t("admin.pricing.index.bump")} autoComplete="off" inputMode="decimal" dir="ltr" suffix="%" value={bump} onChange={setBump} />
        <Button
          disabled={!bump.trim() || Number.isNaN(Number(bump))}
          onClick={() => {
            const next = bumpBoard(Object.fromEntries(MATERIAL_CODES.map((m) => [m, Number(board[m]) || 1])) as Record<MaterialCode, number>, Number(bump));
            setBoard(Object.fromEntries(MATERIAL_CODES.map((m) => [m, String(next[m])])) as Record<MaterialCode, string>);
            setBump("");
          }}
        >
          {t("admin.pricing.index.bumpApply")}
        </Button>
      </InlineStack>
      <TextField label={t("admin.pricing.index.note")} autoComplete="off" dir="auto" value={note} onChange={setNote} maxLength={200} />
      <InlineStack align="end">
        <ButtonGroup>
          <Button
            loading={busy === "ipreview"}
            onClick={async () => {
              const r = await run("ipreview", () => previewPricingAction({ kind: "index", index: payload() }));
              setRes(r);
              if (r?.ok) setPreview(r.data);
            }}
          >
            {t("admin.pricing.index.preview")}
          </Button>
          <Button
            variant="primary"
            loading={busy === "iapply"}
            onClick={async () => {
              const r = await run("iapply", () => applyIndexUpdateAction(payload()), t("admin.pricing.index.applied"));
              setRes(r);
              if (r?.ok) setPreview(null);
            }}
          >
            {t("admin.pricing.index.apply")}
          </Button>
        </ButtonGroup>
      </InlineStack>
      {preview ? <PreviewResult preview={preview} /> : null}
      <Text as="p" variant="bodySm" tone="subdued">
        {t("admin.pricing.preview.help", { qty: formatNumber(500) })}
      </Text>
    </BlockStack>
  );
}
