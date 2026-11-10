"use client";

import { useEffect, useMemo, useState, type ReactNode, memo } from "react";
import { FACE_IDS, type DesignDoc, type DesignFinishCode, type Dims, type FaceId, type MaterialCode, type StructureFeatures } from "@/types";
import { CLOSURE_COLORS, LIQUIDS, type ClosureColorCode, type LiquidCode, type VesselDims } from "@/lib/vessels";
import { BOARD_SPECS } from "@/lib/dieline";
import type { BoxModelDef, ModelDef, VesselModelDef } from "@/lib/library";
import type { DocGeometry } from "@/lib/library/doc";
import { FINISHES, MAX_FOIL_COLOURS } from "@/lib/configurator";
import { formatDims, formatNumber } from "@/lib/format";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n/types";
import { Badge } from "@/components/ui/Badge";
import { InlineGrid } from "@/components/ui/Stack";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { RangeSlider } from "@/components/ui/RangeSlider";
import { Select } from "@/components/ui/Select";
import { Text } from "@/components/ui/Text";
import { TextField } from "@/components/ui/TextField";
import { useUi } from "@/components/ui/AppProvider";
import { fill } from "@/components/ui/strings";
import { describeVesselDraft, featureSupportOf, neckFinishLabel, finishChoicesFor, materialChoices, printSidesChoices, type Choice } from "./lib/config";
import { modelImage } from "./ModelPicker";
import { FlexOptionsGroup } from "./FlexOptionsGroup";
import { BagHandleGroup } from "./BagHandleGroup";
import { EGYPT_BADGE, egyptOf, orderModeOf } from "@/data/catalogue/order-mode";
import { parseMmInput } from "./lib/mm";
import { Check, Info } from "lucide-react";
import { AddOnIcon, BoardSwatch, BoxSketch, FinishSwatch, type AddOnKind } from "./OptionVisuals";
import styles from "./library.module.css";
import o from "./options.module.css";

