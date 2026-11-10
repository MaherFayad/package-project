"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Box, Brush, ChevronDown, ChevronUp, CloudCheck, CloudOff, CloudUpload, Download, Ellipsis, Focus, ImagePlus, Layers, ListChecks, Minus, MoreHorizontal, Package, Palette, PanelsTopLeft, PartyPopper, Pencil, Plus, Redo2, Rotate3d, RotateCcw, RotateCw, Ruler, Save, Share2, Square, Undo2, UserRound, type LucideIcon } from "lucide-react";
import { Suspense, startTransition, useCallback, useEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from "react";
import { FACE_IDS, type ArtworkLayer, type DesignDoc, type DesignFinishCode, type Dims, type DimsPreset, type FaceId, type ImageLayer, type ImagePlace, type Locale, type PrintSurface, type StructureCode } from "@/types";
import { boardAppearance, dielineToSvg, type DielineModel } from "@/lib/dieline";
import type { ModelDef } from "@/lib/library";
import { loadModel, modelByCode } from "@/lib/library/registry";
import { useLibraryModel } from "@/lib/library/useLibraryModel";
import { defaultMaxDpr } from "@/components/three/dpr";
import { docGeometry, docModel, docModelCode, facesForAreas, normaliseDocModel } from "@/lib/library/doc";
import { FINISHES } from "@/lib/configurator";
import { loadEngineStack, type PackagingSceneHandle } from "@/components/three";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n/types";
import { ActionList } from "@/components/ui/ActionList";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Button, ButtonGroup } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Popover } from "@/components/ui/Popover";
import { Select } from "@/components/ui/Select";
import { ElbaWordmark } from "@/components/ui/Frame";
import { Text } from "@/components/ui/Text";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import type { OtpSuccess } from "@/components/auth";
import {
  addLayer,
  allLayers,
  copyToSides,
  duplicateLayer,
  faceSizesOf,
  findLayer,
  layerCount,
  makeImageLayer,
  makeShapeLayer,
  makeTextLayer,
  removeLayer,
  reorderLayer,
  rescaleArtwork,
  setBackground,
  updateLayer,
} from "./lib/doc";
import { contrastingInk } from "./lib/color";
import { canRedo, canUndo, historyReducer, initHistory, type History, type HistoryAction } from "./lib/history";
import { DPI_WARNING, effectiveDpi, runPreflight, summarizePreflight } from "./lib/preflight";
import { faceAtHit, placeLayer, type Placement } from "./lib/geometry";
import { autoPlace, fitScaleOf, LOGO_FIT_SCALE, placeImage, settlePlace } from "./lib/imageFit";
import { BADGE_QTY, fetchQuote, quoteKey, type PriceState } from "./lib/quote";
import { designerPath } from "./lib/catalog";
import { extendFinishMasks, fillEmptyFinishMasks, pruneFinishes, setLayerFinish, swapFinish, toggleFinish } from "./lib/config";
import { createModelDoc } from "./lib/doc";
import { layerName } from "./lib/describe";
import { ConfigPanel, surfaceName, type ViewOptions } from "./ConfigPanel";
import lib from "./library.module.css";
import { loadLocalDraft, saveLocalDraft } from "./lib/storage";
import { useArtworkCanvases } from "./useArtworkCanvases";
import { IMAGE_ACCEPT, imageLook, prepareImage, UploadError, type UploadErrorKind } from "./uploadImage";
import { stampExportMark } from "@/components/marketing/exportMark";
import { formatNumber } from "@/lib/format";
import { fitTextBox, measureText } from "./fonts";
import { FaceEditor } from "./FaceEditor";
import { DielineView } from "./DielineView";
import { ArtworkPanel } from "./ArtworkPanel";
import { formatSheetCm, SheetArtwork } from "./SheetArtwork";
import { RecognisedCard } from "./RecognisedCard";
import { useSheetRemap } from "./useSheetRemap";
import type { Recognised } from "./lib/dielineRemap/recognise";
import { SimplePanel, type SimpleSection } from "./SimplePanel";
import { TopBarLanguage, TopBarSignIn } from "./TopBarLanguage";
import { LayersPanel } from "./LayersPanel";
import { PreflightBadge, PreflightPanel } from "./PreflightPanel";
import { orderModeOf } from "@/data/catalogue/order-mode";
import { ExportModal, GateModal, PriceBadge, PriceModal, ShareModal, type ExportSize, type GateReason } from "./Modals";
import { BrandColorsModal, BrandColorsProvider, usedBrandColors, type BrandColorsApi } from "./BrandColors";
import type { BrandColor, SheetImage } from "@/types";
import styles from "./designer.module.css";
import { trackClient } from "@/lib/analytics/client";

const StageSkeleton = () => <div className={lib.stageSkeleton} aria-hidden="true" />;
// One persistent 3D canvas for boxes and containers (PERF-09).
// R6-R1: three.js, the React renderer and the stage load in steps with yields between them
const Stage3D = dynamic(() => loadEngineStack().then(() => import("./Stage3D")), { ssr: false, loading: StageSkeleton });
// The picker (370 cards, search) loads only when it is opened (PERF-04).
const ModelPicker = dynamic(() => import("@/components/catalogue/CataloguePicker").then((m) => m.ModelPicker), { ssr: false });

type View = "3d" | "face" | "dieline";
type SaveState = "idle" | "dirty" | "saving" | "saved" | "error" | "tooLarge";
const UPLOAD_ERROR_KEY: Record<UploadErrorKind, DictKey> = {
  type: "designer.artwork.uploadWrongType",
  size: "designer.artwork.uploadTooLarge",
  decode: "designer.artwork.uploadUnreadable",
};
type ModalName = "price" | "export" | "share" | null;
const TAB_IDS = ["box", "artwork", "layers", "check"] as const;
/**
 * Simple mode (the default) shows a shop owner's few steps: logo, a name, colour, size, price,
 * order. "All options" brings back every panel, view and field. Remembered per browser.
 */
type Mode = "simple" | "advanced";
const MODE_KEY = "elba.designer.mode";

/** The side a logo goes on first: the lid when it is big enough, else the front (as the "Your logo" hint). */
function logoFaceOf(m: DielineModel | null, vessel = false): FaceId | null {
  if (!m) return null;
  if (!vessel && m.faces.top && m.faces.top.height > 30) return "top";
  if (m.faces.front) return "front";
  return (Object.keys(m.faces)[0] as FaceId | undefined) ?? null;
}

export interface DesignerUser {
  id: string;
  name: string | null;
}

export interface DesignerAppProps {
  locale: Locale;
  initialDoc: DesignDoc;
  initialDesignId: string | null;
  /** Stored version of the loaded design (R10-R1: sent back as `baseUpdatedAt`). */
  initialUpdatedAt?: string | null;
  initialUser: DesignerUser | null;
  presetsByCode: Partial<Record<StructureCode, DimsPreset[]>>;
  loadError: "notFound" | null;
  /** Restore this device's autosaved draft on mount (?resume=1). */
  resumeLocal?: boolean;
  /** Library slug of the model (its /models/<slug>.svg poster), known on the server (R4-12). */
  posterSlug?: string;
  /** Same poster as a data: URL when small (src/app/model-poster.ts): paints with the HTML, no extra round trip (PERF R4-02). */
  posterSrc?: string;
}

const reducer = (s: History<DesignDoc>, a: HistoryAction<DesignDoc>) => historyReducer(s, a);

/** Any picture on the box yet (a logo layer or a full-artwork image)? */
function hasImage(doc: DesignDoc): boolean {
  const { outside, inside } = doc.artwork;
  return !!(outside.sheetImage || inside.sheetImage) || [...outside.layers, ...inside.layers].some((l) => l.kind === "image");
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("read"));
    r.readAsDataURL(blob);
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Inside view: fold target (part open, walls up, flaps out) and camera tilt down into the box (deg). */
const INSIDE_VIEW_FOLD = 0.6;
const INSIDE_VIEW_TILT = 30;

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40)
  );
}

/**
 * Only the open model's family pack is loaded in the browser (PERF-04): render a stage skeleton
 * until it is in the registry, then the editor.
 */
export function DesignerApp(props: DesignerAppProps) {
  const ready = useLibraryModel(docModelCode(props.initialDoc));
  if (!ready)
    return (
      <div className={lib.stageSkeleton} style={{ minBlockSize: "70vh", position: "relative" }} aria-busy="true" data-testid="designer-loading">
        <span className="visually-hidden">{props.locale === "ar" ? "جار تحميل المصمم" : "Loading the designer"}</span>
        {/* R4-12: the model's poster is in the server HTML, so the first large paint (LCP) is the
            box itself at first paint, not seconds later once the family pack and 3D chunk load. */}
        {props.posterSlug ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={props.posterSrc ?? `/models/${props.posterSlug}.svg`} alt="" aria-hidden="true" className={styles.stagePoster} fetchPriority="high" decoding="async" />
        ) : null}
      </div>
    );
  return <DesignerEditor {...props} />;
}

