"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { SharedViewer as Viewer } from "@/components/designer/SharedViewer";
import styles from "./share.module.css";

// The viewer pulls the model library, dieline engine and three.js; keep them out of the page's
// first-load JS so the name, specs and "Order this box" render at once (PERF-03).
const SharedViewer = dynamic(() => import("@/components/designer/SharedViewer").then((m) => m.SharedViewer), {
  ssr: false,
  loading: () => <div className={styles.viewerSkeleton} aria-hidden="true" />,
});

export function SharedViewerLazy(props: ComponentProps<typeof Viewer>) {
  return <SharedViewer {...props} />;
}
