"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Trash2, Upload } from "lucide-react";
import type { Dims, Locale, MaterialCode, PrintSurface, SheetImage, StructureFeatures } from "@/types";
import { sheetImagePlacement, type DielineModel } from "@/lib/dieline";
import { loadBoxModels, modelByCode } from "@/lib/library/registry";
import type { BoxModelDef } from "@/lib/library/types";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/i18n/client";
import { Banner } from "@/components/ui/Banner";
import { BlockStack } from "@/components/ui/Stack";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { checkArtworkFit, scanModels, solveModelDims, type FitCheck, type FitSuggestion } from "./lib/artworkFit";
import { IMAGE_ACCEPT } from "./uploadImage";
import lib from "./library.module.css";
import s from "./sheetArtwork.module.css";

/** The open box model and size, for the fit search. */
export interface SheetFitContext {
  def: BoxModelDef;
  dims: Dims;
  material: MaterialCode;
  features?: StructureFeatures;
}

export interface SheetArtworkProps {
  locale: Locale;
  model: DielineModel;
  /** ["outside"], or ["outside", "inside"] when both sides are printed. */
  surfaces: PrintSurface[];
  images: Record<PrintSurface, SheetImage | null | undefined>;
  fit: SheetFitContext | null;
  uploading: boolean;
  onUpload: (file: File, surface: PrintSurface) => void;
  onRemove: (surface: PrintSurface) => void;
  onTemplate: (surface: PrintSurface) => void;
  onApplyDims: (dims: Dims) => void;
  onApplyModel: (code: string, dims: Dims) => void;
  /**
   * Hook for the cut-line detector (src/components/designer/lib/dielineDetect, built separately):
   * a "we recognised this box" result per surface, shown above the fit check.
   */
  recognised?: Partial<Record<PrintSurface, ReactNode>>;
}

/** "25 × 18 × 8 cm" / "25 × 18 × 8 سم" (Western digits, never mirrored). */
export const formatSheetCm = (d: Dims, locale: Locale) => {
  const c = (mm: number) => formatNumber(mm / 10, 1);
  return `⁦${c(d.L)} × ${c(d.W)} × ${c(d.H)}⁩ ${locale === "ar" ? "سم" : "cm"}`;
};

/** Full artwork: one slot per printed surface, each with its own upload and fit check. */
export function SheetArtwork(p: SheetArtworkProps) {
  const { t } = useI18n();
  const both = p.surfaces.length > 1;
  return (
    <fieldset className={lib.group} data-testid="sheet-artwork">
      <legend className={lib.groupTitle}>{t("designer.artwork.sheetTitle")}</legend>
      <BlockStack gap="200">
        <Text as="p" variant="bodySm" tone="subdued">
          {t("designer.artwork.sheetHelp")}
        </Text>
        <div className={s.slots} data-count={p.surfaces.length}>
          {p.surfaces.map((surface) => (
            <SheetSlot key={surface} {...p} surface={surface} titled={both} />
          ))}
        </div>
      </BlockStack>
    </fieldset>
  );
}

function SheetSlot(p: SheetArtworkProps & { surface: PrintSurface; titled: boolean }) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const img = p.images[p.surface] ?? null;
  const inside = p.surface === "inside";
  const [kept, setKept] = useState<string | null>(null);
  const fit = useArtworkFit(p.model, img, p.fit);
  const keyOf = img ? `${img.src.length}:${img.pxWidth}x${img.pxHeight}:${p.model.sheet.width}x${p.model.sheet.height}` : null;
  const dismissed = kept !== null && kept === keyOf;

  return (
    <section className={s.slot} data-testid={`sheet-slot-${p.surface}`} aria-label={p.titled ? t(inside ? "designer.artworkFit.insideSlot" : "designer.artworkFit.outsideSlot") : undefined}>
      {p.titled ? (
        <>
          <h3 className={s.slotTitle}>{t(inside ? "designer.artworkFit.insideSlot" : "designer.artworkFit.outsideSlot")}</h3>
          {inside ? (
            <Text as="p" variant="bodySm" tone="subdued">
              {t("designer.artworkFit.insideHelp")}
            </Text>
          ) : null}
        </>
      ) : null}
      {img ? (
        <div className={s.thumbRow}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img.src} alt="" className={s.thumb} />
          <Text as="span" variant="bodySm">
            <span dir="ltr">
              {img.pxWidth} × {img.pxHeight} px
            </span>
          </Text>
          <Button variant="tertiary" tone="critical" icon={Trash2} onClick={() => p.onRemove(p.surface)}>
            {t("designer.artwork.sheetRemove")}
          </Button>
        </div>
      ) : null}
      {img ? (p.recognised?.[p.surface] ?? null) : null}
      {img && fit.check && !dismissed ? (
        <FitReport {...p} img={img} check={fit.check} search={fit.search} onKeep={() => setKept(keyOf)} />
      ) : null}
      {img && fit.check && dismissed && fit.check.dpiLevel !== "ok" ? <LowRes check={fit.check} locale={p.locale} /> : null}
      <div className={s.thumbRow}>
        <input
          ref={input}
          type="file"
          accept={IMAGE_ACCEPT}
          hidden
          tabIndex={-1}
          aria-hidden="true"
          data-testid={`sheet-input-${p.surface}`}
          onChange={(e) => {
            const f = e.currentTarget.files?.[0];
            e.currentTarget.value = "";
            if (f) p.onUpload(f, p.surface);
          }}
        />
        <Button icon={Upload} onClick={() => input.current?.click()} disabled={p.uploading} loading={p.uploading}>
          {img
            ? t("designer.artwork.sheetReplace")
            : p.titled
              ? t(inside ? "designer.artworkFit.uploadInside" : "designer.artworkFit.uploadOutside")
              : t("designer.artwork.sheetAction")}
        </Button>
        <Button variant="tertiary" onClick={() => p.onTemplate(p.surface)}>
          {p.titled ? t(inside ? "designer.artworkFit.templateInside" : "designer.artworkFit.templateOutside") : t("designer.artwork.sheetTemplate")}
        </Button>
      </div>
    </section>
  );
}

