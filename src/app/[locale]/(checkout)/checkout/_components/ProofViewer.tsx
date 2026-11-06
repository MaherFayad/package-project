"use client";

import { DesignScene } from "@/components/designer/DesignScene";
import { useMemo, useState, type RefObject } from "react";
import { FACE_IDS, type DesignDoc } from "@/types";
import { docGeometry } from "@/lib/library/doc";
import { ViewControls, type PackagingSceneHandle } from "@/components/three";
import { useArtworkCanvases } from "@/components/designer/useArtworkCanvases";
import { DielineView } from "@/components/designer/DielineView";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n";
import { Button, ButtonGroup, Tabs } from "@/components/ui";
import styles from "./checkout.module.css";


/**
 * Proof review: the 3D render and the flat dieline proof of the exact design snapshot that will
 * be approved. Read-only. Never mirrored in RTL (the stage is dir="ltr").
 */
export function ProofViewer({ doc, handleRef }: { doc: DesignDoc; handleRef: RefObject<PackagingSceneHandle | null> }) {
  const { t } = useI18n();
  const [tab, setTab] = useState(0);
  const [fold, setFold] = useState(1);
  // Box dieline or container print sheet (src/lib/library/doc).
  const geo = useMemo(() => docGeometry(doc), [doc]);
  const model = geo?.dieline ?? null;
  const both = doc.printSides === "BOTH";
  const { canvases, version } = useArtworkCanvases(model, doc.artwork, doc.materialCode, both);
  const panelLabels = useMemo(() => {
    const out: Record<string, string> = { glue: t("designer.view.glue") };
    for (const f of FACE_IDS) out[f] = t(`designer.faces.${f}` as DictKey);
    return out;
  }, [t]);
  if (!model) return null;

  return (
    <div className={styles.proof}>
      <Tabs
        tabs={[
          { id: "proof-3d", content: t("checkout.proof.tab3d") },
          { id: "proof-flat", content: t("checkout.proof.tabFlat") },
        ]}
        selected={tab}
        onSelect={setTab}
        accessibilityLabel={t("checkout.proof.title")}
        fitted
      >
        <div className={styles.stage} dir="ltr">
          {/* The 3D scene stays mounted (hidden on the flat tab) so the approval screenshot works. */}
          <div className={styles.scene} hidden={tab !== 0}>
            {geo ? <DesignScene doc={doc} geo={geo} canvases={canvases} version={version} fold={fold} handleRef={handleRef} /> : null}
            <div className={styles.viewControls}>
              <ViewControls
                className={styles.viewBar}
                handle={handleRef}
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
          {tab === 1 ? (
            <div className={styles.flat}>
              <DielineView
                model={model}
                source={canvases ? canvases.outside : null}
                version={version}
                label={t("checkout.proof.flatLabel")}
                legend={t("checkout.proof.legend")}
                panelLabels={panelLabels}
              />
            </div>
          ) : null}
        </div>
      </Tabs>
      {tab === 0 ? (
        <div className={styles.foldRow}>
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
    </div>
  );
}
