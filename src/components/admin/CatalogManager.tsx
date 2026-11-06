"use client";

import { Boxes, Pencil } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Badge,
  BlockStack,
  Button,
  Card,
  Checkbox,
  DataTable,
  InlineGrid,
  Modal,
  Page,
  Tabs,
  Text,
  TextField,
} from "@/components/ui";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n";
import { formatMoney, formatNumber } from "@/lib/format";
import type { Dims, StructureParamLimits } from "@/types";
import {
  updateFinishAction,
  updateMaterialAction,
  updateStructureAction,
} from "./server/actions";
import { adminStyles } from "./charts";
import {
  fieldError,
  useAdminAction,
  useAdminErrorText,
} from "./useAdminAction";
import type { AdminActionResponse } from "./server/context";
import type { CatalogModelRow } from "./server/queries";
import { ModelsPanel } from "./CatalogModels";

export interface CatalogData {
  models: CatalogModelRow[];
  vendors: { id: string; slug: string; nameAr: string; nameEn: string }[];
  structures: {
    id: string;
    code: string;
    nameAr: string;
    nameEn: string;
    family: string;
    active: boolean;
    vendorCount: number;
    params: StructureParamLimits;
    defaultDims: Dims;
  }[];
  materials: {
    id: string;
    code: string;
    nameAr: string;
    nameEn: string;
    family: string;
    gsm: number;
    thicknessMm: number;
    foodSafe: boolean;
    active: boolean;
  }[];
  finishes: {
    id: string;
    code: string;
    nameAr: string;
    nameEn: string;
    unitSurchargePiasters: number;
    setupPiasters: number;
    active: boolean;
  }[];
}

const TABS = ["models", "structures", "materials", "finishes"] as const;
type Tab = (typeof TABS)[number];
type Editing =
  | { kind: "structure"; id: string }
  | { kind: "material"; id: string }
  | { kind: "finish"; id: string }
  | null;

/** Labels and pouches are sized flat: the width axis is pinned to 1 mm. */
function isFlat(p: StructureParamLimits): boolean {
  return p.W.max <= 1;
}

function ActiveBadge({ active }: { active: boolean }) {
  const { t } = useI18n();
  return (
    <Badge
      tone={active ? "success" : "neutral"}
      progress={active ? "complete" : "incomplete"}
    >
      {active ? t("admin.common.active") : t("admin.common.inactive")}
    </Badge>
  );
}

