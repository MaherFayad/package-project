"use client";

import { useEffect, useMemo, useState, type ReactNode, memo } from "react";
import { FACE_IDS, type DesignDoc, type DesignFinishCode, type Dims, type FaceId, type MaterialCode, type StructureFeatures } from "@/types";
import { CLOSURE_COLORS, LIQUIDS, type ClosureColorCode, type LiquidCode, type VesselDims } from "@/lib/vessels";
import { BOARD_SPECS } from "@/lib/dieline";
import type { BoxModelDef, ModelDef, VesselModelDef } from "@/lib/library";
import { describeVesselModel } from "@/lib/library/packs/common-vessel";
import type { DocGeometry } from "@/lib/library/doc";
import { FINISHES } from "@/lib/configurator";
import { formatDims, formatNumber } from "@/lib/format";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n/types";
import { Badge } from "@/components/ui/Badge";
import { BlockStack, InlineGrid } from "@/components/ui/Stack";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { RangeSlider } from "@/components/ui/RangeSlider";
import { Select } from "@/components/ui/Select";
import { Text } from "@/components/ui/Text";
import { TextField } from "@/components/ui/TextField";
import { featureSupportOf, finishChoicesFor, materialChoices, printSidesChoices, type Choice } from "./lib/config";
import { modelImage } from "./ModelPicker";
import { FlexOptionsGroup } from "./FlexOptionsGroup";
import { EGYPT_BADGE, egyptOf, orderModeOf } from "@/data/catalogue/order-mode";
import { parseMmInput } from "./lib/mm";
import styles from "./library.module.css";

export interface ViewOptions {
  dimensions: boolean;
  scene: "none" | "table" | "shelf" | "reference";
  turntable: boolean;
  open: boolean;
}

export interface ConfigPanelProps {
  doc: DesignDoc;
  model: ModelDef;
  geo: DocGeometry | null;
  view: ViewOptions;
  onView: (v: ViewOptions) => void;
  onOpenPicker: () => void;
  /** Geometry changes (size, board, features, container): the editor rescales artwork. */
  onGeometry: (patch: Partial<Pick<DesignDoc, "dims" | "materialCode" | "features" | "vessel">>) => void;
  onFinish: (code: DesignFinishCode, on: boolean) => void;
  onPrintSides: (sides: DesignDoc["printSides"]) => void;
}

/**
 * Configuration panel for any library model, driven by the configurator rules engine: every
 * option is listed, the ones no printer can make are disabled WITH the reason (Arabic or
 * English), warnings are shown under the option.
 */
/** Memoised: a price badge or tab click does not re-render the configurator (PERF-18). */
export const ConfigPanel = memo(function ConfigPanel(props: ConfigPanelProps) {
  const { doc, model, onOpenPicker } = props;
  const { t, locale } = useI18n();
  const base = t(`structures.${doc.structureCode}` as DictKey);
  const orderMode = orderModeOf(model.code).mode;
  return (
    <div className={styles.config}>
      <div className={styles.modelCurrent}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={modelImage(model.slug, model.code)} alt="" width={72} height={54} />
        <div className={styles.modelCurrentText}>
          <Text as="h2" variant="headingSm">
            <span data-testid="model-name">{model.name[locale]}</span>
          </Text>
          {model.standard && model.standard !== "none" ? (
            <Text as="p" variant="bodySm" tone="subdued">
              <span dir="ltr">{model.standard}</span>
            </Text>
          ) : null}
          {/* R4-B-10: quote-priced models are not "priced as" their base; preview models (filling
              line, rare) are not made as it by Egyptian printers either. */}
          {orderMode === "preview" ? (
            <Text as="p" variant="bodySm" tone="subdued">
              {t("library.panel.byQuote")}
            </Text>
          ) : model.code !== doc.structureCode ? (
            <Text as="p" variant="bodySm" tone="subdued">
              {t(orderMode === "quote" ? "library.panel.baseByQuote" : "library.panel.base", { base })}
            </Text>
          ) : null}
          {/* B-20: availability in Egypt on every model surface. */}
          <span data-testid="model-egypt">
            <Badge tone={egyptOf(model.code) === "local" ? "success" : egyptOf(model.code) === "imported" ? "attention" : "warning"} size="small">
              {EGYPT_BADGE[egyptOf(model.code)][locale]}
            </Badge>
          </span>
        </div>
        <div className={styles.modelCurrentActions}>
          <Button fullWidth onClick={onOpenPicker} accessibilityLabel={t("library.picker.open")}>
            {t("library.picker.open")}
          </Button>
        </div>
      </div>
      {model.kind === "box" ? <BoxSection {...props} model={model} /> : <VesselSection {...props} model={model} />}
    </div>
  );
});

