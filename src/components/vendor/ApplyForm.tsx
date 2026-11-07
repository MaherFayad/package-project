"use client";

import { FileCheck2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Banner } from "@/components/ui/Banner";
import { BlockStack, InlineGrid, InlineStack } from "@/components/ui/Stack";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { DropZone } from "@/components/ui/DropZone";
import { Icon } from "@/components/ui/Icon";
import { Select } from "@/components/ui/Select";
import { Text } from "@/components/ui/Text";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n";
import { STRUCTURE_FAMILY } from "@/lib/dieline/materials";
import { EGYPT_CITIES, STRUCTURE_CODES, type StructureCode, type StructureFamily, type VendorApplicationDocument } from "@/types";
import { applicationSchema, DOC_KINDS } from "./lib/application";
import { issuesToErrors } from "./lib/profile";
import { formatBytes, UPLOAD_RULES } from "./lib/files";
import { submitApplication } from "./server/actions";
import { uploadFile, useVendorErrorText } from "./useVendorAction";
import styles from "./vendor.module.css";

type DocKind = (typeof DOC_KINDS)[number];
const SLOTS: { kind: DocKind; multiple: boolean }[] = [
  { kind: "COMMERCIAL_REGISTER", multiple: false },
  { kind: "TAX_CARD", multiple: false },
  { kind: "SAMPLE", multiple: true },
  { kind: "FOOD_SAFE_CERT", multiple: false },
];

const APPLY_FAMILIES: StructureFamily[] = ["CORRUGATED", "FOLDING_CARTON", "RIGID", "TUBE", "LABEL", "FLEXIBLE"];

