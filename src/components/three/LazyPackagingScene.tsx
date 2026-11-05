"use client";

import dynamic from "next/dynamic";
import styles from "./PackagingScene.module.css";

/**
 * Code-split, client-only PackagingScene: three.js loads only when a 3D view is shown.
 * Same props as PackagingScene (use `handleRef`, not `ref`).
 */
export const PackagingSceneLazy = dynamic(() => import("./PackagingScene").then((m) => m.PackagingScene), {
  ssr: false,
  loading: () => <div className={styles.viewport} aria-busy="true" />,
});