/* ───────────────────────────── shared bits ───────────────────────────── */

function OptionGroup<T extends string>({
  legend,
  type,
  name,
  choices,
  selected,
  onChange,
  label,
  extra,
}: {
  legend: string;
  type: "radio" | "checkbox";
  name: string;
  choices: Choice<T>[];
  selected: T[];
  onChange: (value: T, checked: boolean) => void;
  label: (c: Choice<T>) => string;
  extra?: (c: Choice<T>) => ReactNode;
}) {
  const { t, locale } = useI18n();
  const row = (c: Choice<T>) => {
    const checked = selected.includes(c.value);
    // A selected option the rules no longer allow stays editable (so it can be removed).
    const disabled = !c.enabled && !checked;
    const id = `${name}-${c.value}`;
    return (
      <li key={c.value}>
        <label className={styles.optionRow} htmlFor={id} data-checked={checked} data-disabled={disabled}>
          <input
            id={id}
            type={type}
            name={name}
            value={c.value}
            checked={checked}
            disabled={disabled}
            // a11y R4-07 / R5: the whole row stays the click target, but the name is the short
            // label only; the reason, warning and finish placement are the description (2.5.3, 2.4.6).
            aria-labelledby={`${id}-name`}
            aria-describedby={[c.reason || c.warning ? `${id}-note` : "", checked && extra ? `${id}-extra` : ""].filter(Boolean).join(" ") || undefined}
            onChange={(e) => onChange(c.value, e.currentTarget.checked)}
          />
          <span className={styles.optionText}>
            <span id={`${id}-name`} className={styles.optionName}>
              {label(c)}
            </span>
            {c.reason && !c.enabled ? (
              <span id={`${id}-note`} className={styles.optionReason}>
                {t("library.panel.notAvailable")}: {c.reason[locale]}
              </span>
            ) : c.warning ? (
              <span id={`${id}-note`} className={styles.optionWarning}>
                {c.warning[locale]}
              </span>
            ) : null}
            {checked && extra ? <span id={`${id}-extra`}>{extra(c)}</span> : null}
          </span>
        </label>
      </li>
    );
  };
  // Usable options first; two or more the rules rule out fold into one disclosure, so their
  // reasons do not bury the choices that work (R2-05). Each reason stays tied to its input.
  const off = choices.filter((c) => !c.enabled && !selected.includes(c.value));
  const fold = off.length >= 2;
  const on = fold ? choices.filter((c) => !off.includes(c)) : choices;
  return (
    <fieldset className={styles.group} data-testid={`group-${name}`}>
      <legend className={styles.groupTitle}>{legend}</legend>
      <ul className={styles.optionList}>{on.map(row)}</ul>
      {fold ? (
        <details className={styles.unavailable}>
          <summary>{t("library.panel.unavailableCount", { count: formatNumber(off.length) })}</summary>
          <ul className={styles.optionList}>{off.map(row)}</ul>
        </details>
      ) : null}
    </fieldset>
  );
}

