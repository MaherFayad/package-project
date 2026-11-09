"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Boxes, ChevronRight, ImageUp, Ruler, Shapes, SlidersHorizontal, Trash2, Type, Upload, type LucideIcon } from "lucide-react";
import type { ArtworkLayer, DesignDoc, FaceId, MaterialCode, TextLayer } from "@/types";
import { boardAppearance } from "@/lib/dieline";
import type { ModelDef } from "@/lib/library";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n/types";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { RangeSlider } from "@/components/ui/RangeSlider";
import { Text } from "@/components/ui/Text";
import { TextField } from "@/components/ui/TextField";
import { materialChoices } from "./lib/config";
import { scaleLayer, type Placement } from "./lib/geometry";
import { layerName } from "./lib/describe";
import { MAX_LAYERS } from "./lib/doc";
import { DPI_WARNING, effectiveDpi } from "./lib/preflight";
import { ColorField } from "./fields";
import { ImagePlaceControl, type ImagePlaceApi } from "./ImagePlaceControl";
import styles from "./designer.module.css";

/**
 * The beginner panel (simple mode, the default), one rail section at a time: logo (with a name or
 * text, and rows to the other sections), colour, size, more. Every other
 * option (exact millimetres, board grade, finishes, inside print, layers, print check, full
 * artwork, dieline template) lives under "All options" (the tabs), nothing is removed.
 */
export interface SimplePanelProps {
  doc: DesignDoc;
  model: ModelDef | null;
  selected: ArtworkLayer | null;
  uploading: boolean;
  uploadError: string | null;
  faceLabel: (f: FaceId) => string;
  /** Focus the text field of this layer once (right after "Add text"). */
  focusTextId: string | null;
  onFocusedText: () => void;
  onAddLogo: () => void;
  onAddText: () => void;
  onSelect: (id: string | null) => void;
  onLayer: (layer: ArtworkLayer, coalesce?: string) => void;
  onSeal: () => void;
  onPlace: (where: Placement) => void;
  onDelete: (id: string) => void;
  /** Size of a side in mm (the size slider is a share of its width). */
  faceSize: (f: FaceId) => { width: number; height: number } | null;
  /** Image fit: Fill side / Fit whole image for a picture (the only placing control in Basics). */
  imagePlace?: ImagePlaceApi;
  /** Copy a picture onto every other side; absent for containers (one label). */
  onAllSides?: (id: string) => void;
  onBackground: (c: string | null) => void;
  onGeometry: (patch: Partial<Pick<DesignDoc, "dims" | "materialCode" | "vessel">>) => void;
  onOpenPicker: () => void;
  /** Switch to all options, optionally on a tab (0 box, 1 artwork, 2 layers, 3 check). */
  onAdvanced: (tab?: number) => void;
  /** Which rail section the panel shows. */
  section: SimpleSection;
  onSection: (s: SimpleSection) => void;
  /** A logo file dropped on the upload zone. */
  onLogoFile?: (file: File) => void;
}

/** Basics rail sections (the Box type item opens the model picker, it has no panel). */
export type SimpleSection = "logo" | "colour" | "size" | "more";

/** Plain name of a board colour: what a shop owner sees, not the grade (E-flute kraft…). */
function boardColourKey(code: MaterialCode): DictKey | null {
  if (code.includes("KRAFT")) return "designer.simple.kraft";
  if (code.includes("WHITE") || code.startsWith("SBS")) return "designer.simple.white";
  return null;
}

const cm = (mm: number) => formatNumber(Math.round(mm) / 10, 1);