export function CatalogManager({ data }: { data: CatalogData }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, start] = useTransition();
  const tab: Tab = (TABS as readonly string[]).includes(params.get("tab") ?? "")
    ? (params.get("tab") as Tab)
    : "models";
  const [editing, setEditing] = useState<Editing>(null);
  const name = (r: { nameAr: string; nameEn: string }) =>
    locale === "ar" ? r.nameAr : r.nameEn;
  const span = (r: { min: number; max: number }) =>
    r.min === r.max ? `${r.min}` : `${r.min}–${r.max}`;
  /** L × W × H limits in one cell; flat items (labels, pouches: width fixed at 1 mm) show L × H only. */
  const limits = (p: StructureParamLimits) => (
    <bdi dir="ltr" className={adminStyles.Nowrap}>
      {(isFlat(p) ? [p.L, p.H] : [p.L, p.W, p.H]).map(span).join(" × ")}
    </bdi>
  );
  const defaultSize = (s: CatalogData["structures"][number]) => {
    const d = s.defaultDims;
    return (
      <bdi dir="ltr" className={adminStyles.Nowrap}>
        {(isFlat(s.params) ? [d.L, d.H] : [d.L, d.W, d.H])
          .map((n) => formatNumber(n))
          .join(" × ")}
      </bdi>
    );
  };
  const editBtn = (label: string, onClick: () => void) => (
    <Button
      variant="tertiary"
      size="slim"
      icon={Pencil}
      accessibilityLabel={label}
      onClick={onClick}
    >
      {t("admin.common.edit")}
    </Button>
  );

  return (
    <Page
      title={t("admin.catalog.title")}
      titleIcon={Boxes}
      subtitle={t("admin.catalog.subtitle")}
    >
      <Tabs
        tabs={TABS.map((x) => ({
          id: `catalog-${x}`,
          content: t(`admin.catalog.tabs.${x}` as DictKey),
        }))}
        selected={TABS.indexOf(tab)}
        onSelect={(i) =>
          start(() =>
            router.replace(`${pathname}${i === 0 ? "" : `?tab=${TABS[i]}`}`, {
              scroll: false,
            }),
          )
        }
      >
        {tab === "models" ? (
          <ModelsPanel
            models={data.models}
            vendors={data.vendors}
            structures={data.structures}
          />
        ) : null}
        {tab !== "models" ? (
          <Card padding="0">
            {tab === "structures" ? (
              <DataTable
                caption={t("admin.catalog.structures.caption")}
                columnContentTypes={[
                  "text",
                  "text",
                  "text",
                  "text",
                  "numeric",
                  "text",
                  "text",
                ]}
                headings={[
                  t("admin.catalog.structures.columns.name"),
                  t("admin.catalog.structures.columns.family"),
                  t("admin.catalog.structures.columns.limits"),
                  t("admin.catalog.structures.columns.default"),
                  t("admin.catalog.structures.columns.vendors"),
                  t("admin.catalog.structures.columns.status"),
                  <span key="h" className="visually-hidden">{t("admin.common.edit")}</span>,
                ]}
                rows={data.structures.map((s) => [
                  name(s),
                  t(`admin.catalog.families.${s.family}` as DictKey),
                  limits(s.params),
                  defaultSize(s),
                  s.vendorCount > 0 ? (
                    formatNumber(s.vendorCount)
                  ) : (
                    <Badge key="v" tone="warning">
                      {t("admin.catalog.models.quoteOnly")}
                    </Badge>
                  ),
                  <ActiveBadge key="a" active={s.active} />,
                  editBtn(
                    t("admin.catalog.structures.editTitle", { name: name(s) }),
                    () => setEditing({ kind: "structure", id: s.id }),
                  ),
                ])}
              />
            ) : null}
            {tab === "materials" ? (
              <DataTable
                caption={t("admin.catalog.materials.caption")}
                columnContentTypes={[
                  "text",
                  "text",
                  "numeric",
                  "numeric",
                  "text",
                  "text",
                  "text",
                ]}
                headings={[
                  t("admin.catalog.materials.columns.name"),
                  t("admin.catalog.materials.columns.family"),
                  t("admin.catalog.materials.columns.gsm"),
                  t("admin.catalog.materials.columns.thickness"),
                  t("admin.catalog.materials.columns.foodSafe"),
                  t("admin.catalog.materials.columns.status"),
                  <span key="h" className="visually-hidden">{t("admin.common.edit")}</span>,
                ]}
                rows={data.materials.map((m) => [
                  name(m),
                  t(`admin.catalog.families.${m.family}` as DictKey),
                  formatNumber(m.gsm),
                  formatNumber(m.thicknessMm, 2),
                  m.foodSafe ? t("admin.common.yes") : t("admin.common.no"),
                  <ActiveBadge key="a" active={m.active} />,
                  editBtn(
                    t("admin.catalog.materials.editTitle", { name: name(m) }),
                    () => setEditing({ kind: "material", id: m.id }),
                  ),
                ])}
              />
            ) : null}
            {tab === "finishes" ? (
              <DataTable
                caption={t("admin.catalog.finishes.caption")}
                columnContentTypes={[
                  "text",
                  "numeric",
                  "numeric",
                  "text",
                  "text",
                ]}
                headings={[
                  t("admin.catalog.finishes.columns.name"),
                  t("admin.catalog.finishes.columns.unit"),
                  t("admin.catalog.finishes.columns.setup"),
                  t("admin.catalog.finishes.columns.status"),
                  <span key="h" className="visually-hidden">{t("admin.common.edit")}</span>,
                ]}
                rows={data.finishes.map((f) => [
                  name(f),
                  formatMoney(f.unitSurchargePiasters, locale, { alwaysDecimals: true }),
                  formatMoney(f.setupPiasters, locale, { alwaysDecimals: true }),
                  <ActiveBadge key="a" active={f.active} />,
                  editBtn(
                    t("admin.catalog.finishes.editTitle", { name: name(f) }),
                    () => setEditing({ kind: "finish", id: f.id }),
                  ),
                ])}
              />
            ) : null}
          </Card>
        ) : null}
      </Tabs>

      {editing?.kind === "structure" ? (
        <StructureModal
          row={data.structures.find((s) => s.id === editing.id)!}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {editing?.kind === "material" ? (
        <MaterialModal
          row={data.materials.find((s) => s.id === editing.id)!}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {editing?.kind === "finish" ? (
        <FinishModal
          row={data.finishes.find((s) => s.id === editing.id)!}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </Page>
  );
}

function useEditor<T>(initial: T) {
  const [v, setV] = useState(initial);
  const [res, setRes] = useState<AdminActionResponse<unknown> | null>(null);
  return { v, setV, res, setRes };
}

function StructureModal({
  row,
  onClose,
}: {
  row: CatalogData["structures"][number];
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const { run, busy } = useAdminAction();
  const errorText = useAdminErrorText();
  const { v, setV, res, setRes } = useEditor({
    L: { min: String(row.params.L.min), max: String(row.params.L.max) },
    W: { min: String(row.params.W.min), max: String(row.params.W.max) },
    H: { min: String(row.params.H.min), max: String(row.params.H.max) },
    active: row.active,
  });
  const name = locale === "ar" ? row.nameAr : row.nameEn;
  const axisLabel = (a: "L" | "W" | "H") =>
    t(`admin.catalog.structures.columns.${a}` as DictKey);
  const general = fieldError(res, "_", errorText);
  return (
    <Modal
      open
      onClose={onClose}
      title={t("admin.catalog.structures.editTitle", { name })}
      primaryAction={{
        content: t("admin.common.save"),
        loading: busy === "structure",
        onAction: async () => {
          const toNum = (s: string) => Number(s);
          const r = await run(
            "structure",
            () =>
              updateStructureAction({
                id: row.id,
                L: { min: toNum(v.L.min), max: toNum(v.L.max) },
                W: { min: toNum(v.W.min), max: toNum(v.W.max) },
                H: { min: toNum(v.H.min), max: toNum(v.H.max) },
                active: v.active,
              }),
            t("admin.catalog.saved"),
          );
          setRes(r);
          if (r?.ok) onClose();
        },
      }}
      secondaryActions={[
        { content: t("admin.common.cancel"), onAction: onClose },
      ]}
    >
      <BlockStack gap="300">
        <Text as="p" variant="bodySm" tone="subdued">
          {t("admin.catalog.structures.help")}
        </Text>
        {general ? (
          <Text as="p" tone="critical">
            {general}
          </Text>
        ) : null}
        {(["L", "W", "H"] as const).map((a) => (
          <InlineGrid key={a} columns={2} gap="300">
            <TextField
              label={t("admin.catalog.structures.min", { axis: axisLabel(a) })}
              autoComplete="off"
              inputMode="numeric"
              dir="ltr"
              value={v[a].min}
              onChange={(x) => setV({ ...v, [a]: { ...v[a], min: x } })}
              error={
                fieldError(res, `${a}.min`, errorText) ??
                fieldError(res, a, errorText)
              }
            />
            <TextField
              label={t("admin.catalog.structures.max", { axis: axisLabel(a) })}
              autoComplete="off"
              inputMode="numeric"
              dir="ltr"
              value={v[a].max}
              onChange={(x) => setV({ ...v, [a]: { ...v[a], max: x } })}
              error={fieldError(res, `${a}.max`, errorText)}
            />
          </InlineGrid>
        ))}
        <Checkbox
          label={t("admin.catalog.activeLabel")}
          checked={v.active}
          onChange={(x) => setV({ ...v, active: x })}
        />
      </BlockStack>
    </Modal>
  );
}

function MaterialModal({
  row,
  onClose,
}: {
  row: CatalogData["materials"][number];
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const { run, busy } = useAdminAction();
  const errorText = useAdminErrorText();
  const { v, setV, res, setRes } = useEditor({
    gsm: String(row.gsm),
    thicknessMm: String(row.thicknessMm),
    foodSafe: row.foodSafe,
    active: row.active,
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={t("admin.catalog.materials.editTitle", {
        name: locale === "ar" ? row.nameAr : row.nameEn,
      })}
      primaryAction={{
        content: t("admin.common.save"),
        loading: busy === "material",
        onAction: async () => {
          const r = await run(
            "material",
            () =>
              updateMaterialAction({
                id: row.id,
                gsm: Number(v.gsm),
                thicknessMm: Number(v.thicknessMm),
                foodSafe: v.foodSafe,
                active: v.active,
              }),
            t("admin.catalog.saved"),
          );
          setRes(r);
          if (r?.ok) onClose();
        },
      }}
      secondaryActions={[
        { content: t("admin.common.cancel"), onAction: onClose },
      ]}
    >
      <BlockStack gap="300">
        <InlineGrid columns={2} gap="300">
          <TextField
            label={t("admin.catalog.materials.gsm")}
            autoComplete="off"
            inputMode="numeric"
            dir="ltr"
            value={v.gsm}
            onChange={(x) => setV({ ...v, gsm: x })}
            error={fieldError(res, "gsm", errorText)}
          />
          <TextField
            label={t("admin.catalog.materials.thickness")}
            autoComplete="off"
            inputMode="decimal"
            dir="ltr"
            value={v.thicknessMm}
            onChange={(x) => setV({ ...v, thicknessMm: x })}
            error={fieldError(res, "thicknessMm", errorText)}
          />
        </InlineGrid>
        <Checkbox
          label={t("admin.catalog.materials.foodSafe")}
          checked={v.foodSafe}
          onChange={(x) => setV({ ...v, foodSafe: x })}
        />
        <Checkbox
          label={t("admin.catalog.activeLabel")}
          checked={v.active}
          onChange={(x) => setV({ ...v, active: x })}
        />
      </BlockStack>
    </Modal>
  );
}

function FinishModal({
  row,
  onClose,
}: {
  row: CatalogData["finishes"][number];
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const { run, busy } = useAdminAction();
  const errorText = useAdminErrorText();
  const { v, setV, res, setRes } = useEditor({
    unit: (row.unitSurchargePiasters / 100).toFixed(2),
    setup: (row.setupPiasters / 100).toFixed(2),
    active: row.active,
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={t("admin.catalog.finishes.editTitle", {
        name: locale === "ar" ? row.nameAr : row.nameEn,
      })}
      primaryAction={{
        content: t("admin.common.save"),
        loading: busy === "finish",
        onAction: async () => {
          const r = await run(
            "finish",
            () =>
              updateFinishAction({
                id: row.id,
                unitSurchargePiasters: Math.round(Number(v.unit) * 100),
                setupPiasters: Math.round(Number(v.setup) * 100),
                active: v.active,
              }),
            t("admin.catalog.saved"),
          );
          setRes(r);
          if (r?.ok) onClose();
        },
      }}
      secondaryActions={[
        { content: t("admin.common.cancel"), onAction: onClose },
      ]}
    >
      <BlockStack gap="300">
        <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
          <TextField
            label={t("admin.catalog.finishes.unit")}
            autoComplete="off"
            inputMode="decimal"
            dir="ltr"
            value={v.unit}
            onChange={(x) => setV({ ...v, unit: x })}
            error={fieldError(res, "unitSurchargePiasters", errorText)}
          />
          <TextField
            label={t("admin.catalog.finishes.setup")}
            autoComplete="off"
            inputMode="decimal"
            dir="ltr"
            value={v.setup}
            onChange={(x) => setV({ ...v, setup: x })}
            error={fieldError(res, "setupPiasters", errorText)}
          />
        </InlineGrid>
        <Checkbox
          label={t("admin.catalog.activeLabel")}
          checked={v.active}
          onChange={(x) => setV({ ...v, active: x })}
          error={fieldError(res, "active", errorText)}
        />
      </BlockStack>
    </Modal>
  );
}
