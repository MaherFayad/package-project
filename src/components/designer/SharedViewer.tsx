"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import type { DesignDoc } from "@/types";
import type { PackagingSceneHandle } from "@/components/three";
import { ViewControls } from "@/components/three/ViewControls";
import { useI18n } from "@/i18n/client";
import { Button, ButtonGroup } from "@/components/ui/Button";
import styles from "./designer.module.css";
import lib from "./library.module.css";

const SharedScene = dynamic(() => import("./SharedScene"), { ssr: false, loading: () => <div className={lib.stageSkeleton} aria-hidden="true" /> });

/**
 * Read-only 3D view of a shared design (rotate, zoom, fold; no editing). The page paints with the
 * model's thumbnail; the 3D view (library + three.js) is a lazy chunk (PERF-04).
 */
export function SharedViewer({ doc, poster }: { doc: DesignDoc; poster?: string }) {
  const { t } = useI18n();
  const ref = useRef<PackagingSceneHandle | null>(null);
  const [fold, setFold] = useState(1);
  const [openTop, setOpenTop] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const onMounted = useCallback((v: boolean) => {
    setOpenTop(v);
    setLoaded(true);
  }, []);
  return (
    <div className={styles.stage}>
      <div className={styles.sharedViewer}>
        <SharedScene
          doc={doc}
          fold={fold}
          handleRef={ref}
          onOpenTop={onMounted}
        />
        {/* The model's thumbnail until the 3D chunk has mounted (it then cross-fades itself). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {poster ? <img src={poster} alt="" aria-hidden="true" className={styles.stagePoster} data-hidden={loaded ? "true" : undefined} /> : null}
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
            {openTop ? t("designer.view.assembled") : t("designer.view.closed")}
          </Button>
        </ButtonGroup>
      </div>
    </div>
  );
}
