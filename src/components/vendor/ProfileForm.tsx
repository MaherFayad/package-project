"use client";

import { Plus, Trash2, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  Checkbox,
  DropZone,
  InlineGrid,
  InlineStack,
  Layout,
  LayoutSection,
  Link,
  Page,
  Select,
  Text,
  TextField,
  useToast,
} from "@/components/ui";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n";
import { formatNumber, formatPercent } from "@/lib/format";
import { EGYPT_CITIES, FINISH_CODES, MATERIAL_CODES, STRUCTURE_CODES, type EgyptCity, type FinishCode, type MaterialCode, type StructureCode, type StructureFamily, type VendorCertification } from "@/types";
import { CERT_CODES, MACHINE_KINDS, issuesToErrors, profileSchema } from "./lib/profile";
import { fileUrl, formatBytes, UPLOAD_RULES } from "./lib/files";
import { parseNumber } from "./lib/rateCard";
import { saveProfile } from "./server/actions";
import { uploadFile, useVendorErrorText } from "./useVendorAction";
import { useContextualSaveBar } from "./VendorFrame";
import { PortfolioManager } from "./PortfolioManager";
import type { PortfolioItemDTO, VendorProfileDTO } from "./types";
import type { StructureCoverage } from "./lib/coverage";
import { BOARD_SPECS, STRUCTURE_FAMILY } from "@/lib/dieline/materials";
import styles from "./vendor.module.css";

type MachineKind = (typeof MACHINE_KINDS)[number];
type CertCode = (typeof CERT_CODES)[number];

interface FormState {
  bioAr: string;
  bioEn: string;
  machines: { kind: MachineKind; model: string; count: string }[];
  structures: StructureCode[];
  materials: MaterialCode[];
  finishes: FinishCode[];
  maxColors: string;
  digitalShortRun: boolean;
  monthlyCapacityUnits: string;
  leadTimeDays: string;
  minOrderQty: string;
  serviceAreas: EgyptCity[];
  certifications: { code: CertCode; issuer: string; validUntil: string; documentKey: string; status?: VendorCertification["status"] }[];
}

function toForm(p: VendorProfileDTO): FormState {
  return {
    bioAr: p.bioAr,
    bioEn: p.bioEn,
    machines: p.machines.map((m) => ({ kind: m.kind, model: m.model, count: String(m.count) })),
    structures: p.structures,
    materials: p.materials,
    finishes: p.finishes.filter((f) => f !== "NONE"),
    maxColors: String(p.maxColors),
    digitalShortRun: p.digitalShortRun,
    monthlyCapacityUnits: String(p.monthlyCapacityUnits),
    leadTimeDays: String(p.leadTimeDays),
    minOrderQty: String(p.minOrderQty),
    serviceAreas: p.serviceAreas,
    certifications: p.certifications.map((c) => ({ code: c.code, issuer: c.issuer, validUntil: c.validUntil ?? "", documentKey: c.documentKey ?? "", status: c.status })),
  };
}

function toInput(f: FormState) {
  const n = (s: string) => {
    const v = parseNumber(s);
    return v === null || Number.isNaN(v) ? NaN : v;
  };
  return {
    bioAr: f.bioAr,
    bioEn: f.bioEn,
    machines: f.machines.map((m) => ({ kind: m.kind, model: m.model, count: n(m.count) })),
    structures: f.structures,
    materials: f.materials,
    finishes: f.finishes,
    maxColors: n(f.maxColors),
    digitalShortRun: f.digitalShortRun,
    monthlyCapacityUnits: n(f.monthlyCapacityUnits),
    leadTimeDays: n(f.leadTimeDays),
    minOrderQty: n(f.minOrderQty),
    serviceAreas: f.serviceAreas,
    certifications: f.certifications.map((c) => ({ code: c.code, issuer: c.issuer, validUntil: c.validUntil || undefined, documentKey: c.documentKey || undefined })),
  };
}

