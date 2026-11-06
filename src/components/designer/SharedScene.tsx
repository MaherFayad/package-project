"use client";

import { useEffect, useMemo, type Ref } from "react";
import type { DesignDoc } from "@/types";
import { docGeometry, docModelCode } from "@/lib/library/doc";
import { useLibraryModel } from "@/lib/library/useLibraryModel";
import type { PackagingSceneHandle } from "@/components/three";
import { DesignScene } from "./DesignScene";
import { useArtworkCanvases } from "./useArtworkCanvases";

/**
 * The share page's 3D view. A lazy chunk (PERF-04): the model library, the dieline engine and
 * three.js load after the page has painted, never in the share page's first bundle.
 */
export default function SharedScene({
  doc,
  fold,
  handleRef,
  onOpenTop,
}: {
  doc: DesignDoc;
  fold: number;
  handleRef: Ref<PackagingSceneHandle | null>;
  /** Reports whether the model is an open-top style ("Assembled" instead of "Closed"). */
  onOpenTop?: (openTop: boolean) => void;
}) {
  // Only this design's family pack is fetched (PERF-04); geometry once it is in the registry.
  const ready = useLibraryModel(docModelCode(doc));
  const geo = useMemo(() => (ready ? docGeometry(doc) : null), [doc, ready]);
  const model = geo?.dieline ?? null;
  const both = doc.printSides === "BOTH";
  const { canvases, version } = useArtworkCanvases(model, doc.artwork, doc.materialCode, both, 1024);
  const openTop = !!(geo?.model as { openTop?: boolean } | undefined)?.openTop;
  useEffect(() => onOpenTop?.(openTop), [openTop, onOpenTop]);
  if (!geo) return null;
  return <DesignScene doc={doc} geo={geo} canvases={canvases} version={version} fold={fold} handleRef={handleRef} />;
}