function FinishesGroup({ doc, model, onFinish }: Pick<ConfigPanelProps, "doc" | "onFinish"> & { model: ModelDef }) {
  const { t, locale } = useI18n();
  const choices = useMemo(() => finishChoicesFor(doc, model), [doc, model]);
  const selected = (doc.finishes ?? []).map((f) => f.code);
  return (
    <BlockStack gap="100">
      <OptionGroup
        legend={t("library.panel.finishes")}
        type="checkbox"
        name="finish"
        choices={choices}
        selected={selected}
        label={(c) => c.name[locale]}
        onChange={(v, on) => onFinish(v, on)}
        extra={(c) => {
          // Containers: the finish covers the whole label, so there is nothing to choose.
          if (!FINISHES[c.value].masked || model.kind !== "box") return null;
          const f = doc.finishes?.find((x) => x.code === c.value);
          if (!f) return null;
          const live = doc.artwork.outside.layers.filter((l) => !l.hidden && f.mask?.layerIds.includes(l.id));
          const text =
            live.length === 0
              ? t("library.panel.finishWholeFace")
              : live.every((l) => l.kind === "image")
                ? t(live.length === 1 ? "library.panel.finishOnLogo" : "library.panel.finishOnImages", { count: formatNumber(live.length) })
                : t("library.panel.finishOnItems", { count: formatNumber(live.length) });
          return <span className={styles.optionReason}>{text}</span>;
        }}
      />
      <Text as="p" variant="bodySm" tone="subdued">
        {t("library.panel.finishesHelp")}
      </Text>
    </BlockStack>
  );
}

function ViewGroup({ view, onView, vessel }: Pick<ConfigPanelProps, "view" | "onView"> & { vessel: boolean }) {
  const { t } = useI18n();
  return (
    <fieldset className={styles.group}>
      <legend className={styles.groupTitle}>{t("library.panel.view")}</legend>
      {!vessel ? (
        <>
          <Checkbox label={t("library.panel.dimensions")} checked={view.dimensions} onChange={(v) => onView({ ...view, dimensions: v })} />
          <Select
            label={t("library.panel.scene")}
            value={view.scene}
            options={[
              { value: "none", label: t("library.panel.sceneNone") },
              { value: "table", label: t("library.panel.sceneTable") },
              { value: "shelf", label: t("library.panel.sceneShelf") },
              { value: "reference", label: t("library.panel.sceneReference") },
            ]}
            onChange={(v) => onView({ ...view, scene: v as ViewOptions["scene"] })}
          />
        </>
      ) : null}
      <Checkbox label={t("library.panel.turntable")} checked={view.turntable} onChange={(v) => onView({ ...view, turntable: v })} />
    </fieldset>
  );
}

/* ───────────────────────────── boxes ───────────────────────────── */

const AXIS_KEY = { L: "designer.box.length", W: "designer.box.width", H: "designer.box.height" } as const;

