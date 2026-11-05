"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, ChevronUp, CloudCheck, CloudOff, Download, MoreHorizontal, Redo2, Save, Share2, Undo2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { FACE_IDS, type ArtworkLayer, type DesignDoc, type Dims, type DimsPreset, type FaceId, type Locale, type PrintSurface, type StructureCode } from "@/types";
import { BOARD_SPECS, boardAppearance, defaultMaterialFor, materialFitsStructure, tryGenerateDieline, type DielineModel } from "@/lib/dieline";
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
  Popover,
  RangeSlider,
  Select,
  Spinner,
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
import { FALLBACK_PRESETS, STRUCTURE_SLUGS, designerPath } from "./lib/catalog";
import { loadLocalDraft, saveLocalDraft } from "./lib/storage";
import { useArtworkCanvases } from "./useArtworkCanvases";
import { prepareImage } from "./uploadImage";
import { fitTextBox, measureText } from "./fonts";
import { FaceEditor } from "./FaceEditor";
import { DielineView } from "./DielineView";
import { BoxPanel } from "./BoxPanel";
import { ArtworkPanel } from "./ArtworkPanel";
import { LayersPanel } from "./LayersPanel";
import { PreflightBadge, PreflightPanel } from "./PreflightPanel";
import { ExportModal, GateModal, PriceBadge, PriceModal, ShareModal, type ExportSize, type GateReason } from "./Modals";
import styles from "./designer.module.css";

const Scene3D = dynamic(() => import("./Scene3D"), {
  ssr: false,
  loading: () => (
    <div className={styles.sceneLoading}>
      <Spinner size="large" decorative />
    </div>
  ),
});

type View = "3d" | "face" | "dieline";
type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";
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
  initialUser: DesignerUser | null;
  presetsByCode: Partial<Record<StructureCode, DimsPreset[]>>;
  loadError: "notFound" | null;
  /** Restore this device's autosaved draft on mount (?resume=1). */
  resumeLocal?: boolean;
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
      .slice(0, 40) || "box"
  );
}

