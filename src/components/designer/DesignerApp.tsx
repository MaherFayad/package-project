"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronDown, ChevronUp, CloudCheck, CloudOff, CloudUpload, Download, Move3d, MoreHorizontal, Pencil, Redo2, RotateCcw, Save, Share2, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { startTransition, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { FACE_IDS, type ArtworkLayer, type DesignDoc, type DesignFinishCode, type DimsPreset, type FaceId, type Locale, type PrintSurface, type StructureCode } from "@/types";
import { boardAppearance, type DielineModel } from "@/lib/dieline";
import type { ModelDef } from "@/lib/library";
import { loadModel, modelByCode } from "@/lib/library/registry";
import { useLibraryModel } from "@/lib/library/useLibraryModel";
import { defaultMaxDpr } from "@/components/three/dpr";
import { docGeometry, docModel, docModelCode, facesForAreas, normaliseDocModel } from "@/lib/library/doc";
import { FINISHES } from "@/lib/configurator";
import { ViewControls, type PackagingSceneHandle } from "@/components/three";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n/types";
import {
  ActionList,
  Badge,
  Banner,
  Button,
  ButtonGroup,
  Icon,
  Modal,
  Popover,
  RangeSlider,
  Select,
  Tabs,
  Text,
  TextField,
  useToast,
} from "@/components/ui";
import type { OtpSuccess } from "@/components/auth";
import {
  addLayer,
  allLayers,
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
import { runPreflight, summarizePreflight } from "./lib/preflight";
import { placeLayer, type Placement } from "./lib/geometry";
import { BADGE_QTY, fetchQuote, quoteKey, type PriceState } from "./lib/quote";
import { designerPath } from "./lib/catalog";
import { fillEmptyFinishMasks, pruneFinishes, setLayerFinish, toggleFinish } from "./lib/config";
import { createModelDoc } from "./lib/doc";
import { layerName } from "./lib/describe";
import { ConfigPanel, surfaceName, type ViewOptions } from "./ConfigPanel";
import lib from "./library.module.css";
import { loadLocalDraft, saveLocalDraft } from "./lib/storage";
import { useArtworkCanvases } from "./useArtworkCanvases";
import { prepareImage, UploadError, type UploadErrorKind } from "./uploadImage";
import { stampExportMark } from "@/components/marketing/exportMark";
import { formatNumber } from "@/lib/format";
import { fitTextBox, measureText } from "./fonts";
import { FaceEditor } from "./FaceEditor";
import { DielineView } from "./DielineView";
import { ArtworkPanel } from "./ArtworkPanel";
import { LayersPanel } from "./LayersPanel";
import { PreflightBadge, PreflightPanel } from "./PreflightPanel";
import { orderModeOf } from "@/data/catalogue/order-mode";
import { ExportModal, GateModal, PriceBadge, PriceModal, ShareModal, type ExportSize, type GateReason } from "./Modals";
import { BrandColorsModal, BrandColorsProvider, usedBrandColors, type BrandColorsApi } from "./BrandColors";
import type { BrandColor } from "@/types";
import styles from "./designer.module.css";
import { trackClient } from "@/lib/analytics/client";

const StageSkeleton = () => <div className={lib.stageSkeleton} aria-hidden="true" />;
// One persistent 3D canvas for boxes and containers (PERF-09).
const Stage3D = dynamic(() => import("./Stage3D"), { ssr: false, loading: StageSkeleton });
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
  const toast = useToast();

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
  const [sheetOpen, setSheetOpen] = useState(false);
  const swipeY = useRef<number | null>(null);
  const swipedRef = useRef(false);
  const [saveState, setSaveState] = useState<SaveState>(initialDesignId ? "saved" : "idle");
  const [gate, setGate] = useState<{ reason: GateReason; then: () => void } | null>(null);
  const [modal, setModal] = useState<ModalName>(null);
  const [price, setPrice] = useState<PriceState>(initialUser ? { status: "idle" } : { status: "locked" });
  // R6-05: also when the live price says "by quote" (a special-gluing model no printer lists yet).
  const byQuote = staticQuote || price.status === "quote";
  const orderLabel = byQuote ? t("designer.price.quoteAction") : t(isVessel ? "designer.container.order" : "designer.order.button");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareError, setShareError] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Mounted on first open and kept (so closing animates and returns focus).
  const [pickerUsed, setPickerUsed] = useState(false);
  useEffect(() => {
    if (pickerOpen) setPickerUsed(true);
  }, [pickerOpen]);
  const [viewOpts, setViewOpts] = useState<ViewOptions>({ dimensions: false, scene: "none", turntable: false, open: false });
  const [notFound, setNotFound] = useState(loadError === "notFound");
  const sceneRef = useRef<PackagingSceneHandle | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const onSceneReady = useCallback(() => setSceneReady(true), []);
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
  const shoot = useCallback(async (opts: Parameters<PackagingSceneHandle["screenshot"]>[0]) => {
    const scene = sceneRef.current;
    if (!scene) throw new Error("3D view not ready");
    const outside = docRef.current.artwork.outside;
    if (outside.layers.length > 0 || outside.background) return scene.screenshot(opts);
    const before = versionRef.current;
    setCleanShot(true);
    try {
      for (let i = 0; i < 40 && versionRef.current === before; i++) await new Promise((r) => setTimeout(r, 25));
      // Let the texture upload and one frame render with the repainted sheet.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return await scene.screenshot(opts);
    } finally {
      setCleanShot(false);
    }
  }, []);

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
      if (inflight.current) await inflight.current.catch(() => null);
      const run = (async () => {
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
    setPrice({ status: "idle" });
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
    if (!user) {
      setPrice({ status: "locked" });
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      setPrice({ status: "loading" });
      fetchQuote(docRef.current, BADGE_QTY, ctrl.signal)
        .then((s) => {
          if (s.status === "locked") setUser(null);
          startTransition(() => setPrice(s));
        })
        .catch(() => undefined);
    }, 500);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [qKey, user]);

  // ── document operations ───────────────────────────────────────────
  /** Apply a geometry change (size, board, features, container), keeping artwork in place. */
  const applyGeometry = useCallback(
    (next: DesignDoc, coalesce?: string) => {
      const normal = normaliseDocModel(next);
      const nextGeo = docGeometry(normal);
      if (!nextGeo) return false;
      const m = docModel(normal);
      const pruned = m ? pruneFinishes(normal, m) : { doc: normal, removed: [] as DesignFinishCode[] };
      const { doc: rescaled, removed } = rescaleArtwork(pruned.doc, faceSizesOf(geoFacesRef.current), faceSizesOf(nextGeo.dieline.faces));
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
  const onModel = async (code: string) => {
    setPickerOpen(false);
    // Another family's pack loads on demand (PERF-04).
    const m = modelByCode(code) ?? (await loadModel(code));
    if (!m) return;
    const cur = docRef.current;
    const fresh = createModelDoc(m, { name: cur.name, materialCode: cur.materialCode });
    const next: DesignDoc = { ...fresh, artwork: cur.artwork, printSides: m.kind === "box" ? cur.printSides : "OUTSIDE", finishes: cur.finishes, finishCode: cur.finishCode };
    if (applyGeometry(next)) setUrl(designIdRef.current, code);
  };

  const openPicker = useCallback(() => setPickerOpen(true), []);
  const onFinish = useCallback((code: DesignFinishCode, on: boolean) => commit(toggleFinish(docRef.current, code, on)), [commit]);
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
      commit(updateLayer(docRef.current, layer.id, () => next), coalesce);
    },
    [commit],
  );

  const add = (layer: ArtworkLayer) => {
    if (layerCount(docRef.current) >= 60) return;
    // A masked finish switched on before any artwork existed starts on the first item (FN-02).
    commit(fillEmptyFinishMasks(addLayer(docRef.current, layer)));
    setSelectedId(layer.id);
    setView("face");
  };

  const onUpload = async (file: File) => {
    if (!faceInfo) return;
    setUploading(true);
    setUploadError(null);
    try {
      const img = await prepareImage(file);
      add(makeImageLayer(face, surface, faceInfo, img));
      if (!sentRef.current.uploaded) {
        sentRef.current.uploaded = true;
        trackClient("artwork_uploaded", { structure_code: docRef.current.structureCode, surface, locale });
      }
    } catch (e) {
      // R10-02: say which rule the file broke (WCAG 3.3.1 / 3.3.3).
      setUploadError(t(e instanceof UploadError ? UPLOAD_ERROR_KEY[e.kind] : "designer.artwork.uploadError"));
    } finally {
      setUploading(false);
    }
  };

  const onAddText = () => {
    if (!faceInfo) return;
    let text = makeTextLayer(face, surface, faceInfo, locale === "ar" ? t("designer.artwork.defaultTextAr") : t("designer.artwork.defaultTextEn"));
    // Start at a size that fits the panel's safe zone.
    const room = Math.max(10, faceInfo.width - 2 * (model?.safeMm ?? 3)) * 0.8;
    const m = measureText(text);
    if (m.width > room) text = { ...text, fontSizePt: Math.max(6, Math.floor(text.fontSizePt * (room / m.width))) };
    add(fitTextBox({ ...text, color: contrastingInk(docRef.current.artwork[surface].background ?? look.outside) }));
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

  const exportPng = async (size: ExportSize) => {
    setExporting(true);
    try {
      if (view !== "3d") setView("3d");
      // Wait for the lazily loaded 3D view to be ready.
      for (let i = 0; i < 40 && !sceneRef.current?.getCanvas(); i++) await new Promise((r) => setTimeout(r, 100));
      const px = size === "hd" ? 2160 : 1080;
      const shot = await shoot({ width: px, height: px, background: "#ffffff" });
      // B-22: the standard PNG carries the small Elba mark (social loop); HD stays clean.
      const blob = size === "hd" ? shot : await stampExportMark(shot, { locale }).catch(() => shot);
      // Arabic names have no Latin letters: fall back to the model slug, not "box" (R4-07).
      downloadBlob(blob, `elba-${slugify(doc.name) || libModel?.slug || slugify(doc.structureCode) || "design"}-${px}.png`);
      trackClient("export_png", { size, structure_code: doc.structureCode, locale });
      setModal(null);
      toast.show(t("designer.export.done"), { action: { content: orderLabel, onAction: doOrder } });
    } catch {
      toast.show(t("designer.export.failed"), { tone: "critical" });
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

  const openPrice = () => requireAccount("price", () => setModal("price"));

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

  const viewControls = (
    <ViewControls
      handle={sceneRef}
      labels={{
        group: t("viewer.controls"),
        rotateLeft: t("viewer.rotateLeft"),
        rotateRight: t("viewer.rotateRight"),
        tiltUp: t("viewer.tiltUp"),
        tiltDown: t("viewer.tiltDown"),
        zoomIn: t("viewer.zoomIn"),
        zoomOut: t("viewer.zoomOut"),
        reset: t("viewer.reset"),
      }}
    />
  );

  // Phones (R4-CR-11): the seven view buttons fold into one "Adjust view" menu in the fold row, so
  // the canvas keeps its height. The menu stays open between taps (rotate, rotate…); Escape or a
  // tap outside closes it. Dragging the model does the same (WCAG 2.5.7: the menu is the
  // single-pointer alternative).
  const viewMenu = (
    <Popover
      active={viewMenuOpen}
      onClose={() => setViewMenuOpen(false)}
      preferredAlignment="end"
      activator={
        <Button size="slim" icon={Move3d} ariaHaspopup="menu" ariaExpanded={viewMenuOpen} onClick={() => setViewMenuOpen((o) => !o)}>
          {t("designer.view.adjust")}
        </Button>
      }
    >
      <ActionList
        actionRole="menuitem"
        items={[
          { content: t("viewer.rotateLeft"), icon: ArrowLeft, onAction: () => sceneRef.current?.rotate(-20) },
          { content: t("viewer.rotateRight"), icon: ArrowRight, onAction: () => sceneRef.current?.rotate(20) },
          { content: t("viewer.tiltUp"), icon: ArrowUp, onAction: () => sceneRef.current?.rotate(0, 12) },
          { content: t("viewer.tiltDown"), icon: ArrowDown, onAction: () => sceneRef.current?.rotate(0, -12) },
          { content: t("viewer.zoomIn"), icon: ZoomIn, onAction: () => sceneRef.current?.zoom(0.8) },
          { content: t("viewer.zoomOut"), icon: ZoomOut, onAction: () => sceneRef.current?.zoom(1.25) },
          { content: t("viewer.reset"), icon: RotateCcw, onAction: () => sceneRef.current?.reset() },
        ]}
      />
    </Popover>
  );

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

  return (
    <BrandColorsProvider value={brandApi}>
    <div className={styles.editor} data-sheet={sheetOpen ? "open" : "closed"} data-banner={stale || notFound ? "true" : undefined}>
      <h1 className="visually-hidden">{t("designer.editorTitle", { structure: structureName })}</h1>

      {/* ── toolbar ── */}
      <div className={styles.toolbar} role="toolbar" aria-label={t("designer.title")}>
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
            autoComplete="off"
            size="slim"
            maxLength={120}
            placeholder={t(isVessel ? "designer.container.untitled" : "designer.untitled")}
            value={doc.name}
            onChange={(v) => commit({ ...docRef.current, name: v }, "name")}
            onBlur={seal}
          />
        </div>
        <ButtonGroup variant="segmented" accessibilityLabel={t("designer.history.undo")}>
          <Button icon={Undo2} accessibilityLabel={t("designer.history.undo")} disabled={!canUndo(hist)} onClick={() => dispatch({ type: "undo" })} />
          <Button icon={Redo2} accessibilityLabel={t("designer.history.redo")} disabled={!canRedo(hist)} onClick={() => dispatch({ type: "redo" })} />
        </ButtonGroup>
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
        <span className={styles.preflightChip}>
          <PreflightBadge summary={summary} />
        </span>
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
        <div className={styles.mobileActions}>
          <Popover
            active={moreOpen}
            onClose={() => setMoreOpen(false)}
            preferredAlignment="end"
            activator={
              <Button icon={MoreHorizontal} accessibilityLabel={t("designer.view.more")} ariaHaspopup="menu" ariaExpanded={moreOpen} onClick={() => setMoreOpen((o) => !o)} />
            }
          >
            <ActionList
              actionRole="menuitem"
              onActionAnyItem={() => setMoreOpen(false)}
              items={[
                { content: t("designer.export.button"), icon: Download, onAction: doExport },
                { content: t("designer.share.button"), icon: Share2, onAction: doShare },
                { content: t("designer.save.save"), icon: Save, onAction: doSave },
                // R5-JR-14: phones have no name field in the toolbar; the share page and follow-ups
                // used the style name for every phone design.
                { content: t("designer.save.rename"), icon: Pencil, onAction: () => setRenameOpen(true) },
              ]}
            />
          </Popover>
        </div>
        <Button variant="primary" onClick={doOrder} loading={ordering}>
          {orderLabel}
        </Button>
      </div>

      <div className={styles.priceRow}>
        <PriceBadge state={price} onClick={openPrice} vessel={isVessel} />
      </div>

      {stale ? (
        <div className={styles.banner}>
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
        </div>
      ) : null}

      {notFound ? (
        <div className={styles.banner}>
          <Banner tone="warning" onDismiss={() => setNotFound(false)}>
            {t("designer.load.notFound")}
          </Banner>
        </div>
      ) : null}

      {/* ── stage ── */}
      <section className={styles.stage} aria-label={t("designer.view.label")}>
        <div className={styles.stageHeader}>
          <ButtonGroup variant="segmented" accessibilityLabel={t("designer.view.label")}>
            {(["3d", "face", "dieline"] as const).map((v) => (
              <Button key={v} size="slim" pressed={view === v} onClick={() => setView(v)}>
                {t(v === "3d" ? "designer.view.threeD" : v === "face" ? "designer.view.face" : "designer.view.dieline")}
              </Button>
            ))}
          </ButtonGroup>
          {view !== "dieline" ? (
            <div className={styles.faceSelect}>
              {/* Label above, value only inside (CR-47 / CR-58: no "الوجه الأمام" run-on, one type size). */}
              <Select label={t("designer.artwork.face")} size="slim" value={face} options={faceOptions} onChange={(v) => pickFace(v as FaceId)} />
            </div>
          ) : bothSides ? (
            <ButtonGroup variant="segmented" accessibilityLabel={t("designer.view.sideView")}>
              {(["outside", "inside"] as const).map((s) => (
                <Button key={s} size="slim" pressed={surface === s} onClick={() => setSurface(s)}>
                  {t(s === "outside" ? "designer.view.outside" : "designer.view.inside")}
                </Button>
              ))}
            </ButtonGroup>
          ) : null}
        </div>

        <div className={styles.stageBody}>
          {model ? (
            <>
              <div className={styles.sceneWrap} data-active={view === "3d"} aria-hidden={view !== "3d"} data-testid="stage-3d" data-model={docModelCode(doc)}>
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
                {wide ? <div className={styles.viewControls}>{viewControls}</div> : null}
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
                    w: `\u2066${formatNumber(model.dieBounds.width, 0)}`,
                    h: `${formatNumber(model.dieBounds.height, 0)}\u2069`,
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

        {view === "3d" && isVessel ? (
          <div className={styles.foldRow}>
            <ButtonGroup variant="segmented" accessibilityLabel={t("library.panel.closure")}>
              <Button size="slim" pressed={!viewOpts.open} onClick={() => setViewOpts((o) => ({ ...o, open: false }))}>
                {t("library.panel.closeClosure")}
              </Button>
              <Button size="slim" pressed={viewOpts.open} onClick={() => setViewOpts((o) => ({ ...o, open: true }))}>
                {t("library.panel.openClosure")}
              </Button>
            </ButtonGroup>
            <Button size="slim" pressed={viewOpts.turntable} onClick={() => setViewOpts((o) => ({ ...o, turntable: !o.turntable }))}>
              {t("library.panel.turntable")}
            </Button>
            {!wide ? <span className={styles.viewMenuSlot}>{viewMenu}</span> : null}
          </div>
        ) : null}
        {view === "3d" && !isVessel ? (
          <div className={styles.foldRow}>
            <div className={styles.foldSlider}>
              <RangeSlider
                label={t("designer.view.fold")}
                min={0}
                max={100}
                step={5}
                value={Math.round(fold * 100)}
                onChange={(v) => setFold(v / 100)}
                output
                formatValue={(v) => t("designer.view.foldValue", { pct: v })}
              />
            </div>
            <ButtonGroup variant="segmented" accessibilityLabel={t("designer.view.fold")}>
              <Button size="slim" pressed={fold === 0} onClick={() => setFold(0)}>
                {t("designer.view.flat")}
              </Button>
              <Button size="slim" pressed={fold === 0.5} onClick={() => setFold(0.5)}>
                {t("designer.view.half")}
              </Button>
              <Button size="slim" pressed={fold === 1} onClick={() => setFold(1)}>
                {openTop ? t("designer.view.assembled") : t("designer.view.closed")}
              </Button>
            </ButtonGroup>
            {!wide ? <span className={styles.viewMenuSlot}>{viewMenu}</span> : null}
          </div>
        ) : null}
      </section>

      {/* ── side panel / bottom sheet ── */}
      <aside className={styles.panel} aria-label={t("designer.tabs.label")}>
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
        <div className={styles.panelInner} id="designer-panel">
          <Tabs tabs={tabs} selected={tab} onSelect={(i) => startTransition(() => setTab(i))} fitted accessibilityLabel={t("designer.tabs.label")}>
            <div className={styles.panelBody} data-tab={TAB_IDS[tab]}>
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
                    onPrintSides={onPrintSides}
                  />
                ) : null
              ) : tab === 1 ? (
                <ArtworkPanel
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
          </Tabs>
        </div>
      </aside>

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
        busy={exporting}
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
