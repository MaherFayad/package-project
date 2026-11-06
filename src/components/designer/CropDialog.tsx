"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { ImageCrop } from "@/types";
import { useI18n } from "@/i18n/client";
import { formatNumber } from "@/lib/format";
import { BlockStack, InlineGrid } from "@/components/ui/Stack";
import { Button, ButtonGroup } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Text } from "@/components/ui/Text";
import { NumberField } from "./fields";
import styles from "./designer.module.css";

type Shape = "face" | "square" | "original" | "free";
const FULL: ImageCrop = { x: 0, y: 0, width: 1, height: 1 };
const MIN = 0.05;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/**
 * Keep a crop inside the image and, for a locked shape, at its aspect (`aspect` is width / height
 * in mm, i.e. in image pixels: (w * iw) / (h * ih)). Resizing keeps the top-left corner.
 */
export function fitCrop(c: ImageCrop, aspect: number | null, iw: number, ih: number): ImageCrop {
  let w = clamp(c.width, MIN, 1);
  let h = clamp(c.height, MIN, 1);
  if (aspect) {
    // Height in image fraction that gives this width the aspect.
    h = (w * iw) / (aspect * ih);
    if (h > 1) {
      h = 1;
      w = (aspect * ih) / iw;
    }
    if (w > 1) {
      w = 1;
      h = iw / (aspect * ih);
    }
  }
  const x = clamp(c.x, 0, 1 - w);
  const y = clamp(c.y, 0, 1 - h);
  return { x, y, width: w, height: h };
}

/** The largest centred crop with the given aspect. */
export function centredCrop(aspect: number, iw: number, ih: number): ImageCrop {
  const c = fitCrop({ x: 0, y: 0, width: 1, height: 1 }, aspect, iw, ih);
  return { ...c, x: (1 - c.width) / 2, y: (1 - c.height) / 2 };
}

/**
 * Crop step for a placed image (integrator decision). Non-destructive: the layer keeps the whole
 * image and stores the crop rectangle. Dragging is optional (WCAG 2.5.7): the frame moves with the
 * arrow keys (Shift resizes) and the four numeric fields set it exactly.
 */
