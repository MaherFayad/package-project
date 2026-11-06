"use client";

import dynamic from "next/dynamic";
import type { Ref } from "react";
import type { DesignDoc } from "@/types";
import type { DocGeometry } from "@/lib/library/doc";
import type { PackagingSceneHandle } from "@/components/three";
import { useI18n } from "@/i18n/client";
import lib from "./library.module.css";

const StageSkeleton = () => <div className={lib.stageSkeleton} aria-hidden="true" />;
const Scene3D = dynamic(() => import("./Scene3D"), { ssr: false, loading: StageSkeleton });
const VesselView = dynamic(() => import("./VesselView"), { ssr: false, loading: StageSkeleton });

/**
 * Read-only 3D view of ANY design (box dieline or container): share page and proof review.
 * Both renderers are code-split.
 */
export function DesignScene({
  doc,
  geo,
  canvases,
  version,
  images,
  fold,
  handleRef,
}: {
  doc: DesignDoc;
  geo: DocGeometry;
  canvases: { outside: HTMLCanvasElement; inside: HTMLCanvasElement } | null;
  version: number;
  images?: Map<string, CanvasImageSource>;
  fold: number;
  handleRef: Ref<PackagingSceneHandle | null>;
}) {
  const { t, locale } = useI18n();
  const labels = { ariaLabel: t("viewer.label"), roleDescription: t("viewer.roleDescription"), keyboardHint: t("viewer.keyboardHint"), fallback: t("viewer.unsupported") };
  if (geo.vessel && geo.model.kind === "vessel")
    return <VesselView model={geo.model} doc={doc} geo={geo} sheet={canvases?.outside ?? null} version={version} handleRef={handleRef} turntable={false} open={false} {...labels} />;
  return (
    <Scene3D
      model={geo.dieline}
      material={doc.materialCode}
      finish={doc.finishCode}
      finishes={doc.finishes}
      artwork={doc.artwork}
      images={images}
      foldProgress={fold}
      canvases={canvases}
      version={version}
      printInside={doc.printSides === "BOTH"}
      handleRef={handleRef}
      locale={locale}
      {...labels}
    />
  );
}
