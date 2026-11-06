"use client";

import { Plus, Table2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import {
  Banner,
  BlockStack,
  Button,
  Card,
  Checkbox,
  DataTable,
  InlineGrid,
  InlineStack,
  Layout,
  LayoutSection,
  Page,
  Text,
  TextField,
  useToast,
} from "@/components/ui";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n";
import { formatMoney, formatNumber } from "@/lib/format";
import { QTY_TIERS, type FinishCode } from "@/types";
import { RATE_LIMITS, rateCardToForm, rateUnit, unitAt, validateRateCard, type RateCardErrors, type RateCardForm as Form } from "./lib/rateCard";
import { saveRateCard } from "./server/actions";
import { useVendorErrorText } from "./useVendorAction";
import { useContextualSaveBar } from "./VendorFrame";
import type { JobModelDTO, RateCardDetailDTO } from "./types";
import { ModelCoverage } from "./ModelCoverage";
import styles from "./vendor.module.css";

export function RateCardForm({ card, offeredFinishes, models, listed = [] }: { card: RateCardDetailDTO; offeredFinishes: FinishCode[]; models: JobModelDTO[]; listed?: string[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const errorText = useVendorErrorText();
  const [initial, setInitial] = useState<Form>(() => rateCardToForm(card));
  const [form, setForm] = useState<Form>(initial);
  const [updatedAt, setUpdatedAt] = useState(card.updatedAt);
  const [errors, setErrors] = useState<RateCardErrors>({});
  const [saving, setSaving] = useState(false);

  const finishes = offeredFinishes.filter((f) => f !== "NONE");
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initial), [form, initial]);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const err = (path: string) => (errors[path] ? t(`vendorPortal.rateCards.errors.${errors[path]}` as DictKey) : undefined);

  // Live preview from what is typed (falls back to the stored tiers while the form is invalid).
  const preview = useMemo(() => {
    const r = validateRateCard(form, card.structureCode, finishes);
    const tiers = r.ok ? r.value.qtyTiers : card.qtyTiers;
    const setup = r.ok ? r.value.setupPiasters : card.setupPiasters;
    return QTY_TIERS.map((q) => {
      const u = unitAt(tiers, q);
      return { q, unit: u, total: u === null ? null : u * q + setup };
    });
  }, [form, card, finishes]);

  // R5 (CR-35): one money precision per preview column.
  const unitDec = { alwaysDecimals: preview.some((p) => p.unit !== null && Math.round(p.unit) % 100 !== 0) };
  const totalDec = { alwaysDecimals: preview.some((p) => p.total !== null && Math.round(p.total) % 100 !== 0) };

  const onSave = useCallback(async () => {
    const local = validateRateCard(form, card.structureCode, finishes);
    if (!local.ok) {
      setErrors(local.errors);
      toast.show(t("vendorPortal.rateCards.errors.summary", { count: Object.keys(local.errors).length }), { tone: "critical" });
      return;
    }
    setSaving(true);
    try {
      const res = await saveRateCard(card.id, form, updatedAt);
      if (res.ok) {
        setErrors({});
        setInitial(form);
        setUpdatedAt(res.data.updatedAt);
        toast.show(t("vendorPortal.rateCards.saved"));
        router.refresh();
      } else if (res.fieldErrors) {
        setErrors(res.fieldErrors as RateCardErrors);
      } else {
        toast.show(errorText(res.error), { tone: "critical" });
        if (res.error === "STALE") router.refresh();
      }
    } catch {
      toast.show(errorText(undefined), { tone: "critical" });
    } finally {
      setSaving(false);
    }
  }, [form, card, finishes, updatedAt, toast, t, router, errorText]);

  const onDiscard = useCallback(() => {
    setForm(initial);
    setErrors({});
  }, [initial]);

  useContextualSaveBar({ dirty, saving, onSave, onDiscard });

  // R4: labels, pouches and tubes are priced per label / pouch / tube, not "per box".
  const family = rateUnit(card.structureCode);
  const u = { unit: t(`vendorPortal.rateCards.units.${family}` as DictKey), theUnit: t(`vendorPortal.rateCards.theUnits.${family}` as DictKey) };
  // Pouches and squeeze tubes have no cutting die: the one-off cost is tooling for a new shape or size.
  const tooling = family === "pouch" || family === "tube";
  const title = t("vendorPortal.rateCards.editTitle", { structure: t(`structures.${card.structureCode}` as DictKey), material: t(`materials.${card.materialCode}` as DictKey) });
  const egp = locale === "ar" ? "ج.م" : "EGP";
  const errorCount = Object.keys(errors).length;

  return (
    <Page title={title} titleIcon={Table2} backAction={{ content: t("vendorPortal.rateCards.back"), url: `/${locale}/vendor/rate-cards` }} subtitle={t("vendorPortal.rateCards.editSubtitle", u)}>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void onSave();
        }}
      >
        <Layout>
          <LayoutSection>
            <BlockStack gap="400">
              {errorCount ? <Banner tone="critical" title={t("vendorPortal.rateCards.errors.summary", { count: errorCount })} /> : null}

              <Card title={t("vendorPortal.rateCards.tiersTitle", u)}>
                <BlockStack gap="300">
                  <Text as="p" tone="subdued">
                    {t("vendorPortal.rateCards.tiersHelp", u)}
                  </Text>
                  {err("tiers") ? (
                    <Text as="p" tone="critical">
                      {err("tiers")}
                    </Text>
                  ) : null}
                  <div className={`${styles.Rows} ${styles.TierRows}`} role="group" aria-label={t("vendorPortal.rateCards.tiersTitle", u)}>
                    {form.tiers.map((tier, i) => (
                      <div key={i} className={styles.Row} style={{ ["--row-cols" as string]: 2 }} role="group" aria-label={t("vendorPortal.rateCards.tierRow", { index: i + 1 })}>
                        <TextField
                          label={t("vendorPortal.rateCards.minQty")}
                          autoComplete="off"
                          inputMode="numeric"
                          dir="ltr"
                          value={tier.minQty}
                          suffix={t("vendorPortal.common.pcsUnit")}
                          onChange={(v) => set("tiers", form.tiers.map((x, j) => (j === i ? { ...x, minQty: v } : x)))}
                          error={err(`tiers.${i}.minQty`)}
                        />
                        <TextField
                          label={t("vendorPortal.rateCards.unitPrice", u)}
                          autoComplete="off"
                          inputMode="decimal"
                          dir="ltr"
                          value={tier.unitEgp}
                          suffix={egp}
                          onChange={(v) => set("tiers", form.tiers.map((x, j) => (j === i ? { ...x, unitEgp: v } : x)))}
                          error={err(`tiers.${i}.unitEgp`)}
                        />
                        <Button
                          variant="tertiary"
                          icon={Trash2}
                          disabled={form.tiers.length <= 1}
                          accessibilityLabel={t("vendorPortal.rateCards.removeTier", { index: i + 1 })}
                          onClick={() => set("tiers", form.tiers.filter((_, j) => j !== i))}
                        />
                      </div>
                    ))}
                  </div>
                  <InlineStack>
                    <Button icon={Plus} disabled={form.tiers.length >= RATE_LIMITS.maxTiers} onClick={() => set("tiers", [...form.tiers, { minQty: "", unitEgp: "" }])}>
                      {t("vendorPortal.rateCards.addTier")}
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Card>

              <Card title={t("vendorPortal.rateCards.oneOffTitle")}>
                <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300" alignItems="start">
                  <TextField label={t("vendorPortal.rateCards.setup")} autoComplete="off" inputMode="decimal" dir="ltr" suffix={egp} value={form.setupEgp} onChange={(v) => set("setupEgp", v)} helpText={t("vendorPortal.rateCards.setupHelp")} error={err("setupEgp")} />
                  <TextField label={t(tooling ? "vendorPortal.rateCards.tooling" : "vendorPortal.rateCards.die")} autoComplete="off" inputMode="decimal" dir="ltr" suffix={egp} value={form.dieCostEgp} onChange={(v) => set("dieCostEgp", v)} helpText={t(tooling ? "vendorPortal.rateCards.toolingHelp" : "vendorPortal.rateCards.dieHelp")} error={err("dieCostEgp")} />
                  <TextField label={t("vendorPortal.rateCards.lead")} autoComplete="off" inputMode="numeric" dir="ltr" suffix={t("vendorPortal.common.daysUnit")} value={form.leadTimeDays} onChange={(v) => set("leadTimeDays", v)} helpText={t("vendorPortal.rateCards.leadHelp")} error={err("leadTimeDays")} />
                  <TextField label={t("vendorPortal.rateCards.printSides")} autoComplete="off" inputMode="decimal" dir="ltr" suffix="%" value={form.printSidesSurchargePct} onChange={(v) => set("printSidesSurchargePct", v)} helpText={t("vendorPortal.rateCards.printSidesHelp", u)} error={err("printSidesSurchargePct")} />
                </InlineGrid>
              </Card>

              {finishes.length ? (
                <Card title={t("vendorPortal.rateCards.finishesTitle")}>
                  <BlockStack gap="300">
                    <Text as="p" tone="subdued">
                      {t("vendorPortal.rateCards.finishesHelp", u)}
                    </Text>
                    <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300" alignItems="start">
                      {finishes.map((f) => (
                        <TextField
                          key={f}
                          label={t(`finishes.${f}` as DictKey)}
                          autoComplete="off"
                          inputMode="decimal"
                          dir="ltr"
                          suffix={`${egp} ${t("vendorPortal.rateCards.perBox", u)}`}
                          value={form.finishSurcharges[f] ?? ""}
                          onChange={(v) => set("finishSurcharges", { ...form.finishSurcharges, [f]: v })}
                          error={err(`finish.${f}`)}
                        />
                      ))}
                    </InlineGrid>
                  </BlockStack>
                </Card>
              ) : null}

              <Card title={t(tooling ? "vendorPortal.rateCards.sizesTitle" : "vendorPortal.rateCards.diesTitle")}>
                <BlockStack gap="300">
                  <Text as="p" tone="subdued">
                    {t(tooling ? "vendorPortal.rateCards.sizesHelp" : "vendorPortal.rateCards.diesHelp")}
                  </Text>
                  {form.standardDies.length === 0 ? (
                    <Text as="p" tone="subdued">
                      {t(tooling ? "vendorPortal.rateCards.sizesEmpty" : "vendorPortal.rateCards.diesEmpty")}
                    </Text>
                  ) : null}
                  <div className={styles.Rows}>
                    {form.standardDies.map((d, i) => (
                      <BlockStack key={i} gap="100">
                        <div className={styles.Row} style={{ ["--row-cols" as string]: 3 }} role="group" aria-label={`${t(tooling ? "vendorPortal.rateCards.sizesTitle" : "vendorPortal.rateCards.diesTitle")} ${i + 1}`}>
                          {(["L", "W", "H"] as const).map((k) => (
                            <TextField
                              key={k}
                              label={t(`vendorPortal.rateCards.die${k}` as DictKey)}
                              autoComplete="off"
                              inputMode="numeric"
                              dir="ltr"
                              suffix={t("common.mm")}
                              value={d[k]}
                              onChange={(v) => set("standardDies", form.standardDies.map((x, j) => (j === i ? { ...x, [k]: v } : x)))}
                              error={Boolean(errors[`dies.${i}`])}
                            />
                          ))}
                          <Button variant="tertiary" icon={Trash2} accessibilityLabel={t(tooling ? "vendorPortal.rateCards.removeSize" : "vendorPortal.rateCards.removeDie", { index: i + 1 })} onClick={() => set("standardDies", form.standardDies.filter((_, j) => j !== i))} />
                        </div>
                        {err(`dies.${i}`) ? (
                          <Text as="p" tone="critical" variant="bodySm">
                            {err(`dies.${i}`)}
                          </Text>
                        ) : null}
                      </BlockStack>
                    ))}
                  </div>
                  <InlineStack>
                    <Button icon={Plus} disabled={form.standardDies.length >= RATE_LIMITS.maxDies} onClick={() => set("standardDies", [...form.standardDies, { L: "", W: "", H: "" }])}>
                      {t(tooling ? "vendorPortal.rateCards.addSize" : "vendorPortal.rateCards.addDie")}
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Card>

              <InlineStack align="end" gap="200">
                <Button onClick={onDiscard} disabled={!dirty || saving}>
                  {t("vendorPortal.common.discard")}
                </Button>
                <Button variant="primary" submit disabled={!dirty} loading={saving}>
                  {t("vendorPortal.common.save")}
                </Button>
              </InlineStack>
            </BlockStack>
          </LayoutSection>

          <LayoutSection variant="oneThird" as="aside" aria-label={t("vendorPortal.rateCards.statusTitle")}>
            <BlockStack gap="400">
              <Card title={t("vendorPortal.rateCards.statusTitle")}>
                <Checkbox label={t("vendorPortal.rateCards.activeLabel")} helpText={t("vendorPortal.rateCards.activeHelp")} checked={form.active} onChange={(on) => set("active", on)} />
              </Card>
              <DataTable
                caption={t("vendorPortal.rateCards.previewTitle")}
                hideCaption={false}
                columnContentTypes={["numeric", "numeric", "numeric"]}
                headings={[t("vendorPortal.rateCards.previewQty"), t("vendorPortal.rateCards.previewUnit", u), t("vendorPortal.rateCards.previewTotal")]}
                rows={preview.map((p) => [formatNumber(p.q), p.unit === null ? "—" : formatMoney(p.unit, locale, unitDec), p.total === null ? "—" : formatMoney(p.total, locale, totalDec)])}
                increasedTableDensity
                footerContent={t("vendorPortal.rateCards.previewNote")}
              />
              <ModelCoverage models={models} listed={listed} material={t(`materials.${card.materialCode}` as DictKey)} />
              <Card title={t("vendorPortal.rateCards.referenceTitle")}>
                <Text as="p" tone="subdued">
                  {t("vendorPortal.rateCards.referenceBody", { area: card.referenceAreaM2.toFixed(3) })}
                </Text>
              </Card>
            </BlockStack>
          </LayoutSection>
        </Layout>
      </form>
    </Page>
  );
}
