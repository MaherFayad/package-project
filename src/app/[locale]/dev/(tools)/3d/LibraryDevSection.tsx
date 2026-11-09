"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FACE_IDS, type DesignDoc, type DesignFinishCode, type FaceId } from "@/types";
import { MODELS, modelByCode, toCard, type ModelDef } from "@/lib/library";
import { docGeometry, normaliseDocModel } from "@/lib/library/doc";
import { ViewControls, type PackagingSceneHandle } from "@/components/three";
import { useI18n } from "@/i18n/client";
import { Button, ButtonGroup } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { RangeSlider } from "@/components/ui/RangeSlider";
import { Text } from "@/components/ui/Text";
import { ConfigPanel, type ViewOptions } from "@/components/designer/ConfigPanel";
import { ModelBrowser } from "@/components/designer/ModelPicker";
import { DesignScene } from "@/components/designer/DesignScene";
import { createModelDoc, makeTextLayer } from "@/components/designer/lib/doc";
import { pruneFinishes, swapFinish, toggleFinish } from "@/components/designer/lib/config";
import { useArtworkCanvases } from "@/components/designer/useArtworkCanvases";
import designerStyles from "@/components/designer/designer.module.css";
import styles from "./dev3d.module.css";

const CARDS = MODELS.map(toCard);

/** A doc for a model with a sample logo on its main face, so finishes and labels show. */
function sampleDoc(m: ModelDef): DesignDoc {
  const doc = createModelDoc(m, { name: m.name.en });
  const geo = docGeometry(doc);
  const faces = geo?.dieline.faces ?? {};
  const face = (["front", "top", ...FACE_IDS] as FaceId[]).find((f) => faces[f]);
  if (!face) return doc;
  const text = { ...makeTextLayer(face, "outside", faces[face]!, "ELBA"), color: "#1f3d2b", fontWeight: 700 as const };
  return { ...doc, artwork: { ...doc.artwork, outside: { background: "#f2c14e", layers: [text] } } };
}

/**
 * Every library model with ALL its configuration options: the same grouped picker, rules-driven
 * panel and 3D views as the designer, without accounts or saving. Deep link: ?model=<code>.
 */
export function LibraryDevSection() {
  const { t } = useI18n();
  const [doc, setDoc] = useState<DesignDoc>(() => sampleDoc(MODELS[0]));
  const [fold, setFold] = useState(1);
  const [view, setView] = useState<ViewOptions>({ dimensions: true, scene: "none", turntable: false, open: false });
  const ref = useRef<PackagingSceneHandle | null>(null);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("model");
    const m = modelByCode(code);
    if (m) setDoc(sampleDoc(m));
  }, []);

  const geo = useMemo(() => docGeometry(doc), [doc]);
  const model = geo?.model ?? null;
  const { canvases, version, images } = useArtworkCanvases(geo?.dieline ?? null, doc.artwork, doc.materialCode, doc.printSides === "BOTH");

  const pick = (code: string) => {
    const m = modelByCode(code);
    if (!m) return;
    setDoc(sampleDoc(m));
    const url = new URL(window.location.href);
    url.searchParams.set("model", code);
    window.history.replaceState(null, "", url.toString());
  };
  const geometry = (patch: Partial<DesignDoc>) => {
    const next = normaliseDocModel({ ...doc, ...patch });
    if (!docGeometry(next) || !model) return;
    setDoc(pruneFinishes(next, model).doc);
  };

  return (
    <section className={styles.section} aria-labelledby="lib-dev" lang="en" dir="ltr" data-testid="library-dev">
      <Text as="h2" variant="headingLg" id="lib-dev">
        Model library ({MODELS.length} models)
      </Text>
      <Text as="p" tone="subdued">
        Every box style, carton, tray, tube, bottle, jar, can and pouch with all its options. The panel is the designer&apos;s rules-driven panel: disabled
        options show the reason.
      </Text>
      <div className={styles.libraryGrid}>
        <Card>
          <div className={designerStyles.stage} style={{ minHeight: 420, position: "relative" }}>
            <div style={{ position: "relative", height: 420 }} data-testid="stage-3d" data-model={doc.modelCode ?? doc.structureCode}>
              {geo ? <DesignScene doc={doc} geo={geo} canvases={canvases} version={version} images={images} fold={fold} handleRef={ref} /> : null}
            </div>
            <ViewControls
              handle={ref}
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
            {model?.kind === "box" ? (
              <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 200px" }}>
                  <RangeSlider label="Fold" min={0} max={100} step={5} value={Math.round(fold * 100)} onChange={(v) => setFold(v / 100)} output formatValue={(v) => `${v}%`} />
                </div>
                <ButtonGroup variant="segmented" accessibilityLabel="Fold">
                  <Button size="slim" pressed={fold === 0} onClick={() => setFold(0)}>
                    Flat
                  </Button>
                  <Button size="slim" pressed={fold === 1} onClick={() => setFold(1)}>
                    Closed
                  </Button>
                </ButtonGroup>
              </div>
            ) : null}
          </div>
        </Card>
        <Card>
          {model ? (
            <ConfigPanel
              doc={doc}
              model={model}
              geo={geo}
              view={view}
              onView={setView}
              onOpenPicker={() => document.getElementById("lib-browser")?.scrollIntoView({ behavior: "smooth" })}
              onGeometry={geometry}
              onFinish={(code: DesignFinishCode, on: boolean) => setDoc(toggleFinish(doc, code, on))}
              onFinishSwap={(off: DesignFinishCode[], on: DesignFinishCode | null) => setDoc(swapFinish(doc, off, on))}
              onPrintSides={(p) => setDoc({ ...doc, printSides: p })}
            />
          ) : null}
        </Card>
      </div>
      <div id="lib-browser">
        <ModelBrowser inline cards={CARDS} current={doc.modelCode ?? doc.structureCode} onPick={pick} />
      </div>
    </section>
  );
}