function LowRes({ check, locale }: { check: FitCheck; locale: Locale }) {
  const { t } = useI18n();
  const size = `⁦${formatNumber(check.goodSizeMm.width / 10, 1)} × ${formatNumber(check.goodSizeMm.height / 10, 1)}⁩ ${locale === "ar" ? "سم" : "cm"}`;
  return (
    <Banner tone={check.dpiLevel === "error" ? "critical" : "warning"} inCard>
      <span data-testid="sheet-fit-lowres">{t("designer.artworkFit.lowRes", { dpi: formatNumber(check.dpi), size })}</span>
    </Banner>
  );
}

function FitReport(
  p: SheetArtworkProps & { surface: PrintSurface; img: SheetImage; check: FitCheck; search: FitSearch | null; onKeep: () => void },
) {
  const { t } = useI18n();
  const { check, search } = p;
  if (check.verdict === "fits")
    return (
      <BlockStack gap="150">
        <Banner tone="success" inCard>
          <span data-testid="sheet-fit" data-verdict="fits">
            {t("designer.artworkFit.fits")}
            {check.dpiLevel === "ok" ? ` ${t("designer.artworkFit.dpiOk", { dpi: formatNumber(check.dpi) })}` : ""}
          </span>
        </Banner>
        {check.dpiLevel !== "ok" ? <LowRes check={check} locale={p.locale} /> : null}
      </BlockStack>
    );

  const pct = formatNumber(Math.max(1, Math.round(check.cropShare * 100)));
  const edge = check.cropEdge === "sides" ? "Sides" : "TopBottom";
  const msg = t(check.verdict === "near" ? (`designer.artworkFit.near${edge}` as const) : (`designer.artworkFit.off${edge}` as const), { pct });
  const same = search?.same ?? null;
  const others = search?.others ?? [];
  const nothing = search?.status === "done" && !same && !others.length;
  const nameOf = (code: string) => {
    const m = modelByCode(code);
    return m ? m.name[p.locale] : code;
  };

  return (
    <BlockStack gap="150">
      <Banner tone="warning" inCard>
        <BlockStack gap="200">
          <span data-testid="sheet-fit" data-verdict={check.verdict} data-search={search?.status ?? "idle"} data-ms={search?.ms != null ? Math.round(search.ms) : undefined}>
            {msg}
          </span>
          <div className={s.previews}>
            <figure className={s.preview}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.img.src} alt="" />
              <figcaption>{t("designer.artworkFit.previewYours")}</figcaption>
            </figure>
            <figure className={s.preview}>
              <CropPreview model={p.model} img={p.img} inside={p.surface === "inside"} />
              <figcaption>{t("designer.artworkFit.previewOnBox")}</figcaption>
            </figure>
          </div>
          {search?.status !== "done" ? (
            <Text as="p" variant="bodySm" tone="subdued">
              <span role="status" data-testid="sheet-fit-checking">
                {t("designer.artworkFit.checking")}
              </span>
            </Text>
          ) : null}
          {nothing ? (
            <Text as="p" variant="bodySm">
              <span data-testid="sheet-fit-none">{t("designer.artworkFit.noMatch")}</span>
            </Text>
          ) : null}
          {same || others.length ? (
            <Text as="p" variant="bodySm">
              {t("designer.artworkFit.fitsBest")}
            </Text>
          ) : null}
          <div className={s.actions} role="group" aria-label={t("designer.artworkFit.choices")}>
            {same ? (
              <Button variant="primary" onClick={() => p.onApplyDims(same.dims)}>
                {t("designer.artworkFit.changeSize", { size: formatSheetCm(same.dims, p.locale) })}
              </Button>
            ) : null}
            {others.slice(0, same ? 1 : 2).map((o: FitSuggestion) => (
              <Button key={o.code} onClick={() => p.onApplyModel(o.code, o.dims)}>
                {t("designer.artworkFit.changeBox", { name: nameOf(o.code), size: formatSheetCm(o.dims, p.locale) })}
              </Button>
            ))}
            {nothing ? (
              <Button onClick={() => p.onTemplate(p.surface)}>
                {t(p.surface === "inside" ? "designer.artworkFit.templateInside" : "designer.artworkFit.templateOutside")}
              </Button>
            ) : null}
            <Button variant="tertiary" onClick={p.onKeep}>
              {t("designer.artworkFit.keep")}
            </Button>
          </div>
        </BlockStack>
      </Banner>
      {check.dpiLevel !== "ok" ? <LowRes check={check} locale={p.locale} /> : null}
    </BlockStack>
  );
}

