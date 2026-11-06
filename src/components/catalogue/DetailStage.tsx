"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import type { Locale } from "@/types";
import type { CatalogueRender } from "@/data/catalogue/types";
import { COPY } from "./copy";
import styles from "./catalogue.module.css";

const CatalogueViewer = dynamic(() => import("./CatalogueViewer"), { ssr: false });

/**
 * Detail-page 3D stage: the rendered thumbnail shows at once (no layout shift), the live
 * model loads behind it and cross-fades in when drawn. Orbit by drag or arrow keys.
 */
export function DetailStage({ locale, code, render, source, name }: { locale: Locale; code: string; render: CatalogueRender; source: string; name: string }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  const onError = useCallback(() => setFailed(true), []);
  return (
    <div className={styles.stage} data-testid="catalogue-stage" data-ready={ready ? "true" : undefined}>
      {failed ? null : (
        <div style={{ position: "absolute", inset: 0 }}>
          <CatalogueViewer code={code} render={render} source={source} onReady={onReady} onError={onError} />
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.poster} src={`/models/${encodeURIComponent(code)}.webp`} alt={name} width={480} height={480} data-hidden={ready && !failed ? "true" : undefined} />
      <p className={styles.stageHint} aria-live="polite">
        {ready ? COPY.viewerHint[locale] : failed ? "" : COPY.viewerLoading[locale]}
      </p>
    </div>
  );
}
