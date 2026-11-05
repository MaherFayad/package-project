"use client";

import dynamic from "next/dynamic";
import { useMemo, useRef, useState } from "react";
import type { DesignDoc } from "@/types";
import { BOARD_SPECS, tryGenerateDieline } from "@/lib/dieline";
import { ViewControls, type PackagingSceneHandle } from "@/components/three";
import { useI18n } from "@/i18n/client";
import { Button, ButtonGroup, Spinner } from "@/components/ui";
import { useArtworkCanvases } from "./useArtworkCanvases";
import styles from "./designer.module.css";

const Scene3D = dynamic(() => import("./Scene3D"), {
  ssr: false,
  loading: () => (
    <div className={styles.sceneLoading}>
      <Spinner size="large" decorative />
    </div>
  ),
});

/** Read-only 3D view of a shared design (rotate, zoom, fold; no editing). */
export function SharedViewer({ doc }: { doc: DesignDoc }) {
  const { t } = useI18n();
  const ref = useRef<PackagingSceneHandle | null>(null);
  const [fold, setFold] = useState(1);
  const model = useMemo(
    () => tryGenerateDieline(doc.structureCode, doc.dims, { thicknessMm: BOARD_SPECS[doc.materialCode].thicknessMm }),
    [doc.structureCode, doc.dims, doc.materialCode],
  );
  const both = doc.printSides === "BOTH";
  const { canvases, version } = useArtworkCanvases(model, doc.artwork, doc.materialCode, both);
  if (!model) return null;
  return (
    <div className={styles.stage}>
      <div className={styles.sharedViewer}>
        <Scene3D
          model={model}
          material={doc.materialCode}
          finish={doc.finishCode}
          foldProgress={fold}
          canvases={canvases}
          version={version}
          printInside={both}
          handleRef={ref}
          ariaLabel={t("viewer.label")}
          roleDescription={t("viewer.roleDescription")}
          keyboardHint={t("viewer.keyboardHint")}
          fallback={t("viewer.unsupported")}
        />
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