/** a11y R6-AX-09 (WCAG 3.3.1): name the size field that is wrong, not only "this size cannot be made". */
function useSizeError() {
  const { s } = useUi();
  return (text: string, min: number, max: number) => {
    if (text.trim() === "") return s.numberInvalid;
    const n = parseMmInput(text);
    if (!Number.isFinite(n)) return s.numberInvalid;
    return n < min || n > max ? fill(s.numberRange, { min, max }) : undefined;
  };
}

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
  /** The View group (dimensions, scene, turntable). Dev page only: the designer has them in its bottom bar. */
  viewControls?: boolean;
  onOpenPicker: () => void;
  /** Geometry changes (size, board, features, container): the editor rescales artwork. */
  onGeometry: (patch: Partial<Pick<DesignDoc, "dims" | "materialCode" | "features" | "vessel">>) => void;
  onFinish: (code: DesignFinishCode, on: boolean) => void;
  /** Pick-one finish groups: remove `off` and add `on` as one step (swapFinish). */
  onFinishSwap: (off: DesignFinishCode[], on: DesignFinishCode | null) => void;
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
  // R14-04: a bottle or jar shows the neck finish of the chosen closure, not the preset's finish id.
  const neck = neckFinishLabel(model, doc.vessel?.closure, locale);
  return (
    <div className={styles.config}>
      <div className={styles.modelCurrent}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={modelImage(model.slug, model.code)} alt="" width={72} height={54} />
        <div className={styles.modelCurrentText}>
          <Text as="h2" variant="headingSm">
            <span data-testid="model-name">{model.name[locale]}</span>
          </Text>
          {neck ? (
            <Text as="p" variant="bodySm" tone="subdued">
              <bdi data-testid="model-neck">{neck}</bdi>
            </Text>
          ) : null}
          {/* R2-07: no FEFCO / ECMA code for buyers; printers get it on the order's print sheet. */}
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

/** R2-07: the plain board name a shop owner reads ("Natural brown board"), the trade grade when there is none. */
function plainMaterial(t: (k: DictKey) => string, code: string): string {
  const key = `materialsPlain.${code}` as DictKey;
  const plain = t(key);
  return plain === key ? t(`materials.${code}` as DictKey) : plain;
}

const NONE = "__none";

function OptionGroup<T extends string>({
  legend,
  type,
  name,
  choices,
  selected,
  onChange,
  label,
  extra,
  layout = "list",
  visual,
  line,
  none,
  foot,
  testId,
}: {
  legend: string;
  type: "radio" | "checkbox";
  name: string;
  choices: Choice<T>[];
  selected: T[];
  onChange: (value: T, checked: boolean) => void;
  label: (c: Choice<T>) => string;
  extra?: (c: Choice<T>) => ReactNode;
  /** options-visual: "rows" = wide picture cards (board), "tiles" = a grid of picture tiles (finishes). */
  layout?: "list" | "rows" | "tiles";
  visual?: (c: Choice<T>) => ReactNode;
  /** One short line under the name (part of the description). */
  line?: (c: Choice<T>) => string | null;
  /** Pick-one groups: a first «None» card (checked when nothing in the group is chosen). */
  none?: { label: string; visual?: ReactNode; onPick: () => void };
  /** Shown under the cards (a note, a link). */
  foot?: ReactNode;
  testId?: string;
}) {
  const { t, locale } = useI18n();
  // R2-07: a warning shared by two or more options (the foil line-width note on every foil colour)
  // shows once under the group; each of those options is described by that one note.
  const warnCount = new Map<string, number>();
  for (const c of choices) if (c.warning && !(c.reason && !c.enabled)) warnCount.set(c.warning[locale], (warnCount.get(c.warning[locale]) ?? 0) + 1);
  const shared = [...warnCount].filter(([, n]) => n > 1).map(([w]) => w);
  const sharedId = (w: string) => `${name}-shared-${shared.indexOf(w)}`;
  const row = (c: Choice<T>) => {
    const isNone = !!none && c.value === NONE;
    const checked = isNone ? selected.length === 0 : selected.includes(c.value);
    const sharedWarn = c.warning && shared.includes(c.warning[locale]) && !(c.reason && !c.enabled) ? c.warning[locale] : null;
    // A selected option the rules no longer allow stays editable (so it can be removed).
    const disabled = !c.enabled && !checked;
    const id = `${name}-${c.value}`;
    const describedBy = [sharedWarn ? sharedId(sharedWarn) : c.reason || c.warning ? `${id}-note` : "", checked && !isNone && extra ? `${id}-extra` : ""].filter(Boolean).join(" ") || undefined;
    if (layout !== "list") {
      const sub = isNone ? null : line?.(c);
      return (
        <li key={c.value}>
          <label className={o.card} htmlFor={id} data-checked={checked} data-disabled={disabled} data-kind={type}>
            <input
              id={id}
              className={o.srOnly}
              type={type}
              name={name}
              value={c.value}
              checked={checked}
              disabled={disabled}
              aria-labelledby={`${id}-name`}
              aria-describedby={[sub ? `${id}-line` : "", describedBy ?? ""].filter(Boolean).join(" ") || undefined}
              onChange={(e) => (isNone ? none.onPick() : onChange(c.value, e.currentTarget.checked))}
            />
            {isNone ? none.visual : visual ? visual(c) : null}
            <span className={o.cardText}>
              <span id={`${id}-name`} className={o.cardName}>
                {isNone ? none.label : label(c)}
              </span>
              {sub ? (
                <span id={`${id}-line`} className={o.cardLine}>
                  {sub}
                </span>
              ) : null}
              {c.reason && !c.enabled ? (
                <span id={`${id}-note`} className={o.cardReason}>
                  {t("library.panel.notAvailable")}: {c.reason[locale]}
                </span>
              ) : c.warning && !sharedWarn ? (
                <span id={`${id}-note`} className={o.cardWarning}>
                  {c.warning[locale]}
                </span>
              ) : null}
              {checked && !isNone && extra ? <span id={`${id}-extra`}>{extra(c)}</span> : null}
            </span>
            <span className={o.tick} aria-hidden="true">
              <Check size={12} strokeWidth={3} />
            </span>
          </label>
        </li>
      );
    }
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
            aria-describedby={describedBy}
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
            ) : c.warning && !sharedWarn ? (
              <span id={`${id}-note`} className={styles.optionWarning}>
                {c.warning[locale]}
              </span>
            ) : null}
            {checked && !isNone && extra ? <span id={`${id}-extra`}>{extra(c)}</span> : null}
          </span>
        </label>
      </li>
    );
  };
  // Usable options first; two or more the rules rule out fold into one disclosure, so their
  // reasons do not bury the choices that work (R2-05). Each reason stays tied to its input.
  const off = choices.filter((c) => !c.enabled && !selected.includes(c.value));
  const fold = off.length >= 2;
  const usable = fold ? choices.filter((c) => !off.includes(c)) : choices;
  const on = none ? [{ value: NONE as T, name: { ar: none.label, en: none.label }, enabled: true }, ...usable] : usable;
  const listClass = layout === "rows" ? o.rows : layout === "tiles" ? o.tiles : styles.optionList;
  return (
    <fieldset className={styles.group} data-testid={testId ?? `group-${name}`} role={type === "radio" ? "radiogroup" : undefined} aria-labelledby={`${name}-legend`}>
      <legend id={`${name}-legend`} className={styles.groupTitle}>
        {legend}
      </legend>
      <ul className={listClass}>{on.map(row)}</ul>
      {shared.map((w) =>
        layout === "list" ? (
          <p key={w} id={sharedId(w)} className={styles.optionWarning}>
            {w}
          </p>
        ) : (
          <p key={w} id={sharedId(w)} className={o.note}>
            <Info size={14} aria-hidden />
            <span>{w}</span>
          </p>
        ),
      )}
      {fold ? (
        <details className={styles.unavailable}>
          <summary>{t("library.panel.unavailableCount", { count: formatNumber(off.length) })}</summary>
          <ul className={listClass}>{off.map(row)}</ul>
        </details>
      ) : null}
      {foot}
    </fieldset>
  );
}

