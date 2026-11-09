"use client";

import type { ImageLayer, ImagePlace } from "@/types";
import { useI18n } from "@/i18n/client";
import { Button, ButtonGroup } from "@/components/ui/Button";
import { RangeSlider } from "@/components/ui/RangeSlider";
import { Text } from "@/components/ui/Text";
import styles from "./designer.module.css";

/** What DesignerApp gives the panels for an image on a side (designer: image fit). */
export interface ImagePlaceApi {
  /** A Fit image's size as a share (0.1..1) of the biggest fit; null when it is not Fit. */
  scaleOf: (layer: ImageLayer) => number | null;
  set: (layer: ImageLayer, mode: ImagePlace, scale?: number) => void;
}

/** The one control for an image on a side: Fill side / Fit whole image, and a size for Fit. */
export function ImagePlaceControl({ layer, api }: { layer: ImageLayer; api: ImagePlaceApi }) {
  const { t } = useI18n();
  const scale = api.scaleOf(layer);
  return (
    <div className={styles.imagePlace} data-testid="image-place" data-place={layer.place ?? "free"}>
      <ButtonGroup variant="segmented" fullWidth accessibilityLabel={t("designer.layer.imagePlace")}>
        {(["fill", "fit"] as const).map((m) => (
          <Button key={m} pressed={layer.place === m} onClick={() => api.set(layer, m)}>
            {t(m === "fill" ? "designer.layer.placeFill" : "designer.layer.placeFit")}
          </Button>
        ))}
      </ButtonGroup>
      {layer.place ? (
        <Text as="p" variant="bodySm" tone="subdued">
          {t(layer.place === "fill" ? "designer.layer.placeFillNote" : "designer.layer.placeFitNote")}
        </Text>
      ) : null}
      {scale !== null ? (
        <RangeSlider
          label={t("designer.simple.size")}
          min={10}
          max={100}
          step={5}
          value={Math.round(scale * 20) * 5}
          output
          formatValue={(v) => t("designer.layer.placeFitSize", { pct: v })}
          onChange={(v) => api.set(layer, "fit", v / 100)}
        />
      ) : null}
    </div>
  );
}