function DesignerEditor({ locale, initialDoc, initialDesignId, initialUpdatedAt, initialUser, loadError, resumeLocal, posterSrc }: DesignerAppProps) {
  const { t } = useI18n();
  const router = useRouter();
  // R1-21: remember the toasts this editor shows so opening the price sheet can clear them (an
  // "image added" toast used to sit on top of the sheet's price lines for seconds).
  const rawToast = useToast();
  const toastIds = useRef<number[]>([]);
  const toast = useMemo(
    () => ({
      ...rawToast,
      show: (...args: Parameters<typeof rawToast.show>) => {
        const id = rawToast.show(...args);
        toastIds.current = [...toastIds.current.slice(-4), id];
        return id;
      },
      dismissAll: () => {
        for (const id of toastIds.current) rawToast.dismiss(id);
        toastIds.current = [];
      },
    }),
    [rawToast],
  );

  // ── document + history ──────────────────────────────────────────
  const [hist, dispatch] = useReducer(reducer, initialDoc, initHistory);
  const doc = hist.present;
  const docRef = useRef(doc);
  docRef.current = doc;
  const commit = useCallback((next: DesignDoc, coalesce?: string) => dispatch({ type: "set", value: next, coalesce }), []);
  const seal = useCallback(() => dispatch({ type: "seal" }), []);

  // Box dieline, or the print-area sheet of a container (src/lib/library/doc).
  // While a size field is being typed (coalesced "dims" / "vessel" steps), the dieline, textures
  // and 3D mesh wait for 150 ms of quiet instead of rebuilding on every keystroke (PERF-08).
  const typingSize = hist.lastKey === "dims" || hist.lastKey === "vessel";
  const [settledDoc, setSettledDoc] = useState(doc);
  useEffect(() => {
    if (!typingSize) return;
    const id = setTimeout(() => setSettledDoc(docRef.current), 150);
    return () => clearTimeout(id);
  }, [typingSize, doc.dims, doc.vessel]);
  const geoSrc = typingSize ? settledDoc : doc;
  const geo = useMemo(
    () => docGeometry(geoSrc),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [geoSrc.modelCode, geoSrc.structureCode, geoSrc.dims, geoSrc.materialCode, geoSrc.features, geoSrc.vessel],
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const libModel = useMemo<ModelDef | null>(() => docModel(doc), [doc.modelCode, doc.structureCode]);
  const model: DielineModel | null = geo?.dieline ?? null;
  const isVessel = !!geo?.vessel;
  // B-16: models no Egyptian SME printer makes go to checkout's quote request, not an order. One
  // label for the toolbar, the export modal and the export toast (R4-03).
  const staticQuote = ["quote", "preview"].includes(orderModeOf(docModelCode(doc)).mode);
  const modelRef = useRef(model);
  modelRef.current = model;
  // Faces of the latest committed geometry (ahead of `model` while typing) for artwork rescaling.
  const geoFacesRef = useRef(model?.faces);
  useEffect(() => {
    if (!typingSize) geoFacesRef.current = model?.faces;
  }, [model, typingSize]);
  const faces = useMemo(() => model?.faces ?? {}, [model]);
  const bothSides = doc.printSides === "BOTH";

  // ── UI state ────────────────────────────────────────────────────
  const [user, setUser] = useState<DesignerUser | null>(initialUser);
  const [designId, setDesignId] = useState<string | null>(initialDesignId);
  const designIdRef = useRef(designId);
  designIdRef.current = designId;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [face, setFace] = useState<FaceId>(() => (FACE_IDS.find((f) => f === "front" && faces.front) ?? (Object.keys(faces)[0] as FaceId) ?? "front"));
  const [surface, setSurface] = useState<PrintSurface>("outside");
  const [view, setView] = useState<View>("3d");
  const [fold, setFold] = useState(1);
  const [tab, setTab] = useState(0);
  const [mode, setModeState] = useState<Mode>("simple");
  useEffect(() => {
    try {
      if (window.localStorage.getItem(MODE_KEY) === "advanced") setModeState("advanced");
    } catch {
      /* storage blocked: stay in simple mode */
    }
  }, []);
  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    // Simple mode has the 3D view only (the face editor and dieline are "All options").
    if (m === "simple") {
      setView("3d");
      setFold(1);
    }
    try {
      window.localStorage.setItem(MODE_KEY, m);
    } catch {
      /* not remembered: fine */
    }
  }, []);
  const simple = mode === "simple";
  const [focusTextId, setFocusTextId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  /** Basics: which rail section the panel shows. */
  const [section, setSection] = useState<SimpleSection>("logo");
  const asideRef = useRef<HTMLElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const swipeY = useRef<number | null>(null);
  const swipedRef = useRef(false);
  // Phones: toasts ("Saved", upload errors) sit above the Logo / Text / Order bar instead of on
  // top of it. The toast region (components/ui/Toast) reads --e-toast-offset; the bar is
  // display:none on wider screens, so its height (and the offset) is 0 there.
  const actionBarRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const bar = actionBarRef.current;
    if (!bar || typeof ResizeObserver === "undefined") return;
    const root = document.documentElement;
    // Only when the bar sits at the bottom of the screen (the phone tab bar), not as the side rail.
    const update = () => {
      const r = bar.getBoundingClientRect();
      const fromBottom = window.innerHeight - r.top;
      if (r.height > 0 && r.bottom >= window.innerHeight - 2 && fromBottom < window.innerHeight / 2) root.style.setProperty("--e-toast-offset", `${Math.round(fromBottom)}px`);
      else root.style.removeProperty("--e-toast-offset");
    };
    const ro = new ResizeObserver(update);
    ro.observe(bar);
    window.addEventListener("resize", update);
    update();
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
      root.style.removeProperty("--e-toast-offset");
    };
  }, []);
  const [saveState, setSaveState] = useState<SaveState>(initialDesignId ? "saved" : "idle");
  const [gate, setGate] = useState<{ reason: GateReason; then: () => void } | null>(null);
  const [modal, setModal] = useState<ModalName>(null);
  // R1-01: the live price is public (no account needed); the phone is asked for only to order,
  // save, share or export.
  const [price, setPrice] = useState<PriceState>({ status: "idle" });
  // R6-05: also when the live price says "by quote" (a special-gluing model no printer lists yet).
  const byQuote = staticQuote || price.status === "quote";
  const orderLabel = byQuote ? t("designer.price.quoteAction") : t(isVessel ? "designer.container.order" : "designer.order.button");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  /** Photo render progress (0..1) while it runs; its AbortController cancels it. */
  const [photoProgress, setPhotoProgress] = useState<number | null>(null);
  const photoAbort = useRef<AbortController | null>(null);
  const [ordering, setOrdering] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareError, setShareError] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  // R15-02: a dialog opened from the phone "More" menu returned focus to its menu item, which the
  // closing menu had removed, so focus fell to <body> (WCAG 2.4.3). The action moves focus to the
  // menu button first; the dialog remembers that and returns there.
  const moreRef = useRef<HTMLDivElement>(null);
  const fromMenu = (fn: () => void) => () => {
    moreRef.current?.querySelector<HTMLButtonElement>("button[aria-haspopup]")?.focus({ preventScroll: true });
    fn();
  };
  const [renameOpen, setRenameOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Mounted on first open and kept (so closing animates and returns focus).
  const [pickerUsed, setPickerUsed] = useState(false);
  useEffect(() => {
    if (pickerOpen) setPickerUsed(true);
  }, [pickerOpen]);
  // Default view: measurements on and a drinks can beside the box, so its real size reads at a glance.
  const [viewOpts, setViewOpts] = useState<ViewOptions>({ dimensions: true, scene: "reference", turntable: false, open: false });
  const viewOptsRef = useRef(viewOpts);
  viewOptsRef.current = viewOpts;
  const [notFound, setNotFound] = useState(loadError === "notFound");
  const sceneRef = useRef<PackagingSceneHandle | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const onSceneReady = useCallback(() => setSceneReady(true), []);
  // The canvas fills the workspace and the rail, panel and dock float over it: the camera frames
  // the box in the part they leave free (wide: beside the panel; phones: above the sheet).
  useEffect(() => {
    if (!sceneReady) return;
    let raf = 0;
    let last = "";
    const measure = () => {
      raf = 0;
      const h = sceneRef.current;
      const c = h?.getCanvas()?.getBoundingClientRect();
      if (!h?.setFitInsets || !c || c.width === 0) return;
      const side = window.matchMedia?.("(min-width: 768px)").matches ?? true;
      // Generous air around the box on wide screens (it sits in the middle of the free part).
      const gap = side ? 56 : 16;
      const ins = { top: side ? 48 : 0, right: side ? gap : 0, bottom: side ? gap : 0, left: side ? gap : 0 };
      const cover = (el: Element | null | undefined, asSide: boolean) => {
        if (!el) return;
        const b = el.getBoundingClientRect();
        const ox = Math.min(c.right, b.right) - Math.max(c.left, b.left);
        const oy = Math.min(c.bottom, b.bottom) - Math.max(c.top, b.top);
        if (b.width === 0 || b.height === 0 || ox <= 0 || oy <= 0) return;
        if (asSide) {
          if (b.left + b.right < c.left + c.right) ins.left = Math.max(ins.left, b.right - c.left + gap);
          else ins.right = Math.max(ins.right, c.right - b.left + gap);
        } else ins.bottom = Math.max(ins.bottom, c.bottom - b.top + gap);
      };
      for (const el of Array.from(asideRef.current?.children ?? [])) cover(el, side);
      cover(dockRef.current, false);
      const key = JSON.stringify(ins);
      if (key !== last) {
        last = key;
        h.setFitInsets(ins);
      }
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    for (const el of [asideRef.current, dockRef.current, sceneRef.current?.getCanvas()]) if (el) ro?.observe(el);
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [sceneReady, sheetOpen, simple, section, tab]);
  // Phones: the 3D view is short, so its buttons sit in the row under it instead of over the box.
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia?.("(min-width: 768px) and (min-height: 600px)");
    if (!mq) return;
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  const savedDocRef = useRef<DesignDoc | null>(initialDesignId ? initialDoc : null);

  const selected = findLayer(doc, selectedId);
  const faceInfo = faces[face] ?? null;
  const surfaceLayers = useMemo(() => doc.artwork[surface].layers.filter((l) => l.face === face), [doc.artwork, surface, face]);
  const look = boardAppearance(doc.materialCode);

  // A refresh (e.g. after signing in) re-renders the page with the same design: keep all state.
  // Only a link to a DIFFERENT saved design replaces the document.
  useEffect(() => {
    if (initialDesignId && initialDesignId !== designIdRef.current) {
      dispatch({ type: "reset", value: initialDoc });
      savedDocRef.current = initialDoc;
      baseRef.current = initialUpdatedAt ?? null;
      setDesignId(initialDesignId);
      designIdRef.current = initialDesignId;
      setSelectedId(null);
      setSaveState("saved");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDesignId]);

  // ?resume=1: bring back this device's autosave (same structure only).
  useEffect(() => {
    if (!resumeLocal) return;
    const draft = loadLocalDraft();
    if (draft && docModelCode(draft.doc) === docModelCode(initialDoc)) {
      dispatch({ type: "reset", value: draft.doc });
      if (draft.designId) {
        setDesignId(draft.designId);
        designIdRef.current = draft.designId;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep face / surface valid after structure or print-side changes.
  useEffect(() => {
    if (model && !model.faces[face]) setFace((Object.keys(model.faces)[0] as FaceId) ?? "front");
  }, [model, face]);
  useEffect(() => {
    if (!bothSides && surface === "inside") setSurface("outside");
  }, [bothSides, surface]);

  // ── textures ─────────────────────────────────────────────────────
  // Phones and 1x screens: a 1024 px artwork sheet (≈ 4x less texture memory and upload; PERF-22).
  const [sheetPx] = useState(() => (typeof window !== "undefined" && defaultMaxDpr() < 2 ? 1024 : 2048));
  // CR-15: a new, empty design previews a "Your logo" hint on the lid (3D and dieline only; the
  // document, the face editor, preflight and the print file never contain it).
  // R4-10: exports and saved thumbnails are taken without the hint (it is not part of the design).
  const [cleanShot, setCleanShot] = useState(false);
  const placeholder = useMemo(
    () => cleanShot ? null : ({ text: t("designer.artwork.placeholderLogo"), fontFamily: locale === "ar" ? ("IBM Plex Sans Arabic" as const) : ("Inter" as const), direction: locale === "ar" ? ("rtl" as const) : ("ltr" as const), color: "#616161" }),
    [t, locale, cleanShot],
  );
  const { canvases, version, images, imgVersion, fonts } = useArtworkCanvases(model, doc.artwork, doc.materialCode, bothSides, sheetPx, placeholder);
  const versionRef = useRef(version);
  versionRef.current = version;
  /**
   * Screenshot of the 3D view as the design really is: when the outside is still empty, repaint
   * the artwork sheet without the "Your logo" hint first, then put it back (R4-10).
   */
  const withCleanArtwork = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    // Exports and thumbnails show the box alone: no measurement lines, no scale can.
    const stage = viewOptsRef.current;
    if (stage.dimensions || stage.scene !== "none") {
      setViewOpts((o) => ({ ...o, dimensions: false, scene: "none" }));
      await new Promise((r) => setTimeout(r, 60));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      try {
        return await withCleanArtworkInner(fn);
      } finally {
        setViewOpts((o) => ({ ...o, dimensions: stage.dimensions, scene: stage.scene }));
      }
    }
    return withCleanArtworkInner(fn);
  }, []);
  const withCleanArtworkInner = async <T,>(fn: () => Promise<T>): Promise<T> => {
    const outside = docRef.current.artwork.outside;
    if (outside.layers.length > 0 || outside.background || outside.sheetImage) return fn();
    const before = versionRef.current;
    setCleanShot(true);
    try {
      for (let i = 0; i < 40 && versionRef.current === before; i++) await new Promise((r) => setTimeout(r, 25));
      // Let the texture upload and one frame render with the repainted sheet.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return await fn();
    } finally {
      setCleanShot(false);
    }
  };
  const shoot = useCallback(
    async (opts: Parameters<PackagingSceneHandle["screenshot"]>[0]) => {
      const scene = sceneRef.current;
      if (!scene) throw new Error("3D view not ready");
      return withCleanArtwork(() => scene.screenshot(opts));
    },
    [withCleanArtwork],
  );
  const canvasesRef = useRef(canvases);
  canvasesRef.current = canvases;

  // ── preflight ────────────────────────────────────────────────────
  const issues = useMemo(() => (model ? runPreflight(doc, model) : []), [doc, model]);
  const summary = useMemo(() => summarizePreflight(issues), [issues]);
  // Analytics (launch-metrics.md §1): `design_completed` the first time preflight turns green
  // after an edit, `artwork_uploaded` on the first image placed. Once per designer session.
  const sentRef = useRef<{ completed?: boolean; uploaded?: boolean }>({});
  const edited = hist.past.length > 0;
  useEffect(() => {
    if (!summary.ready || !edited || sentRef.current.completed) return;
    sentRef.current.completed = true;
    trackClient("design_completed", { structure_code: doc.structureCode, model_code: doc.modelCode ?? null, locale });
  }, [summary.ready, edited, doc.structureCode, doc.modelCode, locale]);

  // ── saving ───────────────────────────────────────────────────────
  const inflight = useRef<Promise<string | null> | null>(null);
  // Failed server saves retry on their own (10 s, 20 s, 40 s … up to 2 min) and when the
  // browser comes back online; the local draft is always written first (WCAG 3.3: recovery).
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelay = useRef(10_000);
  const saveRef = useRef<() => Promise<string | null>>(async () => null);
  const tooLargeToldRef = useRef(false);
  const baseRef = useRef<string | null>(initialUpdatedAt ?? null);
  // Brand colours of the signed-in buyer (integrator decision: no Pantone library).
  const [brandColors, setBrandColors] = useState<BrandColor[]>(initialDoc.brandColors ?? []);
  const brandRef = useRef<BrandColor[]>(brandColors);
  brandRef.current = brandColors;
  const [brandModal, setBrandModal] = useState<{ hex: string | null } | null>(null);
  // R10-03: two tabs on the same design. Each tab announces its saves on a BroadcastChannel; a tab
  // that hears another tab save the design it has open pauses its autosave and asks, instead of
  // silently overwriting the newer version (last writer won before).
  const [tabId] = useState(() => Math.random().toString(36).slice(2));
  const channelRef = useRef<BroadcastChannel | null>(null);
  const staleRef = useRef(false);
  const [stale, setStale] = useState(false);
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel("elba-designer");
    channelRef.current = ch;
    ch.onmessage = (e: MessageEvent<{ id?: string; tab?: string }>) => {
      if (e.data?.id && e.data.id === designIdRef.current && e.data.tab !== tabId) {
        staleRef.current = true;
        setStale(true);
      }
    };
    return () => {
      ch.close();
      channelRef.current = null;
    };
  }, [tabId]);
  const [online, setOnline] = useState(true);
  const touchedRef = useRef(false);

  const setUrl = useCallback(
    (id: string | null, code: StructureCode | string) => {
      const url = designerPath(locale, code, { d: id ?? undefined });
      if (typeof window !== "undefined" && window.location.pathname + window.location.search !== url) window.history.replaceState(null, "", url);
    },
    [locale],
  );

  const saveToServer = useCallback(
    async (opts: { thumbnail?: boolean; force?: boolean } = {}): Promise<string | null> => {
      // One save at a time, in order. The queue slot is taken synchronously: awaiting the
      // in-flight save first let two waiting callers (autosave plus a thumbnail save for share,
      // export or order) start together with the same base version, and the second was refused
      // with 409, which showed "changed in another tab" for this tab's own save.
      const prev = inflight.current;
      const run = (async () => {
        if (prev) await prev.catch(() => null);
        const current = docRef.current;
        setSaveState("saving");
        let thumbnail: string | undefined;
        if (opts.thumbnail && sceneRef.current) {
          try {
            const blob = await shoot({ width: 320, height: 320, mimeType: "image/jpeg", quality: 0.8, background: "#f1f1f1" });
            const url = await blobToDataUrl(blob);
            if (url.length < 400_000) thumbnail = url;
          } catch {
            /* the 3D view may not be ready; the thumbnail is optional */
          }
        }
        // R10-R1: a PUT says which stored version it edits; the server refuses (409) when another
        // device or tab saved since, unless the visitor chose "Keep this version" (force).
        const send = (id: string | null) =>
          fetch(id ? `/api/designs/${encodeURIComponent(id)}` : "/api/designs", {
            method: id ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              // The brand colours this design uses travel with it to the printer's proof.
              doc: { ...current, id: undefined, ...(brandRef.current.length ? { brandColors: usedBrandColors(current, brandRef.current) } : {}) },
              ...(thumbnail ? { thumbnail } : {}),
              ...(id && baseRef.current ? { baseUpdatedAt: baseRef.current } : {}),
              ...(id && opts.force ? { force: true } : {}),
            }),
          });
        try {
          let res = await send(designIdRef.current);
          // Expired or not ours any more (e.g. signed out): keep the work as a new design.
          if (designIdRef.current && (res.status === 404 || res.status === 403)) res = await send(null);
          // R10-01: 413 never succeeds on a retry; say why and stop retrying until the doc changes.
          if (res.status === 413) {
            setSaveState("tooLarge");
            // The toolbar status can be cut short on phones: say it once in a toast as well.
            if (!tooLargeToldRef.current) toast.show(t("designer.save.tooLarge"), { tone: "critical" });
            tooLargeToldRef.current = true;
            saveLocalDraft({ doc: current, designId: designIdRef.current, savedAt: Date.now() });
            return null;
          }
          if (res.status === 409) {
            // Changed elsewhere: pause autosave and ask (same banner as another tab, R10-03).
            staleRef.current = true;
            setStale(true);
            setSaveState("dirty");
            saveLocalDraft({ doc: current, designId: designIdRef.current, savedAt: Date.now() });
            return null;
          }
          if (!res.ok) throw new Error(String(res.status));
          const json = (await res.json()) as { id: string; owned: boolean; updatedAt?: string };
          baseRef.current = json.updatedAt ?? null;
          savedDocRef.current = current;
          setDesignId(json.id);
          designIdRef.current = json.id;
          setUrl(json.id, docModelCode(current));
          saveLocalDraft({ doc: current, designId: json.id, savedAt: Date.now() });
          setSaveState(docRef.current === current ? "saved" : "dirty");
          tooLargeToldRef.current = false;
          channelRef.current?.postMessage({ id: json.id, tab: tabId });
          retryDelay.current = 10_000;
          return json.id;
        } catch {
          setSaveState("error");
          saveLocalDraft({ doc: current, designId: designIdRef.current, savedAt: Date.now() });
          if (retryTimer.current) clearTimeout(retryTimer.current);
          retryTimer.current = setTimeout(() => {
            retryTimer.current = null;
            if (savedDocRef.current !== docRef.current && !staleRef.current) void saveRef.current();
          }, retryDelay.current);
          retryDelay.current = Math.min(retryDelay.current * 2, 120_000);
          return null;
        }
      })();
      inflight.current = run;
      try {
        return await run;
      } finally {
        if (inflight.current === run) inflight.current = null;
      }
    },
    [setUrl, shoot, toast, t, tabId],
  );

  saveRef.current = () => saveToServer();
  useEffect(() => {
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine !== false);
    const up = () => {
      setOnline(true);
      if (touchedRef.current && savedDocRef.current !== docRef.current) void saveRef.current();
    };
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, []);

  const retryNow = () => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = null;
    retryDelay.current = 10_000;
    void saveToServer();
  };

  // Autosave: this device right away, the server after a pause (anonymous designs too).
  const touched = hist.past.length > 0 || designId !== null;
  touchedRef.current = touched;
  useEffect(() => {
    if (!touched) return;
    if (savedDocRef.current !== doc) setSaveState((s) => (s === "saving" ? s : "dirty"));
    const local = setTimeout(() => saveLocalDraft({ doc, designId: designIdRef.current, savedAt: Date.now() }), 600);
    const server = setTimeout(() => {
      if (savedDocRef.current !== docRef.current && !staleRef.current) void saveToServer();
    }, 4000);
    return () => {
      clearTimeout(local);
      clearTimeout(server);
    };
  }, [doc, touched, saveToServer]);

  // ── account gate (G2) ─────────────────────────────────────────────
  const requireAccount = useCallback(
    (reason: GateReason, then: () => void) => {
      if (user) then();
      else {
        trackClient("gate_shown", { gate_reason: reason, structure_code: docRef.current.structureCode, locale });
        setGate({ reason, then });
      }
    },
    [user, locale],
  );

  useEffect(() => {
    if (!user) return;
    let alive = true;
    fetch("/api/designs/brand-colors", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ colors: BrandColor[] }>) : null))
      .then((j) => {
        if (alive && j) setBrandColors((prev) => (j.colors.length ? j.colors : prev));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [user]);
  const saveBrandColors = useCallback(async (next: BrandColor[]) => {
    try {
      const r = await fetch("/api/designs/brand-colors", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ colors: next }) });
      if (!r.ok) return false;
      const j = (await r.json()) as { colors: BrandColor[] };
      setBrandColors(j.colors);
      // The printer's colour references follow the account: re-save a touched design now (its
      // saved snapshot lists the brand colours it uses).
      brandRef.current = j.colors;
      if (touchedRef.current && !staleRef.current) void saveRef.current();
      return true;
    } catch {
      return false;
    }
  }, []);
  const brandApi = useMemo<BrandColorsApi>(
    () => ({
      colors: brandColors,
      saveCurrent: (hex) => requireAccount("save", () => setBrandModal({ hex })),
      manage: () => requireAccount("save", () => setBrandModal({ hex: null })),
    }),
    [brandColors, requireAccount],
  );

  const onSignedIn = (u: OtpSuccess) => {
    const pending = gate?.then;
    setUser({ id: u.id, name: u.name });
    setGate(null);
    router.refresh();
    // verify-otp claimed this browser's anonymous designs, which is a write: read the stored
    // version again so the next save is not refused as stale (R10-R1), then continue what the
    // user asked for.
    const id = designIdRef.current;
    const resume = () => pending && setTimeout(pending, 0);
    if (!id) return resume();
    fetch(`/api/designs/${encodeURIComponent(id)}`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ updatedAt?: string }>) : null))
      .then((j) => {
        if (j?.updatedAt) baseRef.current = j.updatedAt;
      })
      .catch(() => undefined)
      .finally(resume);
  };

  // ── live price badge ──────────────────────────────────────────────
  const qKey = quoteKey(doc, BADGE_QTY);
  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      setPrice({ status: "loading" });
      fetchQuote(docRef.current, BADGE_QTY, ctrl.signal)
        .then((s) => startTransition(() => setPrice(s)))
        .catch(() => undefined);
    }, 500);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [qKey]);

  // ── document operations ───────────────────────────────────────────
  /** Apply a geometry change (size, board, features, container), keeping artwork in place. */
  const applyGeometry = useCallback(
    (next: DesignDoc, coalesce?: string) => {
      const normal = normaliseDocModel(next);
      const nextGeo = docGeometry(normal);
      if (!nextGeo) return false;
      const m = docModel(normal);
      const pruned = m ? pruneFinishes(normal, m) : { doc: normal, removed: [] as DesignFinishCode[] };
      const { doc: rescaled, removed } = rescaleArtwork(pruned.doc, faceSizesOf(geoFacesRef.current), faceSizesOf(nextGeo.dieline.faces), nextGeo.dieline);
      geoFacesRef.current = nextGeo.dieline.faces;
      commit(rescaled, coalesce);
      if (removed) toast.show(t("designer.box.removedLayers", { count: removed }));
      if (pruned.removed.length) toast.show(t("library.panel.removedFinishes", { list: pruned.removed.map((c) => FINISHES[c].name[locale]).join(locale === "ar" ? "، " : ", ") }));
      return true;
    },
    [commit, t, toast, locale],
  );

  const changeGeometry = useCallback(
    (patch: Partial<Pick<DesignDoc, "dims" | "materialCode" | "features" | "vessel">>) => {
      applyGeometry({ ...docRef.current, ...patch }, patch.vessel ? "vessel" : patch.dims ? "dims" : undefined);
    },
    [applyGeometry],
  );

  /** Switch to another library model: its default size, the closest board, same artwork. */
  const onModel = async (code: string, dims?: Dims, artwork?: DesignDoc["artwork"]) => {
    setPickerOpen(false);
    // Another family's pack loads on demand (PERF-04).
    const m = modelByCode(code) ?? (await loadModel(code));
    if (!m) return false;
    const cur = docRef.current;
    const fresh = createModelDoc(m, { name: cur.name, materialCode: cur.materialCode, dims });
    const next: DesignDoc = { ...fresh, artwork: artwork ?? cur.artwork, printSides: m.kind === "box" ? cur.printSides : "OUTSIDE", finishes: cur.finishes, finishCode: cur.finishCode };
    if (!applyGeometry(next)) return false;
    setUrl(designIdRef.current, code);
    return true;
  };

  const openPicker = useCallback(() => setPickerOpen(true), []);
  const onFinish = useCallback((code: DesignFinishCode, on: boolean) => commit(toggleFinish(docRef.current, code, on)), [commit]);
  const onFinishSwap = useCallback((off: DesignFinishCode[], on: DesignFinishCode | null) => commit(swapFinish(docRef.current, off, on)), [commit]);
  const onPrintSides = useCallback((p: DesignDoc["printSides"]) => commit({ ...docRef.current, printSides: p }), [commit]);

  const onLayerChange = useCallback(
    (layer: ArtworkLayer, coalesce?: string) => {
      let next = fitTextBox(layer);
      // R10-04: typing longer text keeps it on its panel: when the words change and the line
      // outgrows the panel's safe width, the size steps down (to 6 pt at least), as it does when
      // text is first added. A size the visitor sets on purpose (same words) is kept.
      const before = findLayer(docRef.current, layer.id);
      const info = modelRef.current?.faces[layer.face];
      if (next.kind === "text" && before?.kind === "text" && before.text !== next.text && info) {
        const room = Math.max(10, info.width - 2 * (modelRef.current?.safeMm ?? 3));
        if (next.width > room && next.fontSizePt > 6) {
          const pt = Math.max(6, Math.floor(next.fontSizePt * (room / next.width) * 10) / 10);
          next = fitTextBox({ ...next, fontSizePt: pt });
        }
      }
      // Image fit: a new crop keeps Fill / Fit; a drag, rotation or typed size frees the image.
      if (next.kind === "image" && next.place && info && modelRef.current) next = settlePlace(before?.kind === "image" ? before : null, next, info, modelRef.current);
      commit(updateLayer(docRef.current, layer.id, () => next), coalesce);
    },
    [commit],
  );

  const add = (layer: ArtworkLayer, opts: { stay3d?: boolean } = {}) => {
    if (layerCount(docRef.current) >= 60) return;
    // A masked finish switched on before any artwork existed starts on the first item (FN-02);
    // one that covers every item takes the new one too (finishes apply to the whole design).
    const before = docRef.current;
    commit(fillEmptyFinishMasks(extendFinishMasks(before, addLayer(before, layer), layer.id)));
    setSelectedId(layer.id);
    // Simple mode keeps the 3D view: the logo shows on the box at once.
    if (!opts.stay3d && !simple) setView("face");
  };

  /**
   * Add an uploaded image. Default: the face and surface picked in the panel. From the 3D view
   * (click or drop on a side of the box): that face, centred where it was dropped, and the 3D
   * view stays open.
   */
  const onUpload = async (file: File, target?: { face: FaceId; surface: PrintSurface; at?: { x: number; y: number } }) => {
    const f = target?.face ?? face;
    const s = target?.surface ?? surface;
    const info = modelRef.current?.faces[f] ?? null;
    if (!info) return;
    if (target) {
      setFace(f);
      setSurface(s);
      setTab(1);
    }
    setUploading(true);
    setUploadError(null);
    try {
      const img = await prepareImage(file);
      // Image fit: an opaque photo shaped like the side fills it; a logo (or a picture that would
      // not fill sharply) shows whole inside the safe zone, centred on the drop point when there
      // is room, else on the side.
      const look = await imageLook(img.src);
      const m = modelRef.current ?? { safeMm: 3, bleedMm: 3 };
      const mode = autoPlace(img, look, info, m);
      const logo = look.transparent || look.plainEdges;
      const layer = placeImage(makeImageLayer(f, s, info, img), info, m, mode, { scale: logo ? LOGO_FIT_SCALE : 1, at: target?.at });
      add(layer, { stay3d: !!target });
      // R2-12: a logo too small to print sharp is said right away, not first at checkout.
      // Basics: a short "on the box" moment over the 3D view and a glow on that side, instead of
      // a long toast that covers the sheet on phones.
      if (target && simple) {
        clearTimeout(landedTimer.current);
        const low = effectiveDpi(layer) < DPI_WARNING;
        setLanded({ low });
        landedTimer.current = setTimeout(() => setLanded(null), low ? 5000 : 2600);
        setHoverSurface(s);
        setHoverFace(f);
        clearTimeout(tapGlow.current);
        setFlash(true);
        tapGlow.current = setTimeout(() => setHoverFace(null), 1400);
      } else if (target) toast.show(effectiveDpi(layer) < DPI_WARNING ? `${t("designer.artwork.addedTo", { face: faceLabel(f) })}. ${t("designer.simple.lowRes")}` : t("designer.artwork.addedTo", { face: faceLabel(f) }));
      if (!sentRef.current.uploaded) {
        sentRef.current.uploaded = true;
        trackClient("artwork_uploaded", { structure_code: docRef.current.structureCode, surface: s, locale });
      }
    } catch (e) {
      // R10-02: say which rule the file broke (WCAG 3.3.1 / 3.3.3).
      const msg = t(e instanceof UploadError ? UPLOAD_ERROR_KEY[e.kind] : "designer.artwork.uploadError");
      setUploadError(msg);
      if (target) toast.show(msg, { tone: "critical" });
    } finally {
      setUploading(false);
    }
  };

  /** Full artwork: one image over the whole dieline of one surface (outside, or inside when both print). */
  const setSheet = useCallback(
    (side: PrintSurface, img: SheetImage | null, coalesce?: string) => {
      const cur = docRef.current;
      const next = { ...cur, artwork: { ...cur.artwork, [side]: { ...cur.artwork[side], sheetImage: img } } };
      docRef.current = next;
      commit(next, coalesce);
    },
    [commit],
  );
  // Dieline remap: a file made on the buyer's own printer template is recognised and re-composed
  // on this box's template (designer: dieline remap).
  const sheetRemap = useSheetRemap({
    model,
    modelCode: docModelCode(doc),
    sheets: { outside: doc.artwork.outside.sheetImage, inside: doc.artwork.inside.sheetImage },
    enabled: !isVessel && libModel?.kind === "box",
    setSheet,
  });
  const onRecognisedApply = async (side: PrintSurface, match: Recognised, dims: Dims) => {
    const cur = docRef.current;
    const sheet = sheetRemap.withMatch(side, match);
    const artwork = sheet ? { ...cur.artwork, [side]: { ...cur.artwork[side], sheetImage: sheet } } : cur.artwork;
    const ok = match.code === docModelCode(cur) ? applyGeometry({ ...cur, dims, artwork }) : await onModel(match.code, dims, artwork);
    if (ok) toast.show(t("designer.artworkFit.recogApplied", { name: modelByCode(match.code)?.name[locale] ?? match.code, size: formatSheetCm(dims, locale) }));
  };
  const onSheetUpload = async (file: File, side: PrintSurface) => {
    setUploading(true);
    setUploadError(null);
    try {
      // The full-size file lands first; recognising its cut lines goes on in the worker.
      await sheetRemap.upload(file, side);
      if (side === "inside") {
        // Seeing it: open the box and look in (designer: inside artwork).
        showInside(true);
        toast.show(t("designer.artworkFit.insideAdded"));
      } else {
        if (insideView) showInside(false);
        toast.show(t("designer.artwork.sheetAdded"));
      }
    } catch (e) {
      const msg = t(e instanceof UploadError ? UPLOAD_ERROR_KEY[e.kind] : "designer.artwork.uploadError");
      setUploadError(msg);
      // The drop zone that shows uploadError sits above this section: say it where the buyer is looking.
      toast.show(msg, { tone: "critical" });
    } finally {
      setUploading(false);
    }
  };
  const onSheetRemove = (side: PrintSurface) => {
    const cur = docRef.current;
    commit({ ...cur, artwork: { ...cur.artwork, [side]: { ...cur.artwork[side], sheetImage: null } } });
  };
  /** Fit check: apply a size of this model, or another model at a size, keeping the artwork. */
  const onSheetFitDims = (dims: Dims) => {
    changeGeometry({ dims });
    toast.show(t("designer.artworkFit.sizeChanged", { size: formatSheetCm(dims, locale) }));
  };
  const onSheetFitModel = async (code: string, dims: Dims) => {
    if (await onModel(code, dims)) toast.show(t("designer.artworkFit.boxChanged", { name: modelByCode(code)?.name[locale] ?? code }));
  };

  // ── inside view: open the box and look in, or back to the closed outside ──
  const [insideView, setInsideView] = useState(false);
  const insideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(insideTimer.current), []);
  // Back to outside only: the inside view has nothing to show.
  useEffect(() => {
    if (!bothSides && insideView) {
      setInsideView(false);
      setFold(1);
    }
  }, [bothSides, insideView]);
  const showInside = (on: boolean) => {
    setInsideView(on);
    setView("3d");
    setFold(on ? INSIDE_VIEW_FOLD : 1);
    clearTimeout(insideTimer.current);
    // Re-frame once the new fold target is set, then tilt the camera to look down into the box.
    insideTimer.current = setTimeout(() => {
      sceneRef.current?.reset();
      if (on) insideTimer.current = setTimeout(() => sceneRef.current?.rotate(0, INSIDE_VIEW_TILT), 650);
    }, 60);
  };

  // ── 3D: click or drop an image on a side of the box ──────────────────
  const pickFaceAt = useCallback(
    (x: number, y: number) => {
      const hit = sceneRef.current?.pickAt?.(x, y);
      const m = modelRef.current;
      if (!hit || !m) return null;
      if (hit.surface === "inside" && docRef.current.printSides !== "BOTH") return null;
      return faceAtHit(m, hit);
    },
    [],
  );
  const faceInput = useRef<HTMLInputElement>(null);
  const faceTarget = useRef<{ face: FaceId; surface: PrintSurface; at?: { x: number; y: number } } | null>(null);
  const press = useRef<{ x: number; y: number; t: number } | null>(null);
  const [hoverFace, setHoverFace] = useState<FaceId | null>(null);
  const [dragFace, setDragFace] = useState<FaceId | "none" | null>(null);
  const [hoverSurface, setHoverSurface] = useState<PrintSurface>("outside");
  const [landed, setLanded] = useState<{ low: boolean } | null>(null);
  const landedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(landedTimer.current), []);
  const moveRaf = useRef(0);
  const tapGlow = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const trackHover = (x: number, y: number, drag: boolean) => {
    const hit = pickFaceAt(x, y);
    if (hit) setHoverSurface(hit.surface);
    if (drag) setDragFace(hit?.face ?? "none");
    else setHoverFace(hit?.face ?? null);
  };
  // the side under the pointer (or the drop target) glows in the 3D view. Over a full artwork a
  // plain mouse hover only shows the hint: the glow's tint and rim read as a seam on the printed
  // edges (owner, 2026-11-10: line along the top edge). Drops and taps still glow.
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (!hoverFace) setFlash(false);
  }, [hoverFace]);
  const sheetUnder = !!doc.artwork[hoverSurface]?.sheetImage;
  const glowFace = dragFace && dragFace !== "none" ? dragFace : hoverFace && (!sheetUnder || flash) ? hoverFace : null;
  useEffect(() => {
    const ids = glowFace ? modelRef.current?.faces[glowFace]?.parts.map((p) => p.panelId) : null;
    sceneRef.current?.highlight?.(ids ?? null, hoverSurface);
  }, [glowFace, hoverSurface]);
  useEffect(() => () => clearTimeout(tapGlow.current), []);
  const scenePointer = {
    onPointerDown: (e: React.PointerEvent) => {
      // only presses on the 3D canvas itself (not the view buttons laid over it)
      press.current = e.button === 0 && (e.target as HTMLElement).tagName === "CANVAS" ? { x: e.clientX, y: e.clientY, t: performance.now() } : null;
    },
    onPointerUp: (e: React.PointerEvent) => {
      const p = press.current;
      press.current = null;
      // a click, not an orbit drag: short and still
      if (!p || e.button !== 0 || Math.hypot(e.clientX - p.x, e.clientY - p.y) > 5 || performance.now() - p.t > 450) return;
      if (isVessel || layerCount(docRef.current) >= 60) return;
      const hit = pickFaceAt(e.clientX, e.clientY);
      if (!hit) return;
      setFace(hit.face);
      setSurface(hit.surface);
      // show which side was tapped (touch has no hover)
      setHoverSurface(hit.surface);
      setHoverFace(hit.face);
      clearTimeout(tapGlow.current);
        setFlash(true);
      tapGlow.current = setTimeout(() => setHoverFace(null), 1500);
      faceTarget.current = hit;
      faceInput.current?.click();
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (e.buttons || isVessel || e.pointerType !== "mouse") return;
      if ((e.target as HTMLElement).tagName !== "CANVAS") {
        setHoverFace(null);
        return;
      }
      const { clientX, clientY } = e;
      cancelAnimationFrame(moveRaf.current);
      moveRaf.current = requestAnimationFrame(() => trackHover(clientX, clientY, false));
    },
    onPointerLeave: () => setHoverFace(null),
    onDragOver: (e: React.DragEvent) => {
      if (isVessel || !e.dataTransfer.types.includes("Files")) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      const { clientX, clientY } = e;
      cancelAnimationFrame(moveRaf.current);
      moveRaf.current = requestAnimationFrame(() => trackHover(clientX, clientY, true));
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) setDragFace(null);
    },
    onDrop: (e: React.DragEvent) => {
      if (isVessel) return;
      e.preventDefault();
      setDragFace(null);
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      const hit = pickFaceAt(e.clientX, e.clientY);
      if (!hit) {
        toast.show(t("designer.artwork.dropOnBox"));
        return;
      }
      void onUpload(file, hit);
    },
  };

  const downloadDieline = async (kind: "svg" | "pdf", side: PrintSurface = "outside") => {
    const m = modelRef.current;
    if (!m) return;
    const name = `elba-${libModel?.slug ?? slugify(doc.structureCode)}-${doc.dims.L}x${doc.dims.W}x${doc.dims.H}-dieline${side === "inside" ? "-inside" : ""}`;
    if (kind === "svg") {
      const label = doc.name || libModel?.slug || doc.structureCode;
      // The inside template is the sheet seen from inside (flipped), as inside full artwork is painted.
      const title = side === "inside" ? t("designer.artworkFit.insideTemplateTitle", { name: label }) : `${label} dieline`;
      const svg = dielineToSvg(m, { showBleed: true, showSafeZones: true, showLabels: true, locale, title, inside: side === "inside" });
      downloadBlob(new Blob([svg], { type: "image/svg+xml" }), `${name}.svg`);
      return;
    }
    await downloadPdf("template");
  };

  const downloadPdf = async (kind: "print" | "template") => {
    const res = await fetch("/api/designs/print-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doc: docRef.current, kind }),
    });
    if (!res.ok) throw new Error(`pdf ${res.status}`);
    const blob = await res.blob();
    const cd = res.headers.get("Content-Disposition") ?? "";
    downloadBlob(blob, /filename="([^"]+)"/.exec(cd)?.[1] ?? `elba-${kind}.pdf`);
  };

  const logoFace = logoFaceOf(model, isVessel);
  const onAddText = () => {
    // Simple mode: on the logo's side, outside, under the logo when there is one.
    const f = simple && logoFace ? logoFace : face;
    const s: PrintSurface = simple ? "outside" : surface;
    const info = faces[f];
    if (!info) return;
    let text = makeTextLayer(f, s, info, locale === "ar" ? t("designer.artwork.defaultTextAr") : t("designer.artwork.defaultTextEn"));
    // Start at a size that fits the panel's safe zone.
    const room = Math.max(10, info.width - 2 * (model?.safeMm ?? 3)) * 0.8;
    const m = measureText(text);
    if (m.width > room) text = { ...text, fontSizePt: Math.max(6, Math.floor(text.fontSizePt * (room / m.width))) };
    text = fitTextBox({ ...text, color: contrastingInk(docRef.current.artwork[s].background ?? look.outside) });
    if (simple && model && docRef.current.artwork[s].layers.some((l) => l.face === f)) text = placeLayer(text, info, "bottom", model.safeMm);
    add(text);
    if (simple) {
      setFace(f);
      setSurface(s);
      setFocusTextId(text.id);
      // Phones: the sheet comes up with the text field focused, ready to type.
      setSheetOpen(true);
    }
  };
  /** Simple mode's "Add your logo": the file picker, then the logo's side in 3D. */
  const addLogo = () => {
    if (!logoFace || layerCount(docRef.current) >= 60) return;
    faceTarget.current = { face: logoFace, surface: "outside" };
    faceInput.current?.click();
  };
  /** Basics: the same picture on every other side, one undo step. */
  const onAllSides = (id: string) => {
    const r = copyToSides(docRef.current, id, faces, undefined, modelRef.current ?? undefined);
    if (!r.added) {
      toast.show(t("designer.simple.allSidesNone"));
      return;
    }
    commit(fillEmptyFinishMasks(r.doc));
    sceneRef.current?.reset();
    toast.show(t("designer.simple.allSidesDone", { count: r.added }), { action: { content: t("designer.history.undo"), onAction: () => dispatch({ type: "undo" }) } });
  };
  /** Image fit: Fill the side or Fit the whole image (at a share of the biggest fit size). */
  const imagePlace = {
    scaleOf: (l: ImageLayer) => {
      const m = modelRef.current;
      const info = m?.faces[l.face];
      return m && info && l.place === "fit" ? fitScaleOf(l, info, m) : null;
    },
    set: (l: ImageLayer, mode: ImagePlace, scale?: number) => {
      const m = modelRef.current;
      const info = m?.faces[l.face];
      if (!m || !info) return;
      // A Fit image keeps its spot when resized; one that was filling starts centred.
      const at = l.place === "fit" ? { x: l.x, y: l.y } : undefined;
      const k = scale ?? (l.place === "fit" && mode === "fit" ? fitScaleOf(l, info, m) : undefined);
      commit(updateLayer(docRef.current, l.id, () => placeImage(l, info, m, mode, { scale: k, at })), scale === undefined ? undefined : `scale:${l.id}`);
    },
  };
  const onAddShape = (shape: "rect" | "ellipse") => faceInfo && add(makeShapeLayer(face, surface, faceInfo, shape));
  const onDelete = (id: string) => {
    commit(fillEmptyFinishMasks(removeLayer(docRef.current, id)));
    if (selectedId === id) setSelectedId(null);
    toast.show(t("designer.artwork.deleted"), { action: { content: t("designer.history.undo"), onAction: () => dispatch({ type: "undo" }) } });
  };
  const onPlace = (where: Placement) => {
    if (!selected || !model) return;
    const info = model.faces[selected.face];
    if (info) onLayerChange(placeLayer(selected, info, where, model.safeMm));
  };

  const selectLayer = (id: string | null) => {
    setSelectedId(id);
    const l = findLayer(docRef.current, id);
    if (l) {
      setFace(l.face);
      setSurface(l.surface);
    }
  };

  const goToLayer = (id: string | undefined, f: FaceId | undefined, s?: PrintSurface) => {
    if (f) setFace(f);
    if (s) setSurface(s);
    if (id) selectLayer(id);
    setView("face");
    setTab(1);
  };

  const pickFace = (f: FaceId) => {
    setFace(f);
    setSelectedId(null);
    if (view === "3d") sceneRef.current?.setView(f);
  };

  // Undo / redo shortcuts (not while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) dispatch({ type: "undo" });
      else if ((k === "z" && e.shiftKey) || k === "y") dispatch({ type: "redo" });
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── actions behind the gate ───────────────────────────────────────
  const doSave = () =>
    requireAccount("save", async () => {
      const id = await saveToServer({ thumbnail: true });
      if (id) {
        trackClient("design_saved", { structure_code: docRef.current.structureCode, locale });
        toast.show(t("designer.save.savedToast"));
      }
      else toast.show(t("designer.save.failed"), { tone: "critical" });
    });

  const doExport = () => requireAccount("export", () => setModal("export"));

  /** Ray-traced studio photo of the box (photoRender.ts); progress and cancel in the export dialog. */
  const exportPhoto = async (transparent: boolean) => {
    setExporting(true);
    const ac = new AbortController();
    photoAbort.current = ac;
    try {
      if (view !== "3d") setView("3d");
      for (let i = 0; i < 40 && !sceneRef.current?.getModel?.(); i++) await new Promise((r) => setTimeout(r, 100));
      const scene = sceneRef.current;
      if (!scene) throw new Error("3D view not ready");
      setPhotoProgress(0);
      const shot = await withCleanArtwork(() =>
        scene.renderPhoto
          ? scene.renderPhoto({ width: 1600, height: 1200, background: transparent ? "transparent" : "studio", signal: ac.signal, onProgress: setPhotoProgress })
          : scene.screenshot({ width: 1600, height: 1200, supersample: 2, background: transparent ? null : "#efeeeb" }).then((blob) => ({ blob, samples: 0, ms: 0, fallback: true })),
      );
      downloadBlob(shot.blob, `${exportBase()}-photo.png`);
      trackClient("export_png", { size: "photo", structure_code: docRef.current.structureCode, locale });
      setModal(null);
      toast.show(shot.fallback ? t("designer.export.photoFallback") : t("designer.export.done"), { action: { content: orderLabel, onAction: doOrder } });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) toast.show(t("designer.export.failed"), { tone: "critical" });
    } finally {
      photoAbort.current = null;
      setPhotoProgress(null);
      setExporting(false);
    }
  };

  const exportPng = async (size: ExportSize, opts?: { transparent?: boolean }) => {
    if (size === "photo") return exportPhoto(!!opts?.transparent);
    if (size === "pdf" || size === "dielinePdf" || size === "dielineSvg" || size === "glb") return exportFile(size);
    setExporting(true);
    try {
      if (view !== "3d") setView("3d");
      // Wait for the lazily loaded 3D view to be ready.
      for (let i = 0; i < 40 && !sceneRef.current?.getCanvas(); i++) await new Promise((r) => setTimeout(r, 100));
      const px = size === "uhd" ? 3840 : size === "hd" ? 2160 : 1080;
      // Supersampled (rendered larger, scaled down): crisp fold lines and print detail. The 4K
      // studio render keeps a see-through background for websites and catalogues.
      const shot = await shoot({ width: px, height: px, background: size === "uhd" ? null : "#ffffff", supersample: 2, maxSize: 4096 });
      // B-22: the standard PNG carries the small Elba mark (social loop); HD stays clean.
      const blob = size !== "standard" ? shot : await stampExportMark(shot, { locale }).catch(() => shot);
      // Arabic names have no Latin letters: fall back to the model slug, not "box" (R4-07).
      downloadBlob(blob, `${exportBase()}-${px}.png`);
      trackClient("export_png", { size, structure_code: doc.structureCode, locale });
      setModal(null);
      toast.show(t("designer.export.done"), { action: { content: orderLabel, onAction: doOrder } });
    } catch {
      toast.show(t("designer.export.failed"), { tone: "critical" });
    } finally {
      setExporting(false);
    }
  };

  const exportBase = () => `elba-${slugify(docRef.current.name) || libModel?.slug || slugify(docRef.current.structureCode) || "design"}`;

  /** Print PDF, dieline template (SVG / PDF) and the GLB 3D model. */
  const exportFile = async (kind: "pdf" | "dielinePdf" | "dielineSvg" | "glb") => {
    setExporting(true);
    try {
      if (kind === "pdf") await downloadPdf("print");
      else if (kind === "dielinePdf") await downloadPdf("template");
      else if (kind === "dielineSvg") await downloadDieline("svg");
      else {
        if (view !== "3d") setView("3d");
        for (let i = 0; i < 40 && !sceneRef.current?.getModel?.(); i++) await new Promise((r) => setTimeout(r, 100));
        const root = sceneRef.current?.getModel?.();
        const c = { get outside() { return canvasesRef.current?.outside ?? null; }, get inside() { return canvasesRef.current?.inside ?? null; } };
        const m = modelRef.current;
        if (!root || !m) throw new Error("3D view not ready");
        const { exportGlb } = await import("./exportGlb");
        const blob = await withCleanArtwork(() => exportGlb(root, {
          outside: c?.outside ?? null,
          inside: docRef.current.printSides === "BOTH" ? (c?.inside ?? null) : null,
          board: boardAppearance(docRef.current.materialCode),
          name: docRef.current.name,
        }));
        downloadBlob(blob, `${exportBase()}.glb`);
      }
      trackClient("export_png", { size: kind, structure_code: docRef.current.structureCode, locale });
      setModal(null);
      toast.show(t("designer.export.fileDone"), { action: { content: orderLabel, onAction: doOrder } });
    } catch {
      toast.show(t("designer.export.fileFailed"), { tone: "critical" });
    } finally {
      setExporting(false);
    }
  };

  const doShare = () =>
    requireAccount("share", async () => {
      setShareUrl(null);
      setShareError(false);
      setModal("share");
      const id = await saveToServer({ thumbnail: true });
      if (!id) return setShareError(true);
      try {
        const res = await fetch(`/api/designs/${encodeURIComponent(id)}/share`, { method: "POST" });
        if (!res.ok) throw new Error();
        const { path } = (await res.json()) as { path: string };
        setShareUrl(`${window.location.origin}/${locale}${path}`);
      } catch {
        setShareError(true);
      }
    });

  const doOrder = () =>
    requireAccount("order", async () => {
      setOrdering(true);
      const id = await saveToServer({ thumbnail: true });
      if (id) router.push(`/${locale}/checkout/${encodeURIComponent(id)}`);
      else {
        setOrdering(false);
        toast.show(t("designer.order.failed"), { tone: "critical" });
      }
    });

  // R1-01: no account needed to see the price sheet; R1-21: clear any toast so it never covers it.
  const openPrice = () => {
    toast.dismissAll();
    setModal("price");
  };

  // ── render helpers ────────────────────────────────────────────────
  const statusText = stale
    ? t("designer.save.stalePaused")
    : saveState === "saving"
      ? t("designer.save.saving")
      : saveState === "saved"
        ? user
          ? t("designer.save.savedAccount")
          : t("designer.save.savedLocal")
        : saveState === "tooLarge"
          ? t("designer.save.tooLarge")
          : saveState === "error"
          ? online
            ? t("designer.save.failed")
            : t("designer.save.offline")
          : saveState === "dirty"
            ? t("designer.save.unsaved")
            : "";

  // Containers: faces are print areas (wrap label, back label, pouch panels…).
  const faceNames = useMemo(() => {
    const out: Partial<Record<FaceId, string>> = {};
    if (geo?.vessel) {
      const map = facesForAreas(geo.vessel.areas);
      for (const a of geo.vessel.areas) {
        const f = map.get(a.id);
        if (f) out[f] = a.name[locale] || surfaceName(a.kind, locale);
      }
    }
    return out;
  }, [geo, locale]);
  const faceLabel = useCallback((f: FaceId) => faceNames[f] ?? t(`designer.faces.${f}` as DictKey), [faceNames, t]);

  const panelLabels = useMemo(() => {
    const out: Record<string, string> = { glue: t("designer.view.glue") };
    for (const f of FACE_IDS) out[f] = faceLabel(f);
    return out;
  }, [t, faceLabel]);

  const tabs = [
    { id: "box", content: libModel?.kind === "vessel" ? t("library.panel.model") : t("designer.tabs.box") },
    { id: "artwork", content: t("designer.tabs.artwork") },
    { id: "layers", content: t("designer.tabs.layers") },
    { id: "check", content: t("designer.tabs.check"), badge: summary.errors + summary.warnings || undefined },
  ];

  // Masked finishes the selected item can carry ("Spot UV on this item", FN-02).
  const layerFinishes = useMemo(
    () =>
      !isVessel && selected
        ? (doc.finishes ?? []).filter((f) => FINISHES[f.code].masked).map((f) => ({ code: f.code, name: FINISHES[f.code].name[locale], on: !!f.mask?.layerIds.includes(selected.id) }))
        : [],
    [doc.finishes, selected, isVessel, locale],
  );
  const faceOptions = FACE_IDS.filter((f) => faces[f]).map((f) => ({ value: f, label: faceLabel(f) }));
  // Open-top styles (FEFCO 0700…) never close: fold 100 % reads "Assembled". The catalogue adds
  // `openTop` to the library; read it defensively until then.
  const openTop = !!(libModel as { openTop?: boolean } | null)?.openTop;
  const structureName = libModel?.name[locale] ?? t(`structures.${doc.structureCode}` as DictKey);

  // Rail (start side on wide screens, bottom tab bar on phones): Basics sections, or the All options tabs.
  const railTabs: { id: string; label: string; icon: LucideIcon; selected: boolean; badge?: number; onSelect: () => void }[] = simple
    ? (
        [
          ["logo", t("designer.simple.railLogo"), ImagePlus],
          ["colour", t("designer.simple.railColours"), Palette],
          ["size", t("designer.simple.railSize"), Ruler],
          ["more", t("designer.simple.railMore"), Ellipsis],
        ] as const
      ).map(([id, label, icon]) => ({
        id,
        label,
        icon,
        selected: section === id,
        onSelect: () => {
          // Phones: the tab opens the sheet; the open tab closes it.
          if (!wide && sheetOpen && section === id) setSheetOpen(false);
          else {
            setSection(id);
            setSheetOpen(true);
          }
        },
      }))
    : tabs.map((tb, i) => ({
        id: tb.id,
        label: tb.content,
        icon: [Box, Brush, Layers, ListChecks][i]!,
        selected: tab === i,
        badge: tb.badge,
        onSelect: () => {
          if (!wide && sheetOpen && tab === i) setSheetOpen(false);
          else {
            startTransition(() => setTab(i));
            setSheetOpen(true);
          }
        },
      }));
  const boxModel = !!model && !isVessel;

  return (
    <BrandColorsProvider value={brandApi}>
    <div className={styles.editor} data-live="true" data-mode={simple ? "simple" : "advanced"} data-sheet={sheetOpen ? "open" : "closed"} data-banner={stale || notFound ? "true" : undefined}>
      <h1 className="visually-hidden">{t("designer.editorTitle", { structure: structureName })}</h1>

      {/* ── top bar: wordmark and design name at the start, save and order at the end ── */}
      <header className={styles.edBar}>
        <Link href={`/${locale}`} className={styles.edBrand}>
          <ElbaWordmark tone="base" />
          <span className="visually-hidden">{t("nav.home")}</span>
        </Link>
        <span className={styles.edDivider} aria-hidden="true" />
        <Button
          variant="tertiary"
          icon={<Icon source={ArrowLeft} flipInRtl />}
          url={`/${locale}/design`}
          accessibilityLabel={t("designer.backToStyles")}
        />
        <div className={styles.nameField}>
          <TextField
            label={t("designer.save.name")}
            labelHidden
            variant="borderless"
            autoComplete="off"
            size="slim"
            maxLength={120}
            placeholder={t(isVessel ? "designer.container.untitled" : "designer.untitled")}
            value={doc.name}
            onChange={(v) => commit({ ...docRef.current, name: v }, "name")}
            onBlur={seal}
          />
        </div>
        <span className={styles.saveStatus} role="status" data-testid="save-status" data-state={saveState} title={statusText || undefined}>
          {saveState === "error" || saveState === "tooLarge" ? (
            <CloudOff size={16} aria-hidden />
          ) : saveState === "saved" ? (
            <CloudCheck size={16} aria-hidden />
          ) : saveState === "saving" || saveState === "dirty" ? (
            <CloudUpload size={16} aria-hidden />
          ) : null}
          <span className={styles.saveStatusText}>{statusText}</span>
        </span>
        {saveState === "error" && online ? (
          <Button size="slim" variant="tertiary" onClick={retryNow}>
            {t("designer.save.retry")}
          </Button>
        ) : null}
        <span className={styles.toolbarSpacer} />
        <span className={styles.edLinks}>
          <Suspense fallback={null}>
            <TopBarLanguage />
          </Suspense>
          {user ? (
            <Link href={`/${locale}/orders`} className={styles.topBarLink}>
              <UserRound aria-hidden size={16} />
              <span className={styles.collapseText}>{user.name || t("designer.simple.account")}</span>
            </Link>
          ) : (
            <Suspense fallback={null}>
              <TopBarSignIn />
            </Suspense>
          )}
        </span>
        <span className={styles.edDivider} data-end="true" aria-hidden="true" />
        <div className={styles.toolbar} role="toolbar" aria-label={t("designer.title")}>
          {/* Basics: the print check lives in All options (the small-logo warning is in the panel). */}
          {simple ? null : (
            <span className={styles.preflightChip}>
              <PreflightBadge summary={summary} />
            </span>
          )}
          {simple ? null : (
            <div className={styles.desktopActions}>
              <Button icon={Download} onClick={doExport}>
                {t("designer.export.button")}
              </Button>
              <Button icon={Share2} onClick={doShare}>
                {t("designer.share.button")}
              </Button>
              <Button icon={Save} onClick={doSave}>
                {t("designer.save.save")}
              </Button>
            </div>
          )}
          {/* Basics: one "Save and share" menu on every screen, so Order is the only big action
              (the design autosaves). Phones show it as an icon ("More actions"). */}
          <div className={simple ? styles.menuActions : styles.mobileActions} ref={moreRef}>
            <Popover
              active={moreOpen}
              onClose={() => setMoreOpen(false)}
              preferredAlignment="end"
              activator={
                simple && wide ? (
                  <Button icon={Share2} disclosure={moreOpen ? "up" : "down"} ariaHaspopup="menu" ariaExpanded={moreOpen} onClick={() => setMoreOpen((o) => !o)}>
                    {t("designer.simple.menu")}
                  </Button>
                ) : (
                  <Button icon={MoreHorizontal} accessibilityLabel={t("designer.view.more")} ariaHaspopup="menu" ariaExpanded={moreOpen} onClick={() => setMoreOpen((o) => !o)} />
                )
              }
            >
              <ActionList
                actionRole="menuitem"
                onActionAnyItem={() => setMoreOpen(false)}
                items={[
                  { content: t("designer.export.button"), icon: Download, onAction: fromMenu(doExport) },
                  { content: t("designer.share.button"), icon: Share2, onAction: fromMenu(doShare) },
                  { content: t("designer.save.save"), icon: Save, onAction: fromMenu(doSave) },
                  // R5-JR-14: phones have no name field in the toolbar; the share page and follow-ups
                  // used the style name for every phone design.
                  ...(wide ? [] : [{ content: t("designer.save.rename"), icon: Pencil, onAction: fromMenu(() => setRenameOpen(true)) }]),
                ]}
              />
            </Popover>
          </div>
          {/* The one strong action, on every screen (phones too: it stays visible over the sheet). */}
          <span className={styles.toolbarOrder}>
            <Button variant="primary" onClick={doOrder} loading={ordering}>
              {orderLabel}
            </Button>
          </span>
        </div>
      </header>

      {/* ── workspace: the canvas fills it; rail, panel and tools float over it ── */}
      <div className={styles.workspace}>
        {stale || notFound ? (
          <div className={styles.banner}>
            {stale ? (
              <Banner
                tone="warning"
                title={t("designer.save.staleTitle")}
                announce
                action={{ content: t("designer.save.staleReload"), onAction: () => window.location.reload() }}
                secondaryAction={{
                  content: t("designer.save.staleKeep"),
                  onAction: () => {
                    staleRef.current = false;
                    setStale(false);
                    // Deliberate overwrite of the newer copy (R10-R1).
                    void saveToServer({ force: true });
                  },
                }}
              >
                {t("designer.save.staleBody")}
              </Banner>
            ) : null}
            {notFound ? (
              <Banner tone="warning" onDismiss={() => setNotFound(false)}>
                {t("designer.load.notFound")}
              </Banner>
            ) : null}
          </div>
        ) : null}

        <section className={styles.stage} aria-label={t("designer.view.label")}>
          {/* All options: which panel the artwork tools work on (or which side of the flat sheet). */}
          {simple ? null : view !== "dieline" ? (
            <div className={styles.stageHeader}>
              <div className={styles.faceSelect}>
                {/* Label above, value only inside (CR-47 / CR-58: no "الوجه الأمام" run-on, one type size). */}
                <Select label={t("designer.artwork.face")} labelInline size="slim" value={face} options={faceOptions} onChange={(v) => pickFace(v as FaceId)} />
              </div>
            </div>
          ) : bothSides ? (
            <div className={styles.stageHeader}>
              <ButtonGroup variant="segmented" accessibilityLabel={t("designer.view.sideView")}>
                {(["outside", "inside"] as const).map((s) => (
                  <Button key={s} size="slim" pressed={surface === s} onClick={() => setSurface(s)}>
                    {t(s === "outside" ? "designer.view.outside" : "designer.view.inside")}
                  </Button>
                ))}
              </ButtonGroup>
            </div>
          ) : null}

          <div className={styles.stageBody}>
            {model ? (
              <>
                <div
                  className={styles.sceneWrap}
                  data-active={view === "3d"}
                  aria-hidden={view !== "3d"}
                  data-testid="stage-3d"
                  data-model={docModelCode(doc)}
                  data-pick={hoverFace ? "face" : undefined}
                  data-dragging={dragFace ? "true" : undefined}
                  {...(view === "3d" ? scenePointer : {})}
                >
                  <input
                    ref={faceInput}
                    type="file"
                    accept={IMAGE_ACCEPT}
                    hidden
                    tabIndex={-1}
                    aria-hidden="true"
                    data-testid="face-upload-input"
                    onChange={(e) => {
                      const file = e.currentTarget.files?.[0];
                      e.currentTarget.value = "";
                      const target = faceTarget.current;
                      faceTarget.current = null;
                      if (file && target) void onUpload(file, target);
                    }}
                  />
                  {landed && !dragFace ? (
                    <div className={styles.landedChip} role="status" data-low={landed.low || undefined}>
                      <PartyPopper size={18} aria-hidden />
                      <span>
                        {t("designer.simple.landed")}
                        {landed.low ? <small>{t("designer.simple.landedLowRes")}</small> : null}
                      </span>
                    </div>
                  ) : dragFace || (hoverFace && !uploading) ? (
                    <div className={styles.dropHint} role="status">
                      {dragFace === "none"
                        ? t("designer.artwork.dropOnBox")
                        : dragFace
                          ? t("designer.artwork.dropHere", { face: faceLabel(dragFace) })
                          : t("designer.artwork.clickHere", { face: faceLabel(hoverFace!) })}
                    </div>
                  ) : !isVessel && !uploading && !hasImage(doc) ? (
                    <div className={styles.dropHint} data-idle="true">
                      {t("designer.artwork.pickHint")}
                    </div>
                  ) : null}
                  <Stage3D
                    ariaLabel={t("viewer.label")}
                    roleDescription={t("viewer.roleDescription")}
                    keyboardHint={t("viewer.keyboardHint")}
                    fallback={t("viewer.unsupported")}
                    onReady={onSceneReady}
                    {...(geo?.vessel && libModel?.kind === "vessel"
                      ? {
                          vessel: {
                            model: libModel,
                            doc,
                            geo,
                            sheet: canvases?.outside ?? null,
                            version,
                            handleRef: sceneRef,
                            turntable: viewOpts.turntable,
                            open: viewOpts.open,
                          },
                        }
                      : {
                          box: {
                            model,
                            material: doc.materialCode,
                            finish: doc.finishCode,
                            finishes: doc.finishes,
                            artwork: doc.artwork,
                            images,
                            foldProgress: fold,
                            canvases,
                            version,
                            printInside: bothSides,
                            handleRef: sceneRef,
                            dimensions: viewOpts.dimensions,
                            scene: viewOpts.scene,
                            turntable: viewOpts.turntable,
                            locale,
                          },
                        })}
                  />
                  {/* Large poster from the first paint until the 3D chunk renders a frame (PERF-10). */}
                  {libModel ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={posterSrc && libModel.code === docModelCode(initialDoc) ? posterSrc : `/models/${libModel.slug}.svg`} alt="" aria-hidden="true" className={styles.stagePoster} data-hidden={sceneReady ? "true" : undefined} />
                  ) : null}
                </div>
                {view === "face" && faceInfo ? (
                  <FaceEditor
                    face={faceInfo}
                    surface={surface}
                    layers={surfaceLayers}
                    background={doc.artwork[surface].background}
                    boardColor={surface === "outside" ? look.outside : look.inside}
                    safeMm={model.safeMm}
                    images={images}
                    paintVersion={`${imgVersion}:${fonts}`}
                    selectedId={selectedId}
                    onSelect={(id) => {
                      setSelectedId(id);
                      if (id) setTab(1);
                    }}
                    onChange={onLayerChange}
                    onCommit={seal}
                    onDelete={onDelete}
                    label={t("designer.view.faceEditorLabel", { face: faceLabel(face) })}
                    hint={t("designer.view.faceEditorHint")}
                    selectedLabel={(l) => `${t("designer.artwork.selected")}: ${layerName(l, t)}`}
                    positionLabel={(l) =>
                      t("designer.layer.positionAnnounce", { x: formatNumber(l.x, 1), y: formatNumber(l.y, 1), w: formatNumber(l.width, 1), h: formatNumber(l.height, 1), r: formatNumber(l.rotation) })
                    }
                  />
                ) : null}
                {view === "dieline" ? (
                  <DielineView
                    model={model}
                    source={canvases ? canvases[surface] : null}
                    version={version}
                    label={t("designer.view.dielineLabel")}
                    legend={t("designer.view.dielineLegend")}
                    size={t("designer.view.dielineSize", {
                      w: `⁦${formatNumber(model.dieBounds.width, 0)}`,
                      h: `${formatNumber(model.dieBounds.height, 0)}⁩`,
                      b: formatNumber(model.bleedMm),
                      s: formatNumber(model.safeMm),
                    })}
                    panelLabels={panelLabels}
                    locale={locale}
                  />
                ) : null}
              </>
            ) : (
              <div className={styles.sceneLoading} role="status" aria-busy="true">
                {/* Skeleton, not a spinner (CR-21 / CR-24), same as the route loader. */}
                <StageSkeleton />
                <span className="visually-hidden">{t("designer.view.loading")}</span>
              </div>
            )}
          </div>
        </section>

        {/* Floating tool column (end side): history, then the single-pointer alternative to dragging the view (WCAG 2.5.7). */}
        <div className={styles.toolColumn} role="toolbar" aria-label={t("designer.simple.tools")} aria-orientation="vertical">
          <button type="button" className={styles.toolButton} aria-label={t("designer.history.undo")} title={t("designer.history.undo")} disabled={!canUndo(hist)} onClick={() => dispatch({ type: "undo" })}>
            <Undo2 size={18} aria-hidden />
          </button>
          <button type="button" className={styles.toolButton} aria-label={t("designer.history.redo")} title={t("designer.history.redo")} disabled={!canRedo(hist)} onClick={() => dispatch({ type: "redo" })}>
            <Redo2 size={18} aria-hidden />
          </button>
          <span className={styles.toolSep} aria-hidden="true" />
          {/* Spatial arrows: never mirrored (the scene is not). */}
          <button type="button" className={styles.toolButton} aria-label={t("viewer.rotateLeft")} title={t("viewer.rotateLeft")} disabled={view !== "3d"} onClick={() => sceneRef.current?.rotate(-20)}>
            <RotateCcw size={18} aria-hidden />
          </button>
          <button type="button" className={styles.toolButton} aria-label={t("viewer.rotateRight")} title={t("viewer.rotateRight")} disabled={view !== "3d"} onClick={() => sceneRef.current?.rotate(20)}>
            <RotateCw size={18} aria-hidden />
          </button>
          <button type="button" className={styles.toolButton} aria-label={t("viewer.reset")} title={t("viewer.reset")} disabled={view !== "3d"} onClick={() => sceneRef.current?.reset()}>
            <Focus size={18} aria-hidden />
          </button>
        </div>

        {/* Floating bottom dock: zoom, open / closed, the views; the price pill beside it. */}
        <div className={styles.dock} ref={dockRef}>
          <div className={styles.viewBar} role="toolbar" aria-label={t("designer.simple.viewBar")}>
            <button type="button" className={styles.toolButton} aria-label={t("viewer.zoomOut")} title={t("viewer.zoomOut")} disabled={view !== "3d"} onClick={() => sceneRef.current?.zoom(1.25)}>
              <Minus size={18} aria-hidden />
            </button>
            <button type="button" className={styles.toolButton} aria-label={t("viewer.zoomIn")} title={t("viewer.zoomIn")} disabled={view !== "3d"} onClick={() => sceneRef.current?.zoom(0.8)}>
              <Plus size={18} aria-hidden />
            </button>
            <span className={styles.toolSep} aria-hidden="true" />
            {boxModel ? (
              <label className={styles.foldControl}>
                <span className={styles.foldEnd} aria-hidden="true">
                  {t("designer.simple.foldOpen")}
                </span>
                <input
                  type="range"
                  className={styles.foldRange}
                  min={0}
                  max={100}
                  step={5}
                  value={Math.round(fold * 100)}
                  aria-label={t("designer.view.fold")}
                  aria-valuetext={t("designer.view.foldValue", { pct: Math.round(fold * 100) })}
                  style={{ "--fold": `${Math.round(fold * 100)}%` } as CSSProperties}
                  onChange={(e) => {
                    setFold(Number(e.currentTarget.value) / 100);
                    if (view !== "3d") setView("3d");
                  }}
                />
                <span className={styles.foldEnd} aria-hidden="true">
                  {openTop ? t("designer.view.assembled") : t("designer.simple.foldClosed")}
                </span>
              </label>
            ) : null}
            {boxModel && bothSides ? (
              // Inside and outside both print: flip the 3D between the closed outside and the open inside.
              <button type="button" className={styles.toolButton} data-wide="true" data-testid="inside-view-toggle" onClick={() => showInside(!insideView)}>
                {insideView ? t("designer.artworkFit.showOutside") : t("designer.artworkFit.showInside")}
              </button>
            ) : null}
            {boxModel ? null : isVessel ? (
              <>
                <button type="button" className={styles.toolButton} data-wide="true" aria-pressed={viewOpts.open} onClick={() => setViewOpts((o) => ({ ...o, open: !o.open }))}>
                  {t("library.panel.openClosure")}
                </button>
                <button type="button" className={styles.toolButton} aria-pressed={viewOpts.turntable} aria-label={t("library.panel.turntable")} title={t("library.panel.turntable")} onClick={() => setViewOpts((o) => ({ ...o, turntable: !o.turntable }))}>
                  <Rotate3d size={18} aria-hidden />
                </button>
              </>
            ) : null}
            <span className={styles.toolSep} aria-hidden="true" />
            <button type="button" className={styles.toolButton} aria-pressed={view === "3d"} aria-label={t("designer.view.threeD")} title={t("designer.view.threeD")} onClick={() => setView("3d")}>
              <Box size={18} aria-hidden />
            </button>
            {simple ? null : (
              <button type="button" className={styles.toolButton} aria-pressed={view === "face"} aria-label={t("designer.view.face")} title={t("designer.view.face")} onClick={() => setView("face")}>
                <Square size={18} aria-hidden />
              </button>
            )}
            <button type="button" className={styles.toolButton} aria-pressed={view === "dieline"} aria-label={t("designer.view.dieline")} title={t("designer.view.dieline")} onClick={() => setView("dieline")}>
              <PanelsTopLeft size={18} aria-hidden />
            </button>
            {boxModel ? (
              <button
                type="button"
                className={styles.toolButton}
                aria-pressed={viewOpts.dimensions}
                aria-label={t("library.panel.dimensions")}
                title={t("library.panel.dimensions")}
                onClick={() => {
                  setViewOpts((o) => ({ ...o, dimensions: !o.dimensions }));
                  if (view !== "3d") setView("3d");
                }}
              >
                <Ruler size={18} aria-hidden />
              </button>
            ) : null}
          </div>
          <div className={styles.priceRow}>
            <PriceBadge state={price} onClick={openPrice} vessel={isVessel} />
          </div>
        </div>

        {/* ── rail + floating panel (wide) / tab bar + bottom sheet (phones) ── */}
        <aside className={styles.panel} aria-label={t("designer.tabs.label")} ref={asideRef}>
          <nav className={styles.rail} aria-label={t("designer.simple.railLabel")} ref={actionBarRef}>
            <div className={styles.railCard} role="tablist" aria-label={t("designer.simple.railLabel")} aria-orientation={wide ? "vertical" : "horizontal"}>
              {railTabs.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  role="tab"
                  id={`rail-${r.id}`}
                  aria-selected={r.selected}
                  aria-controls="designer-panel"
                  className={styles.railItem}
                  onClick={r.onSelect}
                >
                  <span className={styles.railIcon} aria-hidden="true">
                    <r.icon size={20} strokeWidth={1.75} />
                    {r.badge ? <span className={styles.railBadge}>{r.badge}</span> : null}
                  </span>
                  <span className={styles.railLabel}>{r.label}</span>
                </button>
              ))}
            </div>
            <div className={styles.railCard} data-extra="true">
              <button type="button" className={styles.railItem} onClick={openPicker}>
                <span className={styles.railIcon} aria-hidden="true">
                  <Package size={20} strokeWidth={1.75} />
                </span>
                <span className={styles.railLabel}>{t(isVessel ? "designer.simple.railTypeVessel" : "designer.simple.railType")}</span>
              </button>
            </div>
          </nav>
          <div className={styles.sheet}>
            <button
              type="button"
              className={styles.sheetToggle}
              aria-expanded={sheetOpen}
              aria-controls="designer-panel"
              onClick={() => {
                if (swipedRef.current) swipedRef.current = false;
                else setSheetOpen((o) => !o);
              }}
              // Swipe the handle up / down as a shortcut; a tap does the same (WCAG 2.5.7).
              onPointerDown={(e) => {
                swipeY.current = e.clientY;
                swipedRef.current = false;
                e.currentTarget.setPointerCapture?.(e.pointerId);
              }}
              onPointerUp={(e) => {
                if (swipeY.current === null) return;
                const dy = e.clientY - swipeY.current;
                swipeY.current = null;
                if (Math.abs(dy) > 24) {
                  swipedRef.current = true;
                  setSheetOpen(dy < 0);
                }
              }}
              onPointerCancel={() => {
                swipeY.current = null;
              }}
            >
              {sheetOpen ? <ChevronDown size={20} aria-hidden /> : <ChevronUp size={20} aria-hidden />}
              <span>{sheetOpen ? t(isVessel ? "designer.container.collapse" : "designer.sheet.collapse") : t("designer.sheet.expand")}</span>
            </button>
            <div className={styles.panelInner} id="designer-panel" role="tabpanel" aria-labelledby={`rail-${railTabs.find((r) => r.selected)?.id ?? railTabs[0]!.id}`}>
              <div className={styles.modeSwitch}>
                <ButtonGroup variant="segmented" accessibilityLabel={t("designer.simple.modeLabel")}>
                  <Button pressed={simple} onClick={() => setMode("simple")}>
                    {t("designer.simple.modeSimple")}
                  </Button>
                  <Button pressed={!simple} onClick={() => setMode("advanced")}>
                    {t("designer.simple.modeAdvanced")}
                  </Button>
                </ButtonGroup>
              </div>
              {simple ? (
                <div className={styles.panelBody} data-tab="simple">
                  <SimplePanel
                    doc={doc}
                    model={libModel}
                    selected={selected}
                    uploading={uploading}
                    uploadError={uploadError}
                    faceLabel={faceLabel}
                    focusTextId={focusTextId}
                    onFocusedText={() => setFocusTextId(null)}
                    onAddLogo={addLogo}
                    onLogoFile={logoFace ? (file) => void onUpload(file, { face: logoFace, surface: "outside" }) : undefined}
                    onAddText={onAddText}
                    onSelect={selectLayer}
                    onLayer={onLayerChange}
                    onSeal={seal}
                    onPlace={onPlace}
                    onDelete={onDelete}
                    faceSize={(f) => faces[f] ?? null}
                    imagePlace={imagePlace}
                    onAllSides={isVessel ? undefined : onAllSides}
                    onBackground={(c) => commit(setBackground(docRef.current, "outside", c), "bg:outside")}
                    onGeometry={changeGeometry}
                    onOpenPicker={openPicker}
                    section={section}
                    onSection={setSection}
                    onAdvanced={(i) => {
                      setMode("advanced");
                      if (i !== undefined) setTab(i);
                    }}
                  />
                  {!user ? (
                    <Text as="p" variant="bodySm" tone="subdued">
                      <Badge tone="info">{t("designer.freeBadge")}</Badge> {t("designer.save.anonNote")}
                    </Text>
                  ) : null}
                </div>
              ) : (
                <div className={styles.panelBody} data-tab={TAB_IDS[tab]}>
                  <h2 className={styles.panelTitle}>{tabs[tab]!.content}</h2>
                  {tab === 0 ? (
                    libModel ? (
                      <ConfigPanel
                        doc={doc}
                        model={libModel}
                        geo={geo}
                        view={viewOpts}
                        onView={setViewOpts}
                        onOpenPicker={openPicker}
                        onGeometry={changeGeometry}
                        onFinish={onFinish}
                        onFinishSwap={onFinishSwap}
                        onPrintSides={onPrintSides}
                      />
                    ) : null
                  ) : tab === 1 ? (
                    <ArtworkPanel
                      dieline={isVessel ? null : model}
                      faces={faces}
                      faceLabel={faceLabel}
                      face={face}
                      surface={surface}
                      bothSides={bothSides}
                      background={doc.artwork[surface].background}
                      selected={selected}
                      layerTotal={layerCount(doc)}
                      uploading={uploading}
                      uploadError={uploadError}
                      onFace={pickFace}
                      onSurface={setSurface}
                      onBackground={(c) => commit(setBackground(docRef.current, surface, c), `bg:${surface}`)}
                      onUpload={onUpload}
                      onUploadRejected={(reason) => setUploadError(t(UPLOAD_ERROR_KEY[reason]))}
                      onAddText={onAddText}
                      onAddShape={onAddShape}
                      onLayer={onLayerChange}
                      onSeal={seal}
                      onPlace={onPlace}
                      imagePlace={imagePlace}
                      onReorder={(d) => selected && commit(reorderLayer(docRef.current, selected.id, d))}
                      onDuplicate={() => {
                        if (!selected) return;
                        const r = duplicateLayer(docRef.current, selected.id);
                        commit(r.doc);
                        if (r.id) setSelectedId(r.id);
                      }}
                      onDelete={() => selected && onDelete(selected.id)}
                      layerFinishes={layerFinishes}
                      onLayerFinish={(code, on) => selected && commit(setLayerFinish(docRef.current, code, selected.id, on))}
                      sheetArtwork={
                        !isVessel && model ? (
                          <SheetArtwork
                            locale={locale}
                            model={model}
                            surfaces={bothSides ? ["outside", "inside"] : ["outside"]}
                            images={{ outside: doc.artwork.outside.sheetImage, inside: doc.artwork.inside.sheetImage }}
                            fit={libModel?.kind === "box" ? { def: libModel, dims: doc.dims, material: doc.materialCode, features: doc.features } : null}
                            uploading={uploading}
                            onUpload={(file, side) => void onSheetUpload(file, side)}
                            onRemove={onSheetRemove}
                            onTemplate={(side) => void downloadDieline("svg", side)}
                            onApplyDims={onSheetFitDims}
                            onApplyModel={(code, dims) => void onSheetFitModel(code, dims)}
                            onPrepare={sheetRemap.prepare}
                            recognised={Object.fromEntries(
                              (["outside", "inside"] as PrintSurface[]).map((side) => [
                                side,
                                <RecognisedCard
                                  key={side}
                                  locale={locale}
                                  state={sheetRemap.state[side]}
                                  current={{ code: docModelCode(doc), dims: doc.dims }}
                                  onApply={(m, d) => void onRecognisedApply(side, m, d)}
                                />,
                              ]),
                            )}
                          />
                        ) : null
                      }
                    />
                  ) : tab === 2 ? (
                    <LayersPanel doc={doc} faces={faces} faceLabel={faceLabel} issues={issues} selectedId={selectedId} onSelect={(id, f, s) => goToLayer(id, f, s)} />
                  ) : (
                    <PreflightPanel issues={issues} summary={summary} layers={allLayers(doc)} faceLabel={faceLabel} onShow={(id, f) => goToLayer(id, f)} />
                  )}
                  {!user && tab !== 3 ? (
                    <Text as="p" variant="bodySm" tone="subdued">
                      <Badge tone="info">{t("designer.freeBadge")}</Badge> {t("designer.save.anonNote")}
                    </Text>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {pickerUsed ? <ModelPicker open={pickerOpen} current={docModelCode(doc)} onClose={() => setPickerOpen(false)} onPick={onModel} /> : null}
      <GateModal reason={gate?.reason ?? null} onClose={() => setGate(null)} onSuccess={onSignedIn} />
      <PriceModal
        open={modal === "price"}
        doc={doc}
        onClose={() => setModal(null)}
        ordering={ordering}
        onOrder={() => {
          setModal(null);
          doOrder();
        }}
        onUseDims={(dims) => {
          changeGeometry({ dims });
          setModal(null);
        }}
      />
      <ExportModal
        open={modal === "export"}
        onClose={() => setModal(null)}
        onExport={exportPng}
        model3d={!isVessel}
        busy={exporting}
        photoProgress={photoProgress}
        onCancelPhoto={() => photoAbort.current?.abort()}
        orderLabel={orderLabel}
        onOrder={() => {
          setModal(null);
          doOrder();
        }}
      />
      <ShareModal open={modal === "share"} onClose={() => setModal(null)} url={shareUrl} error={shareError} vessel={isVessel} />
      <Modal
        open={renameOpen}
        onClose={() => {
          seal();
          setRenameOpen(false);
        }}
        title={t("designer.save.renameHeading")}
        size="small"
        primaryAction={{
          content: t("designer.save.renameDone"),
          onAction: () => {
            seal();
            setRenameOpen(false);
          },
        }}
      >
        <TextField
          label={t("designer.save.name")}
          autoComplete="off"
          maxLength={120}
          placeholder={t(isVessel ? "designer.container.untitled" : "designer.untitled")}
          value={doc.name}
          onChange={(v) => commit({ ...docRef.current, name: v }, "name")}
        />
      </Modal>
      <BrandColorsModal open={brandModal !== null} colors={brandColors} initialHex={brandModal?.hex ?? null} onClose={() => setBrandModal(null)} onSave={saveBrandColors} />
    </div>
    </BrandColorsProvider>
  );
}