type FinishGroup = "coating" | "foil" | "spotUv" | "relief";
const groupOf = (c: DesignFinishCode) => FINISHES[c].group as FinishGroup;
/** The doc without the given finishes: a pick-one group is judged as "what if this one replaced the current one". */
const without = (doc: DesignDoc, codes: DesignFinishCode[]): DesignDoc => ({ ...doc, finishes: (doc.finishes ?? []).filter((f) => !codes.includes(f.code)) });

/**
 * Finishes in the groups the rules define (finish groups, 2026-11-09): one coating, one foil colour
 * (a second one on another part of the design, up to MAX_FOIL_COLOURS), spot UV on its own, one
 * relief. Pick-one groups are radios with a «None» card; a card the rules rule out says why.
 */
function FinishesGroup({ doc, model, onFinish, onFinishSwap: swap }: Pick<ConfigPanelProps, "doc" | "onFinish" | "onFinishSwap"> & { model: ModelDef }) {
  const { t, locale } = useI18n();
  const [secondOpen, setSecondOpen] = useState(false);
  const picked = (doc.finishes ?? []).map((f) => f.code);
  const inGroup = (g: FinishGroup) => picked.filter((c) => groupOf(c) === g);
  const coats = inGroup("coating");
  const foils = inGroup("foil");
  const reliefs = inGroup("relief");
  const [foil1, foil2] = foils;
  const base = model.kind === "box" && doc.materialCode.includes("KRAFT") ? "kraft" : "white";
  const usedReason = t("library.panel.foilUsed");
  const groups = useMemo(() => {
    const judge = (d: DesignDoc, g: FinishGroup) => finishChoicesFor(d, model).filter((c) => groupOf(c.value) === g);
    const codes = (doc.finishes ?? []).map((f) => f.code);
    const of = (g: FinishGroup) => codes.filter((c) => groupOf(c) === g);
    const [f1, f2] = of("foil");
    return {
      coating: judge(without(doc, of("coating")), "coating"),
      foil: judge(without(doc, of("foil")), "foil"),
      // the second colour: judged next to the first; the first colour itself is taken
      second: f1 ? judge(without(doc, f2 ? [f2] : []), "foil").map((c) => (c.value === f1 ? { ...c, enabled: false, reason: { ar: usedReason, en: usedReason } } : c)) : [],
      spotUv: judge(doc, "spotUv"),
      relief: judge(without(doc, of("relief")), "relief"),
    };
  }, [doc, model, usedReason]);

  const visual = (c: Choice<DesignFinishCode>) => <FinishSwatch code={c.value} base={base} />;
  const noneVisual = <span className={o.finishSwatch} data-finish="NONE" data-base={base} aria-hidden="true" />;
  // Where a masked finish sits (on the logo, on 2 items, the whole front).
  const extra = (c: Choice<DesignFinishCode>) => {
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
  };
  const common = { label: (c: Choice<DesignFinishCode>) => c.name[locale], layout: "tiles" as const, visual, extra };
  const noneLabel = t("library.panel.finishNone");
  const canSecond = !!foil1 && MAX_FOIL_COLOURS >= 2 && groups.second.some((c) => c.enabled);
  const showSecond = !!foil2 || (secondOpen && canSecond);
  const showRelief = reliefs.length > 0 || groups.relief.some((c) => c.enabled);

  return (
    <div className={o.finishGroups} data-testid="group-finish">
      <Text as="h3" variant="headingSm">
        {t("library.panel.finishes")}
      </Text>
      <OptionGroup
        {...common}
        legend={t("library.panel.coating")}
        type="radio"
        name="finish-coating"
        choices={groups.coating}
        selected={coats}
        none={{ label: noneLabel, visual: noneVisual, onPick: () => swap(coats, null) }}
        onChange={(v) => swap(coats, v)}
      />
      <OptionGroup
        {...common}
        legend={t("library.panel.foil")}
        type="radio"
        name="finish-foil"
        choices={groups.foil}
        selected={foil1 ? [foil1] : []}
        none={{ label: noneLabel, visual: noneVisual, onPick: () => swap(foils, null) }}
        onChange={(v) => swap(foil1 ? [foil1] : [], v)}
        foot={
          <>
            {foil1 && model.kind === "box" ? (
              <Text as="p" variant="bodySm" tone="subdued">
                {t("library.panel.foilWhere")}
              </Text>
            ) : null}
            {canSecond && !showSecond ? (
              <span>
                <Button variant="plain" onClick={() => setSecondOpen(true)}>
                  {t("library.panel.foilAddSecond")}
                </Button>
              </span>
            ) : null}
          </>
        }
      />
      {showSecond ? (
        <OptionGroup
          {...common}
          legend={t("library.panel.foilSecond")}
          type="radio"
          name="finish-foil2"
          choices={groups.second}
          selected={foil2 ? [foil2] : []}
          none={{
            label: noneLabel,
            visual: noneVisual,
            onPick: () => {
              swap(foil2 ? [foil2] : [], null);
              setSecondOpen(false);
            },
          }}
          onChange={(v) => swap(foil2 ? [foil2] : [], v)}
        />
      ) : null}
      <OptionGroup {...common} legend={t("library.panel.spotUv")} type="checkbox" name="finish-uv" choices={groups.spotUv} selected={inGroup("spotUv")} onChange={(v, on) => onFinish(v, on)} />
      {showRelief ? (
        <OptionGroup
          {...common}
          legend={t("library.panel.relief")}
          type="radio"
          name="finish-relief"
          choices={groups.relief}
          selected={reliefs}
          none={{ label: noneLabel, visual: noneVisual, onPick: () => swap(reliefs, null) }}
          onChange={(v) => swap(reliefs, v)}
        />
      ) : null}
    </div>
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

/** Added by bags: a bag is sized width x gusset x height. */
const BAG_AXIS_KEY = { L: "library.panel.width", W: "library.panel.gusset", H: "library.panel.height" } as const;
const AXIS_KEY = { L: "designer.box.length", W: "designer.box.width", H: "designer.box.height" } as const;

function BoxSection({ doc, model, geo, view, onView, viewControls, onGeometry, onFinish, onFinishSwap, onPrintSides }: ConfigPanelProps & { model: BoxModelDef }) {
  const { t, locale } = useI18n();
  const cylinder = model.shape === "cylinder";
  const [draft, setDraft] = useState({ L: String(doc.dims.L), W: String(doc.dims.W), H: String(doc.dims.H) });
  const [invalid, setInvalid] = useState(false);
  const sizeError = useSizeError();
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
  const presetFit = useMemo<Dims>(() => ({ L: Math.max(...model.presets.map((p) => p.dims.L)), W: Math.max(...model.presets.map((p) => p.dims.W)), H: Math.max(...model.presets.map((p) => p.dims.H)) }), [model.presets]);
  const lims = model.limits;
  const axes = (cylinder ? (["L", "H"] as const) : (["L", "W", "H"] as const)) as readonly ("L" | "W" | "H")[];

  return (
    <>
      {model.presets.length > 0 ? (
        <fieldset className={styles.group}>
          <legend className={styles.groupTitle}>{t("library.panel.presets")}</legend>
          {/* options-visual: a card per size with the box drawn to its own proportions. */}
          <ul className={o.tiles} data-testid="preset-cards">
            {model.presets.map((p) => (
              <li key={p.id}>
                <button type="button" className={o.card} aria-pressed={activePreset?.id === p.id} onClick={() => onGeometry({ dims: { ...p.dims } })}>
                  <BoxSketch dims={p.dims} fit={presetFit} />
                  <span className={o.cardText}>
                    <span className={o.cardName}>{p.name[locale]}</span>
                    <span className={o.cardLine}>{t("designer.simple.sizeCm", { dims: `⁦${cm(p.dims.L)} × ${cm(p.dims.W)} × ${cm(p.dims.H)}⁩` })}</span>
                  </span>
                  <span className={o.tick} aria-hidden="true">
                    <Check size={12} strokeWidth={3} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
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
              label={cylinder && axis === "L" ? t("library.panel.diameter") : model.family === "PAPER_BAG" || model.family === "PLASTIC_BAG" ? t(BAG_AXIS_KEY[axis]) : t(AXIS_KEY[axis])}
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
              error={sizeError(draft[axis], lims[axis].min, lims[axis].max)}
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
        label={(c) => plainMaterial(t, c.value)}
        layout="rows"
        visual={(c) => <BoardSwatch code={c.value} />}
        line={(c) => boardLine(t, c.value)}
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
      <Text as="p" variant="bodySm" tone="subdued">
        {t("designer.box.printSidesHelp")}
      </Text>

      <FinishesGroup doc={doc} model={model} onFinish={onFinish} onFinishSwap={onFinishSwap} />

      {model.family === "PAPER_BAG" || model.family === "PLASTIC_BAG" ? (
        <BagHandleGroup modelCode={model.code} features={doc.features} onChange={(bagHandle) => setFeature({ bagHandle })} onFilm={(bagFilm) => setFeature({ bagFilm })} />
      ) : null}

      {support.windowFaces.length || support.handle || support.tearStrip || support.thumbNotch || support.partitions || support.lidHeight || support.displayFront ? (
        <fieldset className={styles.group}>
          <legend className={styles.groupTitle}>{t("library.panel.addOns")}</legend>
          {/* options-visual: a tile with a line drawing per option; their settings follow below. */}
          <ul className={o.tiles} data-testid="addon-tiles">
            {support.windowFaces.length ? (
              <AddOnTile kind="window" label={t("library.panel.window")} checked={!!f.window} onChange={(on) => setFeature({ window: on ? { face: support.windowFaces[0], film: true } : null })} />
            ) : null}
            {support.handle && model.code !== "GABLE_BOX" ? <AddOnTile kind="handle" label={t("library.panel.handle")} checked={!!f.handle} onChange={(on) => setFeature({ handle: on })} /> : null}
            {support.tearStrip ? <AddOnTile kind="tearStrip" label={t("library.panel.tearStrip")} checked={!!f.tearStrip} onChange={(on) => setFeature({ tearStrip: on })} /> : null}
            {support.thumbNotch ? <AddOnTile kind="thumbNotch" label={t("library.panel.thumbNotch")} checked={!!f.thumbNotch} onChange={(on) => setFeature({ thumbNotch: on })} /> : null}
            {support.displayFront ? <AddOnTile kind="displayFront" label={t("library.panel.displayFront")} checked={!!f.displayFront} onChange={(on) => setFeature({ displayFront: on })} /> : null}
            {support.partitions ? <AddOnTile kind="dividers" label={t("library.panel.dividers")} checked={!!f.partitions} onChange={(on) => setFeature({ partitions: on ? { rows: 2, cols: 2 } : null })} /> : null}
          </ul>
          {support.windowFaces.length ? (
            <>
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
          {support.partitions ? (
            <>
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

      {viewControls ? <ViewGroup view={view} onView={onView} vessel={false} /> : null}
    </>
  );
}

function roundDims(d: Dims): Dims {
  return { L: Math.round(d.L), W: Math.round(d.W), H: Math.round(d.H) };
}

const cm = (mm: number) => formatNumber(Math.round(mm) / 10, 1);

/** The board's one-line note on its card, when there is one. */
function boardLine(t: (k: DictKey) => string, code: string): string | null {
  const key = `library.panel.boardLine.${code}` as DictKey;
  const s = t(key);
  return s === key ? null : s;
}

/** An add-on tile: a line drawing, the name, a hidden checkbox (keeps the checkbox role and name). */
function AddOnTile({ kind, label, checked, onChange }: { kind: AddOnKind; label: string; checked: boolean; onChange: (on: boolean) => void }) {
  const id = `addon-${kind}`;
  return (
    <li>
      <label className={o.card} htmlFor={id} data-checked={checked}>
        <input id={id} className={o.srOnly} type="checkbox" checked={checked} onChange={(e) => onChange(e.currentTarget.checked)} />
        <AddOnIcon kind={kind} />
        <span className={o.cardName}>{label}</span>
        <span className={o.tick} aria-hidden="true">
          <Check size={12} strokeWidth={3} />
        </span>
      </label>
    </li>
  );
}

/* ───────────────────────────── containers ───────────────────────────── */

function VesselSection({ doc, model, geo, view, onView, viewControls, onGeometry, onFinish, onFinishSwap }: ConfigPanelProps & { model: VesselModelDef }) {
  const { t, locale } = useI18n();
  const v = doc.vessel!;
  const [draft, setDraft] = useState({ D: String(v.dims.D), H: String(v.dims.H), G: v.dims.G !== undefined ? String(v.dims.G) : "" });
  const [invalid, setInvalid] = useState(false);
  const sizeError = useSizeError();
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
      const d = describeVesselDraft(model, dims, v);
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
                error={a === "G" && draft[a] === "" ? undefined : sizeError(draft[a], r.min, r.max)}
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
        label={(c) => plainMaterial(t, c.value)}
        onChange={(val) => onGeometry({ materialCode: val as MaterialCode })}
      />

      <FinishesGroup doc={doc} model={model} onFinish={onFinish} onFinishSwap={onFinishSwap} />

      {viewControls ? <ViewGroup view={view} onView={onView} vessel /> : null}
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