export function SimplePanel(p: SimplePanelProps) {
  const { t, locale } = useI18n();
  const { doc, model, selected } = p;
  const outside = doc.artwork.outside.layers;
  const full = outside.length + doc.artwork.inside.layers.length >= MAX_LAYERS;
  const hasImage = outside.some((l) => l.kind === "image");
  // R2-12: say a logo is too small to print sharp here, when it is added, not first at checkout.
  const lowRes = outside.some((l) => l.kind === "image" && !l.hidden && effectiveDpi(l) < DPI_WARNING);

  // Cardboard colours: one choice per look (brown / white), keeping the current grade when it can.
  const boards = useMemo(() => {
    if (!model || model.kind !== "box") return [];
    const out = new Map<string, { code: MaterialCode; key: DictKey; hex: string }>();
    for (const c of materialChoices(doc, model)) {
      const key = boardColourKey(c.value);
      if (!key || (!c.enabled && c.value !== doc.materialCode)) continue;
      const prev = out.get(key);
      if (!prev || c.value === doc.materialCode) out.set(key, { code: c.value, key, hex: boardAppearance(c.value).outside });
    }
    return [...out.values()];
  }, [doc, model]);
  const currentBoard = boardColourKey(doc.materialCode);

  // Everyday names ("T-shirt", "Shoe box", "Perfume 50 ml"), not millimetres.
  const presets = (model?.presets ?? []) as unknown as { id: string; name: { ar: string; en: string }; dims: Record<string, number | undefined> }[];
  const activePreset =
    model?.kind === "vessel"
      ? presets.find((pr) => pr.id === doc.vessel?.presetId)
      : presets.find((pr) => pr.dims.L === doc.dims.L && pr.dims.W === doc.dims.W && pr.dims.H === doc.dims.H);

  const textRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!p.focusTextId || selected?.id !== p.focusTextId) return;
    const el = textRef.current?.querySelector<HTMLTextAreaElement | HTMLInputElement>("textarea, input");
    if (el) {
      el.focus({ preventScroll: false });
      el.select();
    }
    p.onFocusedText();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.focusTextId, selected?.id]);

  const typeLabel = t(model?.kind === "vessel" ? "designer.simple.changeTypeVessel" : "designer.simple.changeType");
  const boxDims = `⁦${cm(doc.dims.L)} × ${cm(doc.dims.W)} × ${cm(doc.dims.H)}⁩`;
  const sizeValue = model?.kind === "box" ? t("designer.simple.sizeCm", { dims: boxDims }) : (activePreset?.name[locale] ?? "");
  const [dragOver, setDragOver] = useState(false);

  return (
    <div className={styles.simple} data-testid="simple-panel" data-section={p.section}>
      {p.section === "logo" ? (
        <>
          {/* 1. Logo: the upload zone is the hero of the panel (button, or drop a file on it). */}
          <section className={styles.simpleStep} aria-labelledby="simple-logo">
            <h2 id="simple-logo" className={styles.panelTitle}>
              {t("designer.simple.logoHeading")}
            </h2>
            <div
              className={styles.dropZone}
              data-over={dragOver || undefined}
              onDragOver={(e) => {
                if (!p.onLogoFile || !e.dataTransfer.types.includes("Files")) return;
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                setDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (!file || !p.onLogoFile) return;
                e.preventDefault();
                p.onLogoFile(file);
              }}
            >
              <span className={styles.dropZoneIcon} aria-hidden="true">
                <ImageUp size={30} strokeWidth={1.5} />
              </span>
              <Button variant="primary" size="large" icon={Upload} onClick={p.onAddLogo} disabled={full || p.uploading} loading={p.uploading}>
                {hasImage ? t("designer.simple.logoAnother") : t("designer.simple.logoAction")}
              </Button>
              <span className={styles.dropZoneHint}>{t("designer.simple.dropHint")}</span>
            </div>
            <p className={styles.panelNote}>{model?.kind === "vessel" ? t("designer.simple.logoHintVessel") : t("designer.simple.logoHint")}</p>
            {lowRes ? (
              <Banner tone="warning" inCard>
                <span data-testid="logo-low-res">{t("designer.simple.lowRes")}</span>
              </Banner>
            ) : null}
            {p.uploadError ? (
              <Banner tone="critical" inCard>
                {p.uploadError}
              </Banner>
            ) : null}
          </section>

          {/* 2. Name or text */}
          <section className={styles.simpleStep} aria-labelledby="simple-text">
            <h2 id="simple-text" className={styles.simpleHeadingSm}>
              {t("designer.simple.textHeading")}
            </h2>
            <Button fullWidth icon={Type} onClick={p.onAddText} disabled={full}>
              {t("designer.simple.textAction")}
            </Button>
            {full ? (
              <Banner tone="warning" inCard>
                {t("designer.artwork.tooManyLayers", { max: MAX_LAYERS })}
              </Banner>
            ) : null}
          </section>

          {/* What is on the box: tap one to change it (no layers jargon). */}
          {outside.length ? (
            <section className={styles.simpleStep} aria-labelledby="simple-items">
              <h2 id="simple-items" className={styles.simpleHeadingSm}>
                {t("designer.simple.itemsHeading")}
              </h2>
              <ul className={styles.simpleItems}>
                {outside.map((l) => (
                  <li key={l.id}>
                    <Button size="slim" pressed={selected?.id === l.id} onClick={() => p.onSelect(selected?.id === l.id ? null : l.id)}>
                      {`${layerName(l, t)} · ${p.faceLabel(l.face)}`}
                    </Button>
                  </li>
                ))}
              </ul>
              {selected && selected.surface === "outside" ? <QuickEdit {...p} layer={selected} textRef={textRef} /> : null}
            </section>
          ) : null}

          {/* The other choices as list rows, one tap to their own panel. */}
          {model ? (
            <div className={styles.rowList}>
              {currentBoard && boards.length > 1 ? <PanelRow label={t("designer.simple.boardColour")} value={t(currentBoard)} onClick={() => p.onSection("colour")} /> : null}
              {sizeValue ? <PanelRow label={t("designer.simple.sizeHeading")} value={sizeValue} onClick={() => p.onSection("size")} /> : null}
              <PanelRow label={typeLabel} value={model.name[locale]} onClick={p.onOpenPicker} />
            </div>
          ) : null}
        </>
      ) : null}

      {p.section === "colour" ? (
        <section className={styles.simpleStep} aria-labelledby="simple-colour">
          <h2 id="simple-colour" className={styles.panelTitle}>
            {t("designer.simple.colourHeading")}
          </h2>
          {boards.length > 1 ? (
            <fieldset className={styles.simpleFieldset}>
              <legend className={styles.fieldLegend}>{t("designer.simple.boardColour")}</legend>
              <div className={styles.simpleChoices}>
                {boards.map((b) => (
                  <button
                    key={b.key}
                    type="button"
                    className={styles.simpleChoice}
                    aria-pressed={currentBoard === boardColourKey(b.code)}
                    onClick={() => b.code !== doc.materialCode && p.onGeometry({ materialCode: b.code })}
                    title={t(`materials.${b.code}` as DictKey)}
                  >
                    <span className={styles.simpleChip} style={{ background: b.hex }} aria-hidden="true" />
                    {t(b.key)}
                  </button>
                ))}
              </div>
            </fieldset>
          ) : null}
          <ColorField
            label={t("designer.simple.printColour")}
            value={doc.artwork.outside.background}
            onChange={p.onBackground}
            allowNone
            noneLabel={model?.kind === "vessel" ? t("designer.simple.noColourLabel") : t("designer.artwork.noBackground")}
          />
        </section>
      ) : null}

      {p.section === "size" && model ? (
        <section className={styles.simpleStep} aria-labelledby="simple-size">
          <h2 id="simple-size" className={styles.panelTitle}>
            {t("designer.simple.sizeHeading")}
          </h2>
          {presets.length ? (
            <div className={styles.simpleChoices} role="group" aria-labelledby="simple-size">
              {presets.map((pr) => (
                <Button
                  key={pr.id}
                  pressed={activePreset?.id === pr.id}
                  onClick={() => {
                    if (model.kind === "vessel" && doc.vessel) p.onGeometry({ vessel: { ...doc.vessel, dims: { ...(pr.dims as unknown as NonNullable<DesignDoc["vessel"]>["dims"]) }, presetId: pr.id } });
                    else p.onGeometry({ dims: { ...(pr.dims as unknown as DesignDoc["dims"]) } });
                  }}
                >
                  {pr.name[locale]}
                </Button>
              ))}
            </div>
          ) : null}
          {model.kind === "box" ? (
            <Text as="p" variant="bodySm" tone="subdued">
              <bdi>{t("designer.simple.sizeNow", { dims: boxDims })}</bdi>
            </Text>
          ) : null}
          <div className={styles.rowList}>
            <PanelRow icon={Ruler} label={t("designer.simple.sizeExact")} onClick={() => p.onAdvanced(0)} />
            <PanelRow icon={Shapes} label={typeLabel} value={model.name[locale]} onClick={p.onOpenPicker} />
          </div>
        </section>
      ) : null}

      {/* Everything else, one tap away. */}
      {p.section === "more" ? (
        <section className={styles.simpleStep} aria-labelledby="simple-more">
          <h2 id="simple-more" className={styles.panelTitle}>
            {t("designer.simple.moreHeading")}
          </h2>
          <Text as="p" variant="bodySm" tone="subdued">
            {t("designer.simple.moreBody")}
          </Text>
          <Button fullWidth icon={SlidersHorizontal} onClick={() => p.onAdvanced()}>
            {t("designer.simple.moreAction")}
          </Button>
        </section>
      ) : null}
    </div>
  );
}