export function ApplyForm({ defaultName, defaultPhone }: { defaultName: string; defaultPhone: string }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const errorText = useVendorErrorText();
  const [v, setV] = useState({
    nameAr: "",
    nameEn: "",
    legalName: "",
    commercialRegisterNo: "",
    taxCardNo: "",
    factoryAddress: "",
    factoryCity: "",
    contactName: defaultName,
    contactPhone: defaultPhone,
    structures: [] as StructureCode[],
    message: "",
    acceptAgreement: false,
  });
  const [docs, setDocs] = useState<VendorApplicationDocument[]>([]);
  const [uploading, setUploading] = useState<DocKind | null>(null);
  const [uploadErr, setUploadErr] = useState<Partial<Record<DocKind, string>>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [focusNonce, setFocusNonce] = useState(0);

  // After a failed submit, move focus to the first invalid field (WCAG 3.3.1, 2.4.3); fall back to
  // the error summary when the problem is not on a focusable control (e.g. a missing upload).
  useEffect(() => {
    if (!focusNonce) return;
    const form = formRef.current;
    const first = form?.querySelector<HTMLElement>("input[aria-invalid='true'], select[aria-invalid='true'], textarea[aria-invalid='true'], fieldset[aria-invalid='true'] input");
    const target = first ?? form?.querySelector<HTMLElement>("[data-error-summary]");
    if (!target) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    target.focus({ preventScroll: true });
  }, [focusNonce]);

  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((s) => ({ ...s, [k]: val }));
  const err = (path: string) => {
    const code = errors[path];
    if (!code) return undefined;
    const key = `vendorPortal.apply.errors.${code}` as DictKey;
    const s = t(key);
    return s === key ? t("vendorPortal.apply.errors.INVALID") : s;
  };

  async function onDrop(kind: DocKind, accepted: File[], rejected: { reason: "type" | "size" }[]) {
    setUploadErr((e) => ({ ...e, [kind]: undefined }));
    if (rejected.length) setUploadErr((e) => ({ ...e, [kind]: errorText(rejected[0]!.reason === "type" ? "TYPE" : "TOO_LARGE", { size: formatBytes(UPLOAD_RULES.apply.maxBytes) }) }));
    if (!accepted.length) return;
    setUploading(kind);
    for (const f of accepted) {
      const r = await uploadFile(f, { scope: "apply" });
      if (r.ok) {
        const doc: VendorApplicationDocument = { kind, key: r.key, name: (r.name ?? f.name).slice(0, 200), size: r.size ?? f.size, type: r.type ?? f.type };
        setDocs((d) => [...d.filter((x) => (SLOTS.find((s) => s.kind === kind)!.multiple ? true : x.kind !== kind)), doc]);
        toast.show(t("vendorPortal.apply.uploaded", { name: doc.name }));
      } else {
        setUploadErr((e) => ({ ...e, [kind]: errorText(r.error, { size: formatBytes(UPLOAD_RULES.apply.maxBytes) }) }));
      }
    }
    setUploading(null);
    setErrors((e) => {
      const n = { ...e };
      delete n[`documents.${kind}`];
      return n;
    });
  }

  async function onSubmit() {
    const input = { ...v, documents: docs };
    const local = applicationSchema.safeParse(input);
    if (!local.success) {
      const e = issuesToErrors(local.error.issues);
      setErrors(e);
      setFocusNonce((n) => n + 1);
      toast.show(t("vendorPortal.apply.errors.summary", { count: Object.keys(e).length }), { tone: "critical" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitApplication(input, locale);
      if (res.ok) {
        router.refresh();
      } else if (res.fieldErrors) {
        setErrors(res.fieldErrors);
        setFocusNonce((n) => n + 1);
        toast.show(res.fieldErrors._ ? t("vendorPortal.apply.errors.ALREADY_APPLIED") : t("vendorPortal.apply.errors.summary", { count: Object.keys(res.fieldErrors).length }), { tone: "critical" });
        if (res.fieldErrors._) router.refresh();
      } else {
        toast.show(errorText(res.error), { tone: "critical" });
      }
    } catch {
      toast.show(errorText(undefined), { tone: "critical" });
    } finally {
      setSubmitting(false);
    }
  }

  const errorCount = Object.keys(errors).length;

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit();
      }}
    >
      <BlockStack gap="400">
        {errorCount ? (
          <div data-error-summary tabIndex={-1} className={styles.ErrorSummary}>
            <Banner tone="critical" title={t("vendorPortal.apply.errors.summary", { count: errorCount })} />
          </div>
        ) : null}

        <Card title={t("vendorPortal.apply.companyTitle")}>
          <BlockStack gap="300">
            <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300" alignItems="start">
              <TextField label={t("vendorPortal.apply.nameAr")} autoComplete="organization" dir="rtl" value={v.nameAr} onChange={(x) => set("nameAr", x)} error={err("nameAr")} requiredIndicator />
              <TextField label={t("vendorPortal.apply.nameEn")} autoComplete="organization" dir="ltr" value={v.nameEn} onChange={(x) => set("nameEn", x)} error={err("nameEn")} requiredIndicator />
            </InlineGrid>
            <TextField label={t("vendorPortal.apply.legalName")} autoComplete="organization" value={v.legalName} onChange={(x) => set("legalName", x)} error={err("legalName")} requiredIndicator />
            <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300" alignItems="start">
              <TextField
                label={t("vendorPortal.apply.commercialRegisterNo")}
                autoComplete="off"
                inputMode="numeric"
                dir="ltr"
                value={v.commercialRegisterNo}
                onChange={(x) => set("commercialRegisterNo", x)}
                error={err("commercialRegisterNo")}
                requiredIndicator
              />
              <TextField
                label={t("vendorPortal.apply.taxCardNo")}
                autoComplete="off"
                inputMode="numeric"
                dir="ltr"
                value={v.taxCardNo}
                onChange={(x) => set("taxCardNo", x)}
                helpText={t("vendorPortal.apply.taxCardHelp")}
                error={err("taxCardNo")}
                requiredIndicator
              />
            </InlineGrid>
          </BlockStack>
        </Card>

        <Card title={t("vendorPortal.apply.factoryTitle")}>
          <BlockStack gap="300">
            <TextField
              label={t("vendorPortal.apply.factoryAddress")}
              autoComplete="street-address"
              multiline={2}
              value={v.factoryAddress}
              onChange={(x) => set("factoryAddress", x)}
              error={err("factoryAddress")}
              requiredIndicator
            />
            <Select
              label={t("vendorPortal.apply.factoryCity")}
              value={v.factoryCity}
              placeholder={t("vendorPortal.apply.chooseCity")}
              onChange={(x) => set("factoryCity", x)}
              options={EGYPT_CITIES.map((c) => ({ label: t(`cities.${c}` as DictKey), value: c }))}
              error={err("factoryCity")}
              requiredIndicator
            />
          </BlockStack>
        </Card>

        <Card title={t("vendorPortal.apply.contactTitle")}>
          <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300" alignItems="start">
            <TextField label={t("vendorPortal.apply.contactName")} autoComplete="name" value={v.contactName} onChange={(x) => set("contactName", x)} error={err("contactName")} requiredIndicator />
            <TextField label={t("vendorPortal.apply.contactPhone")} autoComplete="tel" type="tel" inputMode="tel" dir="ltr" value={v.contactPhone} onChange={(x) => set("contactPhone", x)} error={err("contactPhone")} requiredIndicator />
          </InlineGrid>
        </Card>

        <Card title={t("vendorPortal.apply.capabilitiesTitle")}>
          <BlockStack gap="300">
            <fieldset className={styles.Fieldset}>
              <legend className={styles.Legend}>{t("vendorPortal.apply.structures")}</legend>
              {/* Grouped by production family so 16 styles stay scannable (R2-08). */}
              <div className={styles.Families}>
                {APPLY_FAMILIES.map((fam) => (
                  <div key={fam} className={styles.ApplyFamily} role="group" aria-labelledby={`apply-family-${fam}`}>
                    <Text as="h3" variant="headingXs" tone="subdued" id={`apply-family-${fam}`}>
                      {t(`vendorPortal.profile.families.${fam}` as DictKey)}
                    </Text>
                    <div className={styles.Checks}>
                      {STRUCTURE_CODES.filter((c) => STRUCTURE_FAMILY[c] === fam).map((c) => (
                        <Checkbox
                          key={c}
                          label={t(`structures.${c}` as DictKey)}
                          checked={v.structures.includes(c)}
                          onChange={(on) => set("structures", on ? [...v.structures, c] : v.structures.filter((x) => x !== c))}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {err("structures") ? (
                <Text as="p" tone="critical">
                  {err("structures")}
                </Text>
              ) : null}
            </fieldset>
            <TextField label={t("vendorPortal.apply.message")} autoComplete="off" multiline={3} maxLength={1000} optional value={v.message} onChange={(x) => set("message", x)} error={err("message")} />
          </BlockStack>
        </Card>

        <Card title={t("vendorPortal.apply.documentsTitle")}>
          <BlockStack gap="400">
            <Text as="p" tone="subdued">
              {t("vendorPortal.apply.documentsHelp")}
            </Text>
            {SLOTS.map((slot) => {
              const mine = docs.filter((d) => d.kind === slot.kind);
              return (
                <BlockStack key={slot.kind} gap="200">
                  <DropZone
                    label={t(`vendorPortal.apply.docKinds.${slot.kind}` as DictKey)}
                    accept={UPLOAD_RULES.apply.accept}
                    maxSize={UPLOAD_RULES.apply.maxBytes}
                    allowMultiple={slot.multiple}
                    disabled={uploading !== null}
                    onDrop={(_all, accepted, rejected) => void onDrop(slot.kind, accepted, rejected)}
                    actionTitle={uploading === slot.kind ? t("vendorPortal.apply.uploading") : t("vendorPortal.apply.upload")}
                    actionHint={t("vendorPortal.apply.uploadHint")}
                    error={uploadErr[slot.kind] ?? err(`documents.${slot.kind}`)}
                  />
                  {mine.length ? (
                    <ul className={styles.Docs}>
                      {mine.map((d) => (
                        <li key={d.key} className={styles.Doc}>
                          <InlineStack gap="200" blockAlign="center" wrap={false}>
                            <Icon source={FileCheck2} tone="success" />
                            <span className={styles.DocName}>{d.name}</span>
                            <Text as="span" tone="subdued" variant="bodySm" numeric>
                              {formatBytes(d.size)}
                            </Text>
                          </InlineStack>
                          <Button variant="tertiary" size="slim" icon={X} accessibilityLabel={t("vendorPortal.apply.removeDoc", { name: d.name })} onClick={() => setDocs((all) => all.filter((x) => x.key !== d.key))} />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </BlockStack>
              );
            })}
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <Checkbox label={t("vendorPortal.apply.agreement")} checked={v.acceptAgreement} onChange={(on) => set("acceptAgreement", on)} error={err("acceptAgreement")} />
            <InlineStack align="end">
              <Button variant="primary" size="large" submit loading={submitting} disabled={uploading !== null}>
                {t("vendorPortal.apply.submit")}
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>
      </BlockStack>
    </form>
  );
}