export function DesignerApp({ locale, initialDoc, initialDesignId, initialUser, presetsByCode, loadError, resumeLocal }: DesignerAppProps) {
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

  const model = useMemo<DielineModel | null>(
    () => tryGenerateDieline(doc.structureCode, doc.dims, { thicknessMm: BOARD_SPECS[doc.materialCode].thicknessMm }),
    [doc.structureCode, doc.dims, doc.materialCode],
  );
  const modelRef = useRef(model);
  modelRef.current = model;
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
  const [saveState, setSaveState] = useState<SaveState>(initialDesignId ? "saved" : "idle");
  const [gate, setGate] = useState<{ reason: GateReason; then: () => void } | null>(null);
  const [modal, setModal] = useState<ModalName>(null);
  const [price, setPrice] = useState<PriceState>(initialUser ? { status: "idle" } : { status: "locked" });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareError, setShareError] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [notFound, setNotFound] = useState(loadError === "notFound");
  const sceneRef = useRef<PackagingSceneHandle | null>(null);
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
    if (draft && draft.doc.structureCode === initialDoc.structureCode) {
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
  const { canvases, version, images, imgVersion, fonts } = useArtworkCanvases(model, doc.artwork, doc.materialCode, bothSides);

  // ── preflight ────────────────────────────────────────────────────
  const issues = useMemo(() => (model ? runPreflight(doc, model) : []), [doc, model]);
  const summary = useMemo(() => summarizePreflight(issues), [issues]);

  // ── saving ───────────────────────────────────────────────────────
  const inflight = useRef<Promise<string | null> | null>(null);

  const setUrl = useCallback(
    (id: string | null, code: StructureCode) => {
      const url = designerPath(locale, code, { d: id ?? undefined });
      if (typeof window !== "undefined" && window.location.pathname + window.location.search !== url) window.history.replaceState(null, "", url);
    },
    [locale],
  );

  const saveToServer = useCallback(
    async (opts: { thumbnail?: boolean } = {}): Promise<string | null> => {
      if (inflight.current) await inflight.current.catch(() => null);
      const run = (async () => {
        const current = docRef.current;
        setSaveState("saving");
        let thumbnail: string | undefined;
        if (opts.thumbnail && sceneRef.current) {
          try {
            const blob = await sceneRef.current.screenshot({ width: 320, height: 320, mimeType: "image/jpeg", quality: 0.8, background: "#f1f1f1" });
            const url = await blobToDataUrl(blob);
            if (url.length < 400_000) thumbnail = url;
          } catch {
            /* the 3D view may not be ready; the thumbnail is optional */
          }
        }
        const body = JSON.stringify({ doc: { ...current, id: undefined }, ...(thumbnail ? { thumbnail } : {}) });
        const send = (id: string | null) =>
          fetch(id ? `/api/designs/${encodeURIComponent(id)}` : "/api/designs", { method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body });
        try {
          let res = await send(designIdRef.current);
          // Expired or not ours any more (e.g. signed out): keep the work as a new design.
          if (designIdRef.current && (res.status === 404 || res.status === 403)) res = await send(null);
          if (!res.ok) throw new Error(String(res.status));
          const json = (await res.json()) as { id: string; owned: boolean };
          savedDocRef.current = current;
          setDesignId(json.id);
          designIdRef.current = json.id;
          setUrl(json.id, current.structureCode);
          saveLocalDraft({ doc: current, designId: json.id, savedAt: Date.now() });
          setSaveState(docRef.current === current ? "saved" : "dirty");
          return json.id;
        } catch {
          setSaveState("error");
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
    [setUrl],
  );

  // Autosave: this device right away, the server after a pause (anonymous designs too).
  const touched = hist.past.length > 0 || designId !== null;
  useEffect(() => {
    if (!touched) return;
    if (savedDocRef.current !== doc) setSaveState((s) => (s === "saving" ? s : "dirty"));
    const local = setTimeout(() => saveLocalDraft({ doc, designId: designIdRef.current, savedAt: Date.now() }), 600);
    const server = setTimeout(() => {
      if (savedDocRef.current !== docRef.current) void saveToServer();
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
      else setGate({ reason, then });
    },
    [user],
  );

  const onSignedIn = (u: OtpSuccess) => {
    const pending = gate?.then;
    setUser({ id: u.id, name: u.name });
    setGate(null);
    setPrice({ status: "idle" });
    router.refresh();
    // verify-otp claimed this browser's anonymous designs; continue what the user asked for.
    if (pending) setTimeout(pending, 0);
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
          setPrice(s);
        })
        .catch(() => undefined);
    }, 500);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [qKey, user]);

  // ── document operations ───────────────────────────────────────────
  const changeGeometry = useCallback(
    (patch: Partial<Pick<DesignDoc, "structureCode" | "dims" | "materialCode">>) => {
      const cur = docRef.current;
      const next: DesignDoc = { ...cur, ...patch };
      if (!materialFitsStructure(next.materialCode, next.structureCode)) next.materialCode = defaultMaterialFor(next.structureCode);
      const nextModel = tryGenerateDieline(next.structureCode, next.dims, { thicknessMm: BOARD_SPECS[next.materialCode].thicknessMm });
      if (!nextModel) return;
      const { doc: rescaled, removed } = rescaleArtwork(next, faceSizesOf(modelRef.current?.faces), faceSizesOf(nextModel.faces));
      commit(rescaled);
      if (removed) toast.show(t("designer.box.removedLayers", { count: removed }));
      if (patch.structureCode && patch.structureCode !== cur.structureCode) setUrl(designIdRef.current, patch.structureCode);
    },
    [commit, setUrl, t, toast],
  );

  const onStructure = (code: StructureCode) => {
    const presets = presetsByCode[code] ?? FALLBACK_PRESETS[code];
    const dims = presets.find((p) => p.standard)?.dims ?? presets[0]?.dims;
    changeGeometry({ structureCode: code, dims: dims ? { ...dims } : undefined });
  };

  const onLayerChange = useCallback(
    (layer: ArtworkLayer, coalesce?: string) => commit(updateLayer(docRef.current, layer.id, () => fitTextBox(layer)), coalesce),
    [commit],
  );

  const add = (layer: ArtworkLayer) => {
    if (layerCount(docRef.current) >= 60) return;
    commit(addLayer(docRef.current, layer));
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
    } catch {
      setUploadError(t("designer.artwork.uploadError"));
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
    commit(removeLayer(docRef.current, id));
    if (selectedId === id) setSelectedId(null);
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
      if (id) toast.show(t("designer.save.savedToast"));
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
      const blob = await sceneRef.current!.screenshot({ width: px, height: px, background: "#ffffff" });
      downloadBlob(blob, `elba-${slugify(doc.name || STRUCTURE_SLUGS[doc.structureCode])}-${px}.png`);
      setModal(null);
      toast.show(t("designer.export.done"));
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
  const statusText =
    saveState === "saving"
      ? t("designer.save.saving")
      : saveState === "saved"
        ? user
          ? t("designer.save.savedAccount")
          : t("designer.save.savedLocal")
        : saveState === "error"
          ? t("designer.save.failed")
          : saveState === "dirty"
            ? t("designer.save.unsaved")
            : "";

  const panelLabels = useMemo(() => {
    const out: Record<string, string> = { glue: t("designer.view.glue") };
    for (const f of FACE_IDS) out[f] = t(`designer.faces.${f}` as DictKey);
    return out;
  }, [t]);

  const tabs = [
    { id: "box", content: t("designer.tabs.box") },
    { id: "artwork", content: t("designer.tabs.artwork") },
    { id: "layers", content: t("designer.tabs.layers") },
    { id: "check", content: t("designer.tabs.check"), badge: summary.errors + summary.warnings || undefined },
  ];

  const faceOptions = FACE_IDS.filter((f) => faces[f]).map((f) => ({ value: f, label: t(`designer.faces.${f}` as DictKey) }));
  const structureName = t(`structures.${doc.structureCode}` as DictKey);

  return (
    <div className={styles.editor} data-sheet={sheetOpen ? "open" : "closed"}>
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
            placeholder={t("designer.untitled")}
            value={doc.name}
            onChange={(v) => commit({ ...docRef.current, name: v }, "name")}
            onBlur={seal}
          />
        </div>
        <ButtonGroup variant="segmented" accessibilityLabel={t("designer.history.undo")}>
          <Button icon={Undo2} accessibilityLabel={t("designer.history.undo")} disabled={!canUndo(hist)} onClick={() => dispatch({ type: "undo" })} />
          <Button icon={Redo2} accessibilityLabel={t("designer.history.redo")} disabled={!canRedo(hist)} onClick={() => dispatch({ type: "redo" })} />
        </ButtonGroup>
        <span className={styles.saveStatus} role="status" data-testid="save-status">
          {saveState === "error" ? <CloudOff size={16} aria-hidden /> : saveState === "saved" ? <CloudCheck size={16} aria-hidden /> : null}
          <span className={styles.saveStatusText}>{statusText}</span>
        </span>
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
              ]}
            />
          </Popover>
        </div>
        <Button variant="primary" onClick={doOrder} loading={ordering}>
          {t("designer.order.button")}
        </Button>
      </div>

      <div className={styles.priceRow}>
        <PriceBadge state={price} onClick={openPrice} />
      </div>

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
              <Select labelInline label={t("designer.artwork.face")} size="slim" value={face} options={faceOptions} onChange={(v) => pickFace(v as FaceId)} />
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
              <div className={styles.sceneWrap} data-active={view === "3d"} aria-hidden={view !== "3d"}>
                <Scene3D
                  model={model}
                  material={doc.materialCode}
                  finish={doc.finishCode}
                  foldProgress={fold}
                  canvases={canvases}
                  version={version}
                  printInside={bothSides}
                  handleRef={sceneRef}
                  ariaLabel={t("viewer.label")}
                  roleDescription={t("viewer.roleDescription")}
                  keyboardHint={t("viewer.keyboardHint")}
                  fallback={t("viewer.unsupported")}
                />
                <div className={styles.viewControls}>
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
                </div>
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
                  label={t("designer.view.faceEditorLabel", { face: t(`designer.faces.${face}` as DictKey) })}
                  hint={t("designer.view.faceEditorHint")}
                />
              ) : null}
              {view === "dieline" ? (
                <DielineView
                  model={model}
                  source={canvases ? canvases[surface] : null}
                  version={version}
                  label={t("designer.view.dielineLabel")}
                  legend={t("designer.view.dielineLegend")}
                  panelLabels={panelLabels}
                />
              ) : null}
            </>
          ) : (
            <div className={styles.sceneLoading}>
              <Spinner size="large" accessibilityLabel={t("designer.view.loading")} />
            </div>
          )}
        </div>

        {view === "3d" ? (
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
                {t("designer.view.closed")}
              </Button>
            </ButtonGroup>
          </div>
        ) : null}
      </section>

      {/* ── side panel / bottom sheet ── */}
      <aside className={styles.panel} aria-label={t("designer.tabs.label")}>
        <button type="button" className={styles.sheetToggle} aria-expanded={sheetOpen} onClick={() => setSheetOpen((o) => !o)}>
          {sheetOpen ? <ChevronDown size={20} aria-hidden /> : <ChevronUp size={20} aria-hidden />}
          <span>{sheetOpen ? t("designer.sheet.collapse") : t("designer.sheet.expand")}</span>
        </button>
        <div className={styles.panelInner}>
          <Tabs tabs={tabs} selected={tab} onSelect={setTab} fitted accessibilityLabel={t("designer.tabs.label")}>
            <div className={styles.panelBody} data-tab={TAB_IDS[tab]}>
              {tab === 0 ? (
                <BoxPanel
                  doc={doc}
                  presets={presetsByCode[doc.structureCode] ?? FALLBACK_PRESETS[doc.structureCode]}
                  closedOuter={model?.closedOuter ?? null}
                  onStructure={onStructure}
                  onDims={(dims: Dims) => changeGeometry({ dims })}
                  onMaterial={(m) => changeGeometry({ materialCode: m })}
                  onFinish={(f) => commit({ ...docRef.current, finishCode: f })}
                  onPrintSides={(p) => commit({ ...docRef.current, printSides: p })}
                />
              ) : tab === 1 ? (
                <ArtworkPanel
                  faces={faces}
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
                  onUploadRejected={() => setUploadError(t("designer.artwork.uploadError"))}
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
                />
              ) : tab === 2 ? (
                <LayersPanel doc={doc} faces={faces} issues={issues} selectedId={selectedId} onSelect={(id, f, s) => goToLayer(id, f, s)} />
              ) : (
                <PreflightPanel issues={issues} summary={summary} layers={allLayers(doc)} onShow={(id, f) => goToLayer(id, f)} />
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
      <ExportModal open={modal === "export"} onClose={() => setModal(null)} onExport={exportPng} busy={exporting} />
      <ShareModal open={modal === "share"} onClose={() => setModal(null)} url={shareUrl} error={shareError} />
    </div>
  );
}