/** A light-grey list row with a chevron (label, then the current value under it). */
function PanelRow({ label, value, icon: RowIcon, onClick }: { label: string; value?: string; icon?: LucideIcon; onClick: () => void }) {
  return (
    <button type="button" className={styles.panelRow} onClick={onClick}>
      {RowIcon ? <RowIcon size={18} aria-hidden className={styles.panelRowIcon} /> : null}
      <span className={styles.panelRowText}>
        <span className={value ? styles.panelRowLabel : undefined}>{label}</span>
        {value ? <bdi className={styles.panelRowValue}>{value}</bdi> : null}
      </span>
      <ChevronRight size={18} aria-hidden className={styles.panelRowChevron} />
    </button>
  );
}

function QuickEdit({ layer, onLayer, onSeal, onPlace, onDelete, faceSize, onAllSides, imagePlace, textRef }: SimplePanelProps & { layer: ArtworkLayer; textRef: React.RefObject<HTMLDivElement | null> }) {
  const { t } = useI18n();
  // Size as a share of the side's width: one slider instead of "bigger" / "smaller" steps.
  const side = faceSize(layer.face);
  const pct = side ? Math.round((layer.width / side.width) * 100) : null;
  // A picture gets one control: Fill side / Fit whole image (with its own size for Fit).
  const placed = layer.kind === "image" && imagePlace ? layer : null;
  return (
    <div className={styles.simpleEdit} onBlur={onSeal} role="group" aria-label={`${t("designer.artwork.selected")}: ${layerName(layer, t)}`}>
      {layer.kind === "text" ? (
        <div ref={textRef} className={styles.simpleEditRow}>
          <TextField
            label={t("designer.layer.textValue")}
            autoComplete="off"
            maxLength={500}
            value={layer.text}
            dir="auto"
            onChange={(v) => onLayer({ ...layer, text: v } as TextLayer, `text:${layer.id}`)}
          />
          <ColorField label={t("designer.layer.color")} value={layer.color} onChange={(c) => c && onLayer({ ...layer, color: c } as TextLayer)} />
        </div>
      ) : null}
      {placed && imagePlace ? <ImagePlaceControl layer={placed} api={imagePlace} /> : null}
      {!placed && side && pct !== null ? (
        <RangeSlider
          label={t("designer.simple.size")}
          min={10}
          max={100}
          step={5}
          value={Math.min(100, Math.max(10, pct))}
          output
          formatValue={(v) => t("designer.simple.sizeValue", { pct: v })}
          onChange={(v) => onLayer(scaleLayer(layer, ((v / 100) * side.width) / layer.width), `scale:${layer.id}`)}
        />
      ) : null}
      {onAllSides && layer.kind === "image" ? (
        <Button icon={Boxes} onClick={() => onAllSides(layer.id)}>
          {t("designer.simple.allSides")}
        </Button>
      ) : null}
      {!placed ? (
        <div className={styles.simpleChoices} role="group" aria-label={t("designer.layer.placement")}>
          {(["top", "center", "bottom"] as const).map((w) => (
            <Button key={w} size="slim" onClick={() => onPlace(w)}>
              {t(`designer.layer.place.${w}` as DictKey)}
            </Button>
          ))}
        </div>
      ) : null}
      <div>
        <Button variant="tertiary" tone="critical" icon={Trash2} onClick={() => onDelete(layer.id)}>
          {t("designer.layer.delete")}
        </Button>
      </div>
    </div>
  );
}