function BoxSection({ doc, model, geo, view, onView, onGeometry, onFinish, onPrintSides }: ConfigPanelProps & { model: BoxModelDef }) {
  const { t, locale } = useI18n();
  const cylinder = model.shape === "cylinder";
  const [draft, setDraft] = useState({ L: String(doc.dims.L), W: String(doc.dims.W), H: String(doc.dims.H) });
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setDraft({ L: String(doc.dims.L), W: String(doc.dims.W), H: String(doc.dims.H) });
    setInvalid(false);
  }, [doc.dims.L, doc.dims.W, doc.dims.H, model.code]);

  const tryDims = (next: typeof draft) => {
    setDraft(next);
    // R5-JR-20: typed as text (Arabic-Indic digits, decimal comma), read with parseMmInput.
    const dims: Dims = { L: parseMmInput(next.L), W: cylinder ? parseMmInput(next.L) : parseMmInput(next.W), H: parseMmInput(next.H) };
    if (![dims.L, dims.W, dims.H].every((n) => Number.isFinite(n) && n > 0)) return setInvalid(true);
    try {
      model.build(dims, { thicknessMm: BOARD_SPECS[doc.materialCode].thicknessMm, features: doc.features });
      setInvalid(false);
      onGeometry({ dims });
    } catch {
      setInvalid(true);
    }
  };

  const support = featureSupportOf(model, doc);
  const f = doc.features ?? {};
  const setFeature = (patch: Partial<StructureFeatures>) => {
    const next: StructureFeatures = { ...f, ...patch };
    for (const k of Object.keys(next) as (keyof StructureFeatures)[]) if (next[k] === undefined || next[k] === false || next[k] === null) delete next[k];
    onGeometry({ features: next });
  };
  const materials = useMemo(() => materialChoices(doc, model), [doc, model]);
  const sides = useMemo(() => printSidesChoices(doc, model), [doc, model]);
  const activePreset = model.presets.find((p) => p.dims.L === doc.dims.L && p.dims.W === doc.dims.W && p.dims.H === doc.dims.H);
  const lims = model.limits;
  const axes = (cylinder ? (["L", "H"] as const) : (["L", "W", "H"] as const)) as readonly ("L" | "W" | "H")[];

  return (
    <>
      {model.presets.length > 0 ? (
        <fieldset className={styles.group}>
          <legend className={styles.groupTitle}>{t("library.panel.presets")}</legend>
          <div className={styles.presetRow}>
            {model.presets.map((p) => (
              <Button key={p.id} size="slim" pressed={activePreset?.id === p.id} onClick={() => onGeometry({ dims: { ...p.dims } })}>
                {p.name[locale]}
              </Button>
            ))}
          </div>
          {activePreset?.standard ? (
            <span>
              <Badge tone="success" progress="complete">
                {t("designer.box.standard")}
              </Badge>
            </span>
          ) : null}
        </fieldset>
      ) : null}

      <fieldset className={styles.group}>
        <legend className={styles.groupTitle}>{t("library.panel.size")}</legend>
        <div className={styles.sizeGrid}>
          {axes.map((axis) => (
            <TextField
              key={axis}
              label={cylinder && axis === "L" ? t("library.panel.diameter") : t(AXIS_KEY[axis])}
              type="text"
              inputMode="decimal"
              spinbutton={{
                now: parseMmInput(draft[axis]),
                min: lims[axis].min,
                max: lims[axis].max,
                onStep: (d) => {
                  const cur = parseMmInput(draft[axis]);
                  const base = Number.isFinite(cur) ? cur : lims[axis].min;
                  tryDims({ ...draft, [axis]: String(Math.min(lims[axis].max, Math.max(lims[axis].min, Math.round((base + d) * 10) / 10))) });
                },
              }}
              autoComplete="off"
              dir="ltr"
              min={lims[axis].min}
              max={lims[axis].max}
              value={draft[axis]}
              onChange={(v) => tryDims({ ...draft, [axis]: v })}
              helpText={<bdi dir="ltr">{`${lims[axis].min}–${lims[axis].max}`}</bdi>}
              suffix={t("common.mm")}
            />
          ))}
        </div>
        {invalid ? (
          <Text as="p" variant="bodySm" tone="critical">
            <span role="alert">{t("library.panel.sizeInvalid")}</span>
          </Text>
        ) : geo ? (
          <Text as="p" variant="bodySm" tone="subdued">
            {t("designer.box.outer", { dims: formatDims(roundDims(geo.dieline.closedOuter), locale) })}
          </Text>
        ) : null}
      </fieldset>

      <OptionGroup
        legend={t("library.panel.material")}
        type="radio"
        name="material"
        choices={materials}
        selected={[doc.materialCode]}
        label={(c) => t(`materials.${c.value}` as DictKey)}
        onChange={(v) => onGeometry({ materialCode: v as MaterialCode })}
      />

      <OptionGroup
        legend={t("library.panel.printSides")}
        type="radio"
        name="sides"
        choices={sides}
        selected={[doc.printSides]}
        label={(c) => (c.value === "OUTSIDE" ? t("designer.box.printOutside") : t("designer.box.printBoth"))}
        onChange={(v) => onPrintSides(v)}
      />

      <FinishesGroup doc={doc} model={model} onFinish={onFinish} />

      {support.windowFaces.length || support.handle || support.tearStrip || support.thumbNotch || support.partitions || support.lidHeight || support.displayFront ? (
        <fieldset className={styles.group}>
          <legend className={styles.groupTitle}>{t("library.panel.addOns")}</legend>
          {support.windowFaces.length ? (
            <>
              <Checkbox label={t("library.panel.window")} checked={!!f.window} onChange={(on) => setFeature({ window: on ? { face: support.windowFaces[0], film: true } : null })} />
              {f.window && support.windowFaces.length > 1 ? (
                <Select
                  label={t("library.panel.windowFace")}
                  value={f.window.face}
                  options={support.windowFaces.map((w) => ({ value: w, label: t(`designer.faces.${w}` as DictKey) }))}
                  onChange={(v) => setFeature({ window: { ...f.window!, face: v as FaceId } })}
                />
              ) : null}
            </>
          ) : null}
          {support.handle && model.code !== "GABLE_BOX" ? <Checkbox label={t("library.panel.handle")} checked={!!f.handle} onChange={(on) => setFeature({ handle: on })} /> : null}
          {support.tearStrip ? <Checkbox label={t("library.panel.tearStrip")} checked={!!f.tearStrip} onChange={(on) => setFeature({ tearStrip: on })} /> : null}
          {support.thumbNotch ? <Checkbox label={t("library.panel.thumbNotch")} checked={!!f.thumbNotch} onChange={(on) => setFeature({ thumbNotch: on })} /> : null}
          {support.displayFront ? <Checkbox label={t("library.panel.displayFront")} checked={!!f.displayFront} onChange={(on) => setFeature({ displayFront: on })} /> : null}
          {support.partitions ? (
            <>
              <Checkbox label={t("library.panel.dividers")} checked={!!f.partitions} onChange={(on) => setFeature({ partitions: on ? { rows: 2, cols: 2 } : null })} />
              {f.partitions ? (
                <InlineGrid columns={2} gap="200">
                  <Select label={t("library.panel.rows")} value={String(f.partitions.rows)} options={["1", "2", "3", "4"]} onChange={(v) => setFeature({ partitions: { ...f.partitions!, rows: Number(v) } })} />
                  <Select label={t("library.panel.cols")} value={String(f.partitions.cols)} options={["1", "2", "3", "4"]} onChange={(v) => setFeature({ partitions: { ...f.partitions!, cols: Number(v) } })} />
                </InlineGrid>
              ) : null}
            </>
          ) : null}
          {support.lidHeight ? (
            <RangeSlider
              label={t("library.panel.lidHeight")}
              min={10}
              max={Math.max(20, Math.round(doc.dims.H))}
              step={5}
              value={Math.min(Math.round(doc.dims.H), f.lidHeightMm ?? Math.round(doc.dims.H))}
              output
              formatValue={(v) => `${formatNumber(v)} ${t("common.mm")}`}
              onChange={(v) => setFeature({ lidHeightMm: v })}
            />
          ) : null}
        </fieldset>
      ) : null}

      <ViewGroup view={view} onView={onView} vessel={false} />
    </>
  );
}

