"use client";

import { DesignScene } from "@/components/designer/DesignScene";
import { useMemo, useRef, useState } from "react";
import type { DesignDoc } from "@/types";
import { docGeometry } from "@/lib/library/doc";
import { ViewControls, type PackagingSceneHandle } from "@/components/three";
import { useI18n } from "@/i18n/client";
import { Button, ButtonGroup } from "@/components/ui";
import { useArtworkCanvases } from "./useArtworkCanvases";
import styles from "./designer.module.css";


/** Read-only 3D view of a shared design (rotate, zoom, fold; no editing). */
export function SharedViewer({ doc }: { doc: DesignDoc }) {
  const { t } = useI18n();
  const ref = useRef<PackagingSceneHandle | null>(null);
  const [fold, setFold] = useState(1);
  // Box dieline or container print sheet (src/lib/library/doc).
  const geo = useMemo(() => docGeometry(doc), [doc]);
  const model = geo?.dieline ?? null;
  const both = doc.printSides === "BOTH";
  const { canvases, version } = useArtworkCanvases(model, doc.artwork, doc.materialCode, both);
  if (!model) return null;
  return (
    <div className={styles.stage}>
      <div className={styles.sharedViewer}>
        {geo ? <DesignScene doc={doc} geo={geo} canvases={canvases} version={version} fold={fold} handleRef={ref} /> : null}
        <div className={styles.viewControls}>
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
        </div>
      </div>
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
    </div>
  );
}
