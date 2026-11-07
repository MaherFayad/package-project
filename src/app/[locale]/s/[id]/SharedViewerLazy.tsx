"use client";

import { lazy, Suspense, useEffect, useState, type ComponentProps } from "react";
import type { SharedViewer as Viewer } from "@/components/designer/SharedViewer";
import styles from "./share.module.css";

type Props = ComponentProps<typeof Viewer>;

// The viewer pulls the model library, dieline engine and three.js; keep them out of the page's
// first-load JS so the name, specs and "Order this box" render at once (PERF-03).
const SharedViewer = lazy(() => import("@/components/designer/SharedViewer").then((m) => ({ default: m.SharedViewer })));

/**
 * Server-rendered placeholder with the model poster, so the box is visible (and is the LCP)
 * before the 3D chunk arrives on a slow phone (R2-08). Same footprint as the viewer: no shift.
 */
function Placeholder({ poster }: { poster?: string }) {
  return (
    <div aria-hidden="true">
      <div className={styles.viewerSkeleton}>
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.viewerPoster} src={poster} alt="" fetchPriority="high" decoding="async" />
        ) : null}
      </div>
      {/* The viewer's fold-state row (designer .foldRow) sits under the stage; reserve it too. */}
      <div className={styles.foldRowSpace} />
    </div>
  );
}

export function SharedViewerLazy(props: Props) {
  // Client only (WebGL): the server and the first client render show the placeholder.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const placeholder = <Placeholder poster={props.poster} />;
  if (!mounted) return placeholder;
  return (
    <Suspense fallback={placeholder}>
      <SharedViewer {...props} />
    </Suspense>
  );
}