/** The image as it lands on the sheet: template outline over it, the parts cut off shaded. */
function CropPreview({ model, img, inside }: { model: DielineModel; img: SheetImage; inside: boolean }) {
  const { width: sw, height: sh } = model.sheet;
  const pl = sheetImagePlacement(model, img);
  // Frame the sheet with a band of the cut-off part around it (at most a quarter of the sheet).
  const band = Math.max(sw, sh) * 0.25;
  const x0 = Math.max(pl.x, -band);
  const y0 = Math.max(pl.y, -band);
  const w = Math.min(pl.x + pl.width, sw + band) - x0;
  const h = Math.min(pl.y + pl.height, sh + band) - y0;
  const cut = useMemo(() => model.cutLines.map((l) => `M${l.a.x.toFixed(1)} ${l.a.y.toFixed(1)}L${l.b.x.toFixed(1)} ${l.b.y.toFixed(1)}`).join(""), [model]);
  const sw1 = Math.max(sw, sh) / 120;
  return (
    <svg viewBox={`${x0} ${y0} ${w} ${h}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true" direction="ltr" data-testid="sheet-fit-preview">
      <image href={img.src} x={pl.x} y={pl.y} width={pl.width} height={pl.height} preserveAspectRatio="none" />
      <path
        d={`M${pl.x} ${pl.y}h${pl.width}v${pl.height}h${-pl.width}Z M0 0h${sw}v${sh}h${-sw}Z`}
        fillRule="evenodd"
        fill="rgba(20,20,20,0.6)"
      />
      <g transform={inside ? `matrix(-1 0 0 1 ${sw} 0)` : undefined}>
        <path d={cut} fill="none" stroke="#e51c00" strokeWidth={sw1} />
      </g>
      <rect x={0} y={0} width={sw} height={sh} fill="none" stroke="#ffffff" strokeWidth={sw1} strokeDasharray={`${sw1 * 3} ${sw1 * 2}`} />
    </svg>
  );
}

interface FitSearch {
  status: "checking" | "done";
  same: FitSuggestion | null;
  others: FitSuggestion[];
  ms?: number;
  scanned?: number;
  complete?: boolean;
}

/**
 * Check the image against the open box, then (when it does not fit) search for the size of this
 * model and other models it fits. The library scan runs in short slices so the page never freezes.
 */
function useArtworkFit(model: DielineModel, img: SheetImage | null, ctx: SheetFitContext | null) {
  const pw = img?.pxWidth ?? 0;
  const ph = img?.pxHeight ?? 0;
  const { width: sw, height: sh } = model.sheet;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const check = useMemo(() => (img ? checkArtworkFit({ sheet: { width: sw, height: sh } }, { pxWidth: pw, pxHeight: ph }) : null), [!!img, pw, ph, sw, sh]);
  const [search, setSearch] = useState<(FitSearch & { key: string }) | null>(null);
  const key = check && ctx ? `${ctx.def.code}:${ctx.dims.L}x${ctx.dims.W}x${ctx.dims.H}:${ctx.material}:${pw}x${ph}` : "";
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const needs = !!check && check.verdict !== "fits";

  useEffect(() => {
    const c = ctxRef.current;
    if (!needs || !c || !check) return;
    const signal = { aborted: false };
    const t0 = performance.now();
    setSearch({ key, status: "checking", same: null, others: [] });
    const timer = setTimeout(async () => {
      const same = solveModelDims(c.def, c.dims, check.imageAspect, { material: c.material, features: c.features })[0] ?? null;
      let all: BoxModelDef[] = [];
      try {
        all = await loadBoxModels();
      } catch {
        all = [];
      }
      if (signal.aborted) return;
      // Fittings (FEFCO 09: pads, dividers) go inside another box: not a home for a full design.
      const pool = all.filter((m) => m.source !== "fefco-09");
      const budgetMs = Math.max(800, 2000 - (performance.now() - t0));
      const res = await scanModels(pool, check.imageAspect, { material: c.material, family: c.def.family, group: c.def.group, skip: c.def.code, ref: c.dims, signal, budgetMs });
      if (signal.aborted) return;
      setSearch({ key, status: "done", same, others: res.matches, ms: performance.now() - t0, scanned: res.scanned, complete: res.complete });
    }, 30);
    return () => {
      signal.aborted = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, needs]);

  return { check, search: needs && search?.key === key ? search : null };
}