function roundDims(d: Dims): Dims {
  return { L: Math.round(d.L), W: Math.round(d.W), H: Math.round(d.H) };
}

/* ───────────────────────────── containers ───────────────────────────── */

function VesselSection({ doc, model, geo, view, onView, onGeometry, onFinish }: ConfigPanelProps & { model: VesselModelDef }) {
  const { t, locale } = useI18n();
  const v = doc.vessel!;
  const [draft, setDraft] = useState({ D: String(v.dims.D), H: String(v.dims.H), G: v.dims.G !== undefined ? String(v.dims.G) : "" });
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setDraft({ D: String(v.dims.D), H: String(v.dims.H), G: v.dims.G !== undefined ? String(v.dims.G) : "" });
    setInvalid(false);
  }, [v.dims.D, v.dims.H, v.dims.G, model.code]);

  const setVessel = (patch: Partial<NonNullable<DesignDoc["vessel"]>>) => onGeometry({ vessel: { ...v, ...patch } });

  const tryDims = (next: typeof draft) => {
    setDraft(next);
    const dims: VesselDims = { D: parseMmInput(next.D), H: parseMmInput(next.H), ...(model.limits.G && next.G !== "" ? { G: parseMmInput(next.G) } : {}), ...(v.dims.taper !== undefined ? { taper: v.dims.taper } : {}) };
    const inRange = (n: number | undefined, r?: { min: number; max: number }) => n === undefined || !r || (Number.isFinite(n) && n >= r.min && n <= r.max);
    if (!inRange(dims.D, model.limits.D) || !inRange(dims.H, model.limits.H) || !inRange(dims.G, model.limits.G)) return setInvalid(true);
    try {
      const d = describeVesselModel(model, dims, v.surfaces, undefined, v.container, v.options, v.closure);
      if (!d.areas.length) throw new Error("no print area");
      setInvalid(false);
      setVessel({ dims, presetId: undefined });
    } catch {
      setInvalid(true);
    }
  };

  const materials = useMemo(() => materialChoices(doc, model), [doc, model]);
  const axes: ("D" | "H" | "G")[] = model.limits.G ? ["D", "H", "G"] : ["D", "H"];
  const axisLabel = (a: "D" | "H" | "G") => (a === "D" ? t(model.axes.D === "width" ? "library.panel.width" : "library.panel.diameter") : a === "H" ? t("library.panel.height") : t(model.axes.G === "gusset" ? "library.panel.gusset" : "library.panel.depth"));
  const toggleSurface = (s: string, on: boolean) => {
    const next = on ? [...new Set([...v.surfaces, s])] : v.surfaces.filter((x) => x !== s);
    if (next.length === 0) return;
    // A wrap label and a full sleeve exclude front / back labels on the same body.
    const exclusive = ["WRAP", "SHRINK_SLEEVE"];
    let surfaces = next;
    if (on && exclusive.includes(s)) surfaces = next.filter((x) => x === s || !["WRAP", "FRONT", "BACK", "SHRINK_SLEEVE"].includes(x));
    if (on && (s === "FRONT" || s === "BACK")) surfaces = next.filter((x) => !exclusive.includes(x));
    onGeometry({ vessel: { ...v, surfaces } });
  };

  return (
    <>
      <fieldset className={styles.group}>
        <legend className={styles.groupTitle}>{t("library.panel.presets")}</legend>
        <div className={styles.presetRow}>
          {model.presets.map((p) => (
            <Button key={p.id} size="slim" pressed={v.presetId === p.id} onClick={() => setVessel({ dims: { ...p.dims }, presetId: p.id })}>
              {p.name[locale]}
            </Button>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.groupTitle}>{t("library.panel.size")}</legend>
        <div className={styles.sizeGrid}>
          {axes.map((a) => {
            const r = model.limits[a]!;
            return (
              <TextField
                key={a}
                label={axisLabel(a)}
                type="text"
                inputMode="decimal"
                spinbutton={{
                  now: parseMmInput(draft[a]),
                  min: r.min,
                  max: r.max,
                  onStep: (d) => {
                    const cur = parseMmInput(draft[a]);
                    const base = Number.isFinite(cur) ? cur : r.min;
                    tryDims({ ...draft, [a]: String(Math.min(r.max, Math.max(r.min, Math.round((base + d) * 10) / 10))) });
                  },
                }}
                autoComplete="off"
                dir="ltr"
                min={r.min}
                max={r.max}
                value={draft[a]}
                onChange={(val) => tryDims({ ...draft, [a]: val })}
                helpText={<bdi dir="ltr">{`${r.min}–${r.max}`}</bdi>}
                suffix={t("common.mm")}
              />
            );
          })}
        </div>
        {invalid ? (
          <Text as="p" variant="bodySm" tone="critical">
            <span role="alert">{t("library.panel.sizeInvalid")}</span>
          </Text>
        ) : null}
      </fieldset>

      {model.containers.length > 0 ? (
        <Select
          label={t("library.panel.container")}
          value={v.container}
          options={model.containers.map((c) => ({ value: c.code, label: c.name[locale] }))}
          onChange={(val) => setVessel({ container: val })}
        />
      ) : null}
      {model.render === "flexible" ? <FlexOptionsGroup code={model.code} vessel={v} onChange={(options) => setVessel({ options })} /> : null}
      {model.closures.length > 0 ? (
        <>
          <Select
            label={t("library.panel.closure")}
            value={v.closure}
            options={model.closures.map((c) => ({ value: c.code, label: c.name[locale] }))}
            onChange={(val) => {
              // a colour the buyer has not changed follows the closure's own default (bare metal
              // crowns, a clear lid on a clear tray): R5-3Q-F-13 / G-25
              const before = model.closures.find((c) => c.code === v.closure)?.defaultColor ?? "WHITE";
              const next = model.closures.find((c) => c.code === val)?.defaultColor ?? "WHITE";
              setVessel(v.closureColor === before ? { closure: val, closureColor: next } : { closure: val });
            }}
          />
          <fieldset className={styles.group}>
            <legend className={styles.groupTitle}>{t("library.panel.closureColor")}</legend>
            <div className={styles.swatches}>
              {model.closures.find((c) => c.code === v.closure)?.defaultColor === "MATCH" || v.closureColor === "MATCH" ? (
                <button
                  type="button"
                  className={styles.swatch}
                  data-match=""
                  style={{ background: model.containers.find((c) => c.code === v.container)?.tint ?? "linear-gradient(135deg, #f3f3f1 0 45%, #c9ced3 55% 100%)" }}
                  aria-pressed={v.closureColor === "MATCH"}
                  aria-label={t("library.colors.MATCH" as DictKey)}
                  title={t("library.colors.MATCH" as DictKey)}
                  onClick={() => setVessel({ closureColor: "MATCH" })}
                />
              ) : null}
              {(Object.keys(CLOSURE_COLORS) as ClosureColorCode[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  className={styles.swatch}
                  style={{ background: CLOSURE_COLORS[c].hex }}
                  aria-pressed={v.closureColor === c}
                  aria-label={t(`library.colors.${c}` as DictKey)}
                  title={t(`library.colors.${c}` as DictKey)}
                  onClick={() => setVessel({ closureColor: c })}
                />
              ))}
            </div>
          </fieldset>
        </>
      ) : null}
      {model.fillable ? (
        <>
          <Select
            label={t("library.panel.content")}
            value={v.content}
            options={(Object.keys(LIQUIDS) as LiquidCode[]).map((l) => ({ value: l, label: LIQUIDS[l].name[locale] }))}
            onChange={(val) => setVessel({ content: val })}
          />
          <RangeSlider
            label={t("library.panel.fill")}
            min={0}
            max={100}
            step={5}
            value={Math.round(v.fill * 100)}
            output
            formatValue={(n) => t("library.panel.fillValue", { pct: n })}
            onChange={(n) => setVessel({ fill: n / 100 })}
          />
        </>
      ) : null}

      <fieldset className={styles.group} data-testid="group-surfaces">
        <legend className={styles.groupTitle}>{t("library.panel.surfaces")}</legend>
        {model.surfaces.map((s) => {
          const area = geo?.vessel?.areas.find((a) => a.kind === s);
          return (
            <Checkbox
              key={s}
              label={area ? area.name[locale] : surfaceName(s, locale)}
              helpText={area ? <span dir="ltr">{t("library.panel.surfaceSize", { w: formatNumber(Math.round(area.trimWidthMm)), h: formatNumber(Math.round(area.trimHeightMm)) })}</span> : undefined}
              checked={v.surfaces.includes(s)}
              onChange={(on) => toggleSurface(s, on)}
            />
          );
        })}
      </fieldset>

      <OptionGroup
        legend={t("library.panel.printMaterial")}
        type="radio"
        name="material"
        choices={materials}
        selected={[doc.materialCode]}
        label={(c) => t(`materials.${c.value}` as DictKey)}
        onChange={(val) => onGeometry({ materialCode: val as MaterialCode })}
      />

      <FinishesGroup doc={doc} model={model} onFinish={onFinish} />

      <ViewGroup view={view} onView={onView} vessel />
    </>
  );
}

const SURFACE_NAMES: Record<string, { ar: string; en: string }> = {
  WRAP: { ar: "ملصق ملفوف", en: "Wrap-around label" },
  FRONT: { ar: "ملصق أمامي", en: "Front label" },
  BACK: { ar: "ملصق خلفي", en: "Back label" },
  SHRINK_SLEEVE: { ar: "غلاف انكماش كامل", en: "Full shrink sleeve" },
  NECK: { ar: "ملصق العنق", en: "Neck label" },
  LID: { ar: "ملصق الغطاء", en: "Lid label" },
  front: { ar: "الوجه الأمامي", en: "Front panel" },
  back: { ar: "الوجه الخلفي", en: "Back panel" },
  gussetLeft: { ar: "الجانب الأيسر", en: "Left gusset" },
  gussetRight: { ar: "الجانب الأيمن", en: "Right gusset" },
  bottom: { ar: "القاعدة", en: "Bottom" },
  sleeve: { ar: "الغلاف", en: "Sleeve" },
};

export function surfaceName(s: string, locale: "ar" | "en"): string {
  return SURFACE_NAMES[s]?.[locale] ?? s;
}

export { FACE_IDS };