/** Production families in the order printers think of them (also the designer's group order). */
const FAMILIES: StructureFamily[] = ["CORRUGATED", "FOLDING_CARTON", "RIGID", "TUBE", "LABEL", "FLEXIBLE"];

function toggle<T>(list: T[], v: T, on: boolean): T[] {
  return on ? (list.includes(v) ? list : [...list, v]) : list.filter((x) => x !== v);
}

export function ProfileForm({ profile, portfolio, coverage }: { profile: VendorProfileDTO; portfolio: PortfolioItemDTO[]; coverage: StructureCoverage }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const errorText = useVendorErrorText();
  const [initial, setInitial] = useState(() => toForm(profile));
  const [form, setForm] = useState(initial);
  const [updatedAt, setUpdatedAt] = useState(profile.updatedAt);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploadingCert, setUploadingCert] = useState<number | null>(null);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initial), [form, initial]);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const err = (path: string) => {
    const code = errors[path];
    if (!code) return undefined;
    if (code === "NO_MATERIAL_FOR_STRUCTURE") {
      const idx = Number(path.split(".")[1]);
      return t("vendorPortal.profile.errors.NO_MATERIAL_FOR_STRUCTURE", { name: t(`structures.${form.structures[idx]}` as DictKey) });
    }
    const key = `vendorPortal.profile.errors.${code}` as DictKey;
    const s = t(key);
    return s === key ? t("vendorPortal.profile.errors.INVALID") : s;
  };

  const onSave = useCallback(async () => {
    const input = toInput(form);
    const local = profileSchema.safeParse(input);
    if (!local.success) {
      const e = issuesToErrors(local.error.issues);
      setErrors(e);
      toast.show(t("vendorPortal.profile.errors.summary", { count: Object.keys(e).length }), { tone: "critical" });
      return;
    }
    setSaving(true);
    try {
      const res = await saveProfile(input, updatedAt);
      if (res.ok) {
        setErrors({});
        setInitial(form);
        setUpdatedAt(res.data.updatedAt);
        toast.show(t("vendorPortal.common.saved"));
        router.refresh();
      } else if (res.fieldErrors) {
        setErrors(res.fieldErrors);
        toast.show(t("vendorPortal.profile.errors.summary", { count: Object.keys(res.fieldErrors).length }), { tone: "critical" });
      } else {
        toast.show(errorText(res.error), { tone: "critical" });
        if (res.error === "STALE") router.refresh();
      }
    } catch {
      toast.show(errorText(undefined), { tone: "critical" });
    } finally {
      setSaving(false);
    }
  }, [form, updatedAt, toast, t, router, errorText]);

  const onDiscard = useCallback(() => {
    setForm(initial);
    setErrors({});
  }, [initial]);

  useContextualSaveBar({ dirty, saving, onSave, onDiscard });

  async function uploadCert(i: number, files: File[], rejected: { reason: "type" | "size" }[]) {
    if (rejected.length) {
      setErrors((e) => ({ ...e, [`certifications.${i}.documentKey`]: rejected[0]!.reason === "type" ? "UPLOAD_TYPE" : "UPLOAD_SIZE" }));
      return;
    }
    const f = files[0];
    if (!f) return;
    setUploadingCert(i);
    const r = await uploadFile(f, { scope: "cert" });
    setUploadingCert(null);
    if (!r.ok) {
      toast.show(errorText(r.error, { size: formatBytes(UPLOAD_RULES.cert.maxBytes) }), { tone: "critical" });
      return;
    }
    setForm((s) => ({ ...s, certifications: s.certifications.map((c, j) => (j === i ? { ...c, documentKey: r.key, status: "PENDING" } : c)) }));
    setErrors((e) => {
      const n = { ...e };
      delete n[`certifications.${i}.documentKey`];
      return n;
    });
  }

  const certDocError = (i: number) => {
    const code = errors[`certifications.${i}.documentKey`];
    if (code === "UPLOAD_TYPE") return errorText("TYPE");
    if (code === "UPLOAD_SIZE") return errorText("TOO_LARGE", { size: formatBytes(UPLOAD_RULES.cert.maxBytes) });
    return err(`certifications.${i}.documentKey`);
  };

  const errorCount = Object.keys(errors).length;

  return (
    <Page title={t("vendorPortal.profile.title")} titleIcon={UserRound} subtitle={t("vendorPortal.profile.subtitle")}>
      <Layout>
        <LayoutSection>
          <BlockStack gap="400">
            <form
              id="vendor-profile-form"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void onSave();
              }}
            >
            <BlockStack gap="400">
              {errorCount ? (
                <Banner tone="critical" title={t("vendorPortal.profile.errors.summary", { count: errorCount })} />
              ) : null}

              <Card title={t("vendorPortal.profile.aboutTitle")}>
                <BlockStack gap="400">
                  <TextField
                    label={t("vendorPortal.profile.bioAr")}
                    autoComplete="off"
                    multiline={4}
                    dir="rtl"
                    maxLength={1200}
                    showCharacterCount
                    value={form.bioAr}
                    onChange={(v) => set("bioAr", v)}
                    helpText={t("vendorPortal.profile.bioHelp")}
                    error={err("bioAr")}
                  />
                  <TextField
                    label={t("vendorPortal.profile.bioEn")}
                    autoComplete="off"
                    multiline={4}
                    dir="ltr"
                    maxLength={1200}
                    showCharacterCount
                    value={form.bioEn}
                    onChange={(v) => set("bioEn", v)}
                    error={err("bioEn")}
                  />
                </BlockStack>
              </Card>

              <Card title={t("vendorPortal.profile.machinesTitle")} id="machines">
                <BlockStack gap="300">
                  <Text as="p" tone="subdued">
                    {t("vendorPortal.profile.machinesHelp")}
                  </Text>
                  {err("machines") ? (
                    <Text as="p" tone="critical">
                      {err("machines")}
                    </Text>
                  ) : null}
                  <div className={styles.Rows}>
                    {form.machines.map((m, i) => (
                      <div key={i} className={`${styles.Row} ${styles.MachineRow}`} style={{ ["--row-cols" as string]: 3 }}>
                        <Select
                          label={t("vendorPortal.profile.machineKind")}
                          value={m.kind}
                          onChange={(v) => set("machines", form.machines.map((x, j) => (j === i ? { ...x, kind: v as MachineKind } : x)))}
                          options={MACHINE_KINDS.map((k) => ({ label: t(`vendorPortal.profile.machineKinds.${k}` as DictKey), value: k }))}
                        />
                        <TextField
                          label={t("vendorPortal.profile.machineModel")}
                          autoComplete="off"
                          dir="ltr"
                          value={m.model}
                          onChange={(v) => set("machines", form.machines.map((x, j) => (j === i ? { ...x, model: v } : x)))}
                          error={err(`machines.${i}.model`)}
                        />
                        <TextField
                          label={t("vendorPortal.profile.machineCount")}
                          autoComplete="off"
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={50}
                          value={m.count}
                          onChange={(v) => set("machines", form.machines.map((x, j) => (j === i ? { ...x, count: v } : x)))}
                          error={err(`machines.${i}.count`)}
                        />
                        <Button
                          variant="tertiary"
                          icon={Trash2}
                          accessibilityLabel={t("vendorPortal.profile.removeMachine", { index: i + 1 })}
                          onClick={() => set("machines", form.machines.filter((_, j) => j !== i))}
                        />
                      </div>
                    ))}
                  </div>
                  <InlineStack>
                    <Button icon={Plus} onClick={() => set("machines", [...form.machines, { kind: "OFFSET", model: "", count: "1" }])}>
                      {t("vendorPortal.profile.addMachine")}
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Card>

              <Card title={t("vendorPortal.profile.capabilitiesTitle")}>
                <BlockStack gap="500">
                  <Text as="p" tone="subdued">
                    {t("vendorPortal.profile.capabilitiesHelp")}
                  </Text>
                  {err("structures") ? (
                    <Text as="p" tone="critical">
                      {err("structures")}
                    </Text>
                  ) : null}
                  {err("materials") ? (
                    <Text as="p" tone="critical">
                      {err("materials")}
                    </Text>
                  ) : null}
                  {/* One group per production family: the box styles it covers (with how many designer
                      models each style brings in) next to the boards that family runs on. */}
                  <div className={styles.Families}>
                    {FAMILIES.map((fam) => {
                      const famStructures = STRUCTURE_CODES.filter((c) => STRUCTURE_FAMILY[c] === fam);
                      const famMaterials = MATERIAL_CODES.filter((c) => BOARD_SPECS[c].family === fam);
                      const selected = famStructures.filter((c) => form.structures.includes(c)).length + famMaterials.filter((c) => form.materials.includes(c)).length;
                      const famId = `cap-family-${fam}`;
                      return (
                        <section key={fam} className={styles.Family} aria-labelledby={famId}>
                          <InlineStack align="space-between" blockAlign="center" gap="200">
                            <Text as="h3" variant="headingSm" id={famId}>
                              {t(`vendorPortal.profile.families.${fam}` as DictKey)}
                            </Text>
                            {selected ? <Badge tone="info">{t("vendorPortal.profile.familySelected", { count: formatNumber(selected) })}</Badge> : null}
                          </InlineStack>
                          <div className={styles.FamilyBody}>
                            <fieldset className={styles.Fieldset}>
                              <legend className={styles.SubLegend}>
                                <span className="visually-hidden">{`${t(`vendorPortal.profile.families.${fam}` as DictKey)}: `}</span>
                                {t("vendorPortal.profile.familyStyles")}
                              </legend>
                              <div className={styles.StyleChecks}>
                                {famStructures.map((c) => {
                                  const cov = coverage[c];
                                  const idx = form.structures.indexOf(c);
                                  return (
                                    <Checkbox
                                      key={c}
                                      id={`structure-${c}`}
                                      label={t(`structures.${c}` as DictKey)}
                                      helpText={
                                        cov ? (
                                          <>
                                            <bdi dir="ltr">{cov.standard}</bdi>
                                            {" · "}
                                            {t("vendorPortal.rateCards.modelCount", { count: formatNumber(cov.count) })}
                                            {cov.examples.length ? <span className={styles.CoverageExamples}>{t("vendorPortal.profile.coverageExamples", { examples: cov.examples.join(locale === "ar" ? "، " : ", ") })}</span> : null}
                                          </>
                                        ) : undefined
                                      }
                                      checked={idx >= 0}
                                      onChange={(on) => set("structures", toggle(form.structures, c, on))}
                                      error={idx >= 0 ? err(`structures.${idx}`) : undefined}
                                    />
                                  );
                                })}
                              </div>
                            </fieldset>
                            <fieldset className={styles.Fieldset}>
                              <legend className={styles.SubLegend}>
                                <span className="visually-hidden">{`${t(`vendorPortal.profile.families.${fam}` as DictKey)}: `}</span>
                                {t("vendorPortal.profile.familyBoards")}
                              </legend>
                              <div className={styles.BoardChecks}>
                                {famMaterials.map((c) => (
                                  <Checkbox key={c} label={t(`materials.${c}` as DictKey)} checked={form.materials.includes(c)} onChange={(on) => set("materials", toggle(form.materials, c, on))} />
                                ))}
                              </div>
                            </fieldset>
                          </div>
                        </section>
                      );
                    })}
                  </div>
                  <fieldset className={styles.Fieldset}>
                    <legend className={styles.Legend}>{t("vendorPortal.profile.finishes")}</legend>
                    <div className={styles.Checks}>
                      {FINISH_CODES.filter((c) => c !== "NONE").map((c) => (
                        <Checkbox key={c} label={t(`finishes.${c}` as DictKey)} checked={form.finishes.includes(c)} onChange={(on) => set("finishes", toggle(form.finishes, c, on))} />
                      ))}
                    </div>
                  </fieldset>
                  <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300" alignItems="start">
                    <TextField
                      label={t("vendorPortal.profile.maxColors")}
                      autoComplete="off"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={8}
                      value={form.maxColors}
                      onChange={(v) => set("maxColors", v)}
                      error={err("maxColors")}
                    />
                    <TextField
                      label={t("vendorPortal.profile.capacity")}
                      autoComplete="off"
                      inputMode="numeric"
                      value={form.monthlyCapacityUnits}
                      onChange={(v) => set("monthlyCapacityUnits", v)}
                      error={err("monthlyCapacityUnits")}
                    />
                  </InlineGrid>
                  <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300" alignItems="start">
                    <TextField
                      label={t("vendorPortal.profile.leadTime")}
                      autoComplete="off"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={60}
                      value={form.leadTimeDays}
                      onChange={(v) => set("leadTimeDays", v)}
                      error={err("leadTimeDays")}
                    />
                    <TextField
                      label={t("vendorPortal.profile.minOrder")}
                      autoComplete="off"
                      inputMode="numeric"
                      value={form.minOrderQty}
                      onChange={(v) => set("minOrderQty", v)}
                      error={err("minOrderQty")}
                    />
                  </InlineGrid>
                  <Checkbox
                    label={t("vendorPortal.profile.digitalShortRun")}
                    helpText={t("vendorPortal.profile.digitalShortRunHelp")}
                    checked={form.digitalShortRun}
                    onChange={(on) => set("digitalShortRun", on)}
                    error={err("digitalShortRun")}
                  />
                </BlockStack>
              </Card>

              <Card title={t("vendorPortal.profile.areasTitle")}>
                <fieldset className={styles.Fieldset}>
                  <legend className="visually-hidden">{t("vendorPortal.profile.areasTitle")}</legend>
                  <BlockStack gap="300">
                    <Text as="p" tone="subdued">
                      {t("vendorPortal.profile.areasHelp")}
                    </Text>
                    <div className={styles.Checks}>
                      {EGYPT_CITIES.map((c) => (
                        <Checkbox key={c} label={t(`cities.${c}` as DictKey)} checked={form.serviceAreas.includes(c)} onChange={(on) => set("serviceAreas", toggle(form.serviceAreas, c, on))} />
                      ))}
                    </div>
                    {err("serviceAreas") ? (
                      <Text as="p" tone="critical">
                        {err("serviceAreas")}
                      </Text>
                    ) : null}
                  </BlockStack>
                </fieldset>
              </Card>

              <Card title={t("vendorPortal.profile.certsTitle")} id="certifications">
                <BlockStack gap="400">
                  <Text as="p" tone="subdued">
                    {t("vendorPortal.profile.certsHelp")}
                  </Text>
                  {form.certifications.map((c, i) => (
                    <Card key={i} background="bg-surface-secondary">
                      <BlockStack gap="300">
                        <InlineStack align="space-between" blockAlign="center" gap="200">
                          <InlineStack gap="200" blockAlign="center">
                            <Text as="h3" variant="headingSm">
                              {t(`vendorPortal.profile.certCodes.${c.code}` as DictKey)}
                            </Text>
                            <Badge tone={c.status === "PENDING" ? "attention" : c.status === "REJECTED" ? "critical" : "success"} progress={c.status === "PENDING" ? "incomplete" : "complete"}>
                              {t(`vendorPortal.profile.certStatus.${c.status ?? "VERIFIED"}` as DictKey)}
                            </Badge>
                          </InlineStack>
                          <Button
                            variant="tertiary"
                            icon={Trash2}
                            accessibilityLabel={t("vendorPortal.profile.removeCert", { index: i + 1 })}
                            onClick={() => set("certifications", form.certifications.filter((_, j) => j !== i))}
                          />
                        </InlineStack>
                        <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300" alignItems="start">
                          <Select
                            label={t("vendorPortal.profile.certCode")}
                            value={c.code}
                            onChange={(v) => set("certifications", form.certifications.map((x, j) => (j === i ? { ...x, code: v as CertCode, status: "PENDING" } : x)))}
                            options={CERT_CODES.map((k) => ({ label: t(`vendorPortal.profile.certCodes.${k}` as DictKey), value: k }))}
                            error={err(`certifications.${i}.code`)}
                          />
                          <TextField
                            label={t("vendorPortal.profile.certIssuer")}
                            autoComplete="off"
                            value={c.issuer}
                            onChange={(v) => set("certifications", form.certifications.map((x, j) => (j === i ? { ...x, issuer: v } : x)))}
                            error={err(`certifications.${i}.issuer`)}
                          />
                          <TextField
                            label={t("vendorPortal.profile.certValidUntil")}
                            autoComplete="off"
                            type="date"
                            optional
                            value={c.validUntil}
                            onChange={(v) => set("certifications", form.certifications.map((x, j) => (j === i ? { ...x, validUntil: v } : x)))}
                            error={err(`certifications.${i}.validUntil`)}
                          />
                        </InlineGrid>
                        <DropZone
                          label={t("vendorPortal.profile.certDocument")}
                          allowMultiple={false}
                          accept={UPLOAD_RULES.cert.accept}
                          maxSize={UPLOAD_RULES.cert.maxBytes}
                          disabled={uploadingCert === i}
                          onDrop={(_all, accepted, rejected) => void uploadCert(i, accepted, rejected)}
                          actionTitle={uploadingCert === i ? t("vendorPortal.common.loading") : c.documentKey ? t("vendorPortal.profile.certReplace") : t("vendorPortal.profile.certUpload")}
                          helpText={t("vendorPortal.profile.certDocumentHelp")}
                          error={certDocError(i)}
                        />
                        {c.documentKey ? (
                          <Link url={fileUrl(c.documentKey)} external>
                            {t("vendorPortal.profile.certView")}
                          </Link>
                        ) : null}
                      </BlockStack>
                    </Card>
                  ))}
                  <InlineStack>
                    <Button
                      icon={Plus}
                      disabled={form.certifications.length >= CERT_CODES.length}
                      onClick={() => {
                        const free = CERT_CODES.find((k) => !form.certifications.some((c) => c.code === k)) ?? "FOOD_SAFE";
                        set("certifications", [...form.certifications, { code: free, issuer: "", validUntil: "", documentKey: "", status: "PENDING" }]);
                      }}
                    >
                      {t("vendorPortal.profile.addCert")}
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
            </form>

            <div id="portfolio">
              <PortfolioManager items={portfolio} />
            </div>
          </BlockStack>
        </LayoutSection>

          <LayoutSection variant="oneThird" as="aside" aria-label={t("vendorPortal.profile.statusTitle")}>
            <div className={styles.Sticky}>
              <Card
                title={t("vendorPortal.profile.statusTitle")}
                footer={
                  <Button variant="plain" url={`/${locale}/vendors/${profile.slug}`}>
                    {t("vendorPortal.profile.viewPublic")}
                  </Button>
                }
              >
                <BlockStack gap="300">
                  <Text as="p" fontWeight="semibold">
                    {locale === "ar" ? profile.nameAr : profile.nameEn}
                  </Text>
                  <InlineStack gap="100">
                    <Badge tone={profile.verified ? "success" : "attention"} progress={profile.verified ? "complete" : "incomplete"}>
                      {profile.verified ? t("vendorPortal.profile.verified") : t("vendorPortal.profile.notVerified")}
                    </Badge>
                    {profile.foodSafe ? <Badge tone="info">{t("vendorPortal.profile.foodSafe")}</Badge> : null}
                  </InlineStack>
                  <Text as="p" tone="subdued">
                    {t("vendorPortal.profile.rating", { rating: profile.rating.toFixed(1), count: formatNumber(profile.ratingCount) })}
                  </Text>
                  <Text as="p" tone="subdued">
                    {t("vendorPortal.profile.onTime", { pct: formatPercent(profile.onTimePct, locale) })}
                  </Text>
                </BlockStack>
              </Card>
            </div>
          </LayoutSection>
        </Layout>
    </Page>
  );
}
