"use client";

import dynamic from "next/dynamic";
import { loadEngineStack } from "../lazyLoad";
import styles from "../PackagingScene.module.css";

/** Code-split, client-only VesselScene (three.js loads only when shown). Use `handleRef`. */
export const VesselSceneLazy = dynamic(() => loadEngineStack().then(() => import("./VesselScene")).then((m) => m.VesselScene), {
  ssr: false,
  loading: () => <div className={styles.viewport} aria-busy="true" />,
});