export function CropDialog({
  open,
  src,
  pxWidth,
  pxHeight,
  crop,
  faceAspect,
  onClose,
  onApply,
}: {
  open: boolean;
  src: string;
  pxWidth: number;
  pxHeight: number;
  crop: ImageCrop | undefined;
  /** Width / height of the panel the image sits on. */
  faceAspect: number | null;
  onClose: () => void;
  onApply: (crop: ImageCrop | undefined) => void;
}) {
  const { t, locale } = useI18n();
  const iw = Math.max(1, pxWidth);
  const ih = Math.max(1, pxHeight);
  const [shape, setShape] = useState<Shape>("free");
  const [c, setC] = useState<ImageCrop>(crop ?? FULL);
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: "move" | "resize"; sx: number; sy: number; start: ImageCrop } | null>(null);

  useEffect(() => {
    if (!open) return;
    setC(crop ?? FULL);
    setShape("free");
  }, [open, crop]);

  const aspectOf = (s: Shape): number | null => (s === "face" ? faceAspect : s === "square" ? 1 : s === "original" ? iw / ih : null);
  const aspect = aspectOf(shape);
  const update = (next: ImageCrop) => setC(fitCrop(next, aspect, iw, ih));
  const pick = (s: Shape) => {
    setShape(s);
    const a = aspectOf(s);
    if (a) setC(centredCrop(a, iw, ih));
  };

  const onKey = (e: KeyboardEvent) => {
    const step = 0.01 * (e.altKey ? 0.2 : 1);
    const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const v = d[e.key];
    if (!v) return;
    e.preventDefault();
    if (e.shiftKey) update({ ...c, width: c.width + v[0] * 5, height: c.height + v[1] * 5 });
    else update({ ...c, x: c.x + v[0] * 5, y: c.y + v[1] * 5 });
  };

  const onDown = (mode: "move" | "resize") => (e: PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { mode, sx: e.clientX, sy: e.clientY, start: c };
  };
  const onMove = (e: PointerEvent) => {
    const g = drag.current;
    const box = boxRef.current?.getBoundingClientRect();
    if (!g || !box) return;
    const dx = (e.clientX - g.sx) / box.width;
    const dy = (e.clientY - g.sy) / box.height;
    if (g.mode === "move") update({ ...g.start, x: g.start.x + dx, y: g.start.y + dy });
    else update({ ...g.start, width: g.start.width + dx, height: g.start.height + dy });
  };
  const onUp = () => {
    drag.current = null;
  };

  const pct = (v: number) => Math.round(v * 1000) / 10;
  const shown = { w: Math.round(c.width * iw), h: Math.round(c.height * ih) };
  const whole = c.x === 0 && c.y === 0 && c.width >= 0.999 && c.height >= 0.999;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("designer.crop.heading")}
      primaryAction={{ content: t("designer.crop.apply"), onAction: () => onApply(whole ? undefined : c) }}
      secondaryActions={[
        ...(crop ? [{ content: t("designer.crop.reset"), onAction: () => onApply(undefined) }] : []),
        { content: t("common.cancel"), onAction: onClose },
      ]}
    >
      <BlockStack gap="400">
        <Text as="p" tone="subdued">
          {t("designer.crop.intro")}
        </Text>
        <div>
          <Text as="p" variant="bodySm" fontWeight="semibold">
            {t("designer.crop.shape")}
          </Text>
          <ButtonGroup variant="segmented" accessibilityLabel={t("designer.crop.shape")}>
            {(["face", "square", "original", "free"] as const)
              .filter((s) => s !== "face" || faceAspect)
              .map((s) => (
                <Button key={s} size="slim" pressed={shape === s} onClick={() => pick(s)}>
                  {t(`designer.crop.${s}`)}
                </Button>
              ))}
          </ButtonGroup>
        </div>
        {/* The image is never mirrored in RTL; the frame works in image coordinates. */}
        <div className={styles.cropStage} dir="ltr" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <div ref={boxRef} className={styles.cropImage} style={{ aspectRatio: `${iw} / ${ih}` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" draggable={false} />
            <div
              className={styles.cropFrame}
              style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%`, width: `${c.width * 100}%`, height: `${c.height * 100}%` }}
              role="group"
              tabIndex={0}
              aria-label={t("designer.crop.frame")}
              aria-describedby="crop-size"
              onKeyDown={onKey}
              onPointerDown={onDown("move")}
              data-testid="crop-frame"
            >
              <span className={styles.cropCorner} aria-label={t("designer.crop.corner")} role="img" onPointerDown={onDown("resize")} />
            </div>
          </div>
        </div>
        <Text as="p" variant="bodySm" tone="subdued" id="crop-size">
          <span aria-live="polite">{t("designer.crop.applied", { w: formatNumber(shown.w), h: formatNumber(shown.h) })}</span>
        </Text>
        <InlineGrid columns={locale === "ar" ? 2 : 4} gap="200">
          <NumberField label={t("designer.crop.left")} value={pct(c.x)} min={0} max={95} onCommit={(n) => update({ ...c, x: n / 100 })} />
          <NumberField label={t("designer.crop.top")} value={pct(c.y)} min={0} max={95} onCommit={(n) => update({ ...c, y: n / 100 })} />
          <NumberField label={t("designer.crop.width")} value={pct(c.width)} min={5} max={100} onCommit={(n) => update({ ...c, width: n / 100 })} />
          <NumberField label={t("designer.crop.height")} value={pct(c.height)} min={5} max={100} onCommit={(n) => update({ ...c, height: n / 100 })} />
        </InlineGrid>
      </BlockStack>
    </Modal>
  );
}
