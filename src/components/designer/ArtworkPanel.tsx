"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BringToFront,
  Circle,
  Copy,
  Eye,
  EyeOff,
  Minus,
  Plus,
  RotateCcw,
  RotateCw,
  SendToBack,
  Square,
  Trash2,
  Type,
} from "lucide-react";
import type { ArtworkLayer, DesignFinishCode, FaceId, PrintSurface, TextLayer } from "@/types";
import { FACE_IDS } from "@/types";
import type { FaceInfo } from "@/lib/dieline";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n/types";
import { Banner, BlockStack, Button, ButtonGroup, Checkbox, Divider, DropZone, InlineGrid, InlineStack, Select, Text, TextField } from "@/components/ui";
import { MAX_LAYERS } from "./lib/doc";
import { normAngle, round1, scaleLayer, type Placement } from "./lib/geometry";
import { layerName } from "./lib/describe";
import { IMAGE_ACCEPT, IMAGE_MAX_BYTES } from "./uploadImage";
import { ColorField, NumberField } from "./fields";
import styles from "./designer.module.css";
import lib from "./library.module.css";

export interface ArtworkPanelProps {
  faces: Partial<Record<FaceId, FaceInfo>>;
  faceLabel?: (f: FaceId) => string;
  face: FaceId;
  surface: PrintSurface;
  bothSides: boolean;
  background: string | null;
  selected: ArtworkLayer | null;
  layerTotal: number;
  uploading: boolean;
  uploadError: string | null;
  onFace: (f: FaceId) => void;
  onSurface: (s: PrintSurface) => void;
  onBackground: (c: string | null) => void;
  onUpload: (file: File) => void;
  /** The drop zone refused the file: its size or its type (R10-02, specific message). */
  onUploadRejected: (reason: "size" | "type") => void;
  onAddText: () => void;
  onAddShape: (shape: "rect" | "ellipse") => void;
  onLayer: (layer: ArtworkLayer, coalesce?: string) => void;
  onSeal: () => void;
  onPlace: (where: Placement) => void;
  onReorder: (delta: 1 | -1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  /** Masked finishes on the design (spot UV, foil, emboss) and whether the selected item carries each (FN-02). */
  layerFinishes?: { code: DesignFinishCode; name: string; on: boolean }[];
  onLayerFinish?: (code: DesignFinishCode, on: boolean) => void;
}

export function ArtworkPanel(p: ArtworkPanelProps) {
  const { t } = useI18n();
  const full = p.layerTotal >= MAX_LAYERS;
  const faceOptions = FACE_IDS.filter((f) => p.faces[f]).map((f) => ({ value: f, label: p.faceLabel ? p.faceLabel(f) : t(`designer.faces.${f}` as DictKey) }));

  return (
    <BlockStack gap="400">
      <InlineGrid columns={p.bothSides ? { xs: 1, sm: 2 } : 1} gap="300">
        <Select label={t("designer.artwork.face")} value={p.face} options={faceOptions} onChange={(v) => p.onFace(v as FaceId)} />
        {p.bothSides ? (
          <Select
            label={t("designer.artwork.surface")}
            value={p.surface}
            options={[
              { value: "outside", label: t("designer.view.outside") },
              { value: "inside", label: t("designer.view.inside") },
            ]}
            onChange={(v) => p.onSurface(v as PrintSurface)}
          />
        ) : null}
      </InlineGrid>

      <ColorField
        label={t("designer.artwork.background")}
        value={p.background}
        onChange={p.onBackground}
        allowNone
        noneLabel={t("designer.artwork.noBackground")}
        helpText={t("designer.artwork.backgroundHelp")}
      />

      <DropZone
        label={t("designer.artwork.upload")}
        accept={IMAGE_ACCEPT}
        maxSize={IMAGE_MAX_BYTES}
        allowMultiple={false}
        disabled={full || p.uploading}
        actionTitle={p.uploading ? t("designer.artwork.uploading") : t("designer.artwork.uploadAction")}
        actionHint={t("designer.artwork.uploadHint")}
        error={p.uploadError ?? undefined}
        onDrop={(_all, accepted, rejected) => {
          if (accepted[0]) p.onUpload(accepted[0]);
          else if (rejected.length) p.onUploadRejected(rejected[0].reason);
        }}
      />

      <InlineStack gap="200" wrap>
        <Button icon={Type} onClick={p.onAddText} disabled={full}>
          {t("designer.artwork.addText")}
        </Button>
        <Button icon={Square} onClick={() => p.onAddShape("rect")} disabled={full}>
          {t("designer.artwork.rect")}
        </Button>
        <Button icon={Circle} onClick={() => p.onAddShape("ellipse")} disabled={full}>
          {t("designer.artwork.ellipse")}
        </Button>
      </InlineStack>
      {full ? (
        <Banner tone="warning" inCard>
          {t("designer.artwork.tooManyLayers", { max: MAX_LAYERS })}
        </Banner>
      ) : null}

      <Divider />
      {p.selected ? (
        <LayerInspector {...p} layer={p.selected} />
      ) : (
        <Text as="p" tone="subdued">
          {t("designer.artwork.noSelection")}
        </Text>
      )}
    </BlockStack>
  );
}

function LayerInspector({ layer, onLayer, onSeal, onPlace, onReorder, onDuplicate, onDelete, layerFinishes, onLayerFinish }: ArtworkPanelProps & { layer: ArtworkLayer }) {
  const { t } = useI18n();
  const set = (patch: Partial<ArtworkLayer>, key?: string) => onLayer({ ...layer, ...patch } as ArtworkLayer, key);
  const nudge = (dx: number, dy: number) => set({ x: round1(layer.x + dx), y: round1(layer.y + dy) }, `nudge:${layer.id}`);

  return (
    <section aria-labelledby={`insp-${layer.id}`} className={styles.inspector} onBlur={onSeal}>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center" gap="200">
          <Text as="h2" variant="headingSm" id={`insp-${layer.id}`}>
            {t("designer.artwork.selected")}: {layerName(layer, t)}
          </Text>
        </InlineStack>

        {layer.kind === "text" ? <TextControls layer={layer} set={set} /> : null}
        {layer.kind === "shape" ? (
          <ColorField label={t("designer.layer.fill")} value={layer.fill} onChange={(c) => set({ fill: c } as Partial<ArtworkLayer>)} />
        ) : null}

        {layerFinishes?.length && layer.surface === "outside" ? (
          <fieldset className={lib.group} data-testid="layer-finishes">
            <legend className={lib.groupTitle}>{t("designer.layer.finishes")}</legend>
            <BlockStack gap="100">
              {layerFinishes.map((f) => (
                <Checkbox key={f.code} label={f.name} checked={f.on} onChange={(on) => onLayerFinish?.(f.code, on)} />
              ))}
            </BlockStack>
          </fieldset>
        ) : null}

        <BlockStack gap="200">
          <Text as="h3" variant="headingXs">
            {t("designer.layer.move")}
          </Text>
          <div className={styles.nudgePad} dir="ltr">
            <span />
            <Button icon={ArrowUp} accessibilityLabel={t("designer.layer.nudgeUp")} onClick={() => nudge(0, -1)} />
            <span />
            <Button icon={ArrowLeft} accessibilityLabel={t("designer.layer.nudgeLeft")} onClick={() => nudge(-1, 0)} />
            <span />
            <Button icon={ArrowRight} accessibilityLabel={t("designer.layer.nudgeRight")} onClick={() => nudge(1, 0)} />
            <span />
            <Button icon={ArrowDown} accessibilityLabel={t("designer.layer.nudgeDown")} onClick={() => nudge(0, 1)} />
            <span />
          </div>
          <InlineStack gap="200" wrap>
            <Button icon={Plus} onClick={() => onLayer(scaleLayer(layer, 1.1), `scale:${layer.id}`)}>
              {t("designer.layer.bigger")}
            </Button>
            <Button icon={Minus} onClick={() => onLayer(scaleLayer(layer, 1 / 1.1), `scale:${layer.id}`)}>
              {t("designer.layer.smaller")}
            </Button>
            <Button icon={RotateCcw} accessibilityLabel={t("designer.layer.rotateLeft")} onClick={() => set({ rotation: normAngle(layer.rotation - 15) }, `rot:${layer.id}`)} />
            <Button icon={RotateCw} accessibilityLabel={t("designer.layer.rotateRight")} onClick={() => set({ rotation: normAngle(layer.rotation + 15) }, `rot:${layer.id}`)} />
          </InlineStack>
        </BlockStack>

        <BlockStack gap="200">
          <Text as="h3" variant="headingXs">
            {t("designer.layer.placement")}
          </Text>
          <div className={styles.presetRow} role="group" aria-label={t("designer.layer.placement")}>
            {(["center", "top", "bottom", "topStart", "topEnd", "fill"] as const).map((w) => (
              <Button key={w} size="slim" onClick={() => onPlace(w)}>
                {t(`designer.layer.place.${w}` as DictKey)}
              </Button>
            ))}
          </div>
        </BlockStack>

        <BlockStack gap="200">
          <Text as="h3" variant="headingXs">
            {t("designer.layer.position")}
          </Text>
          <InlineGrid columns={2} gap="200">
            <NumberField label={t("designer.layer.x")} value={layer.x} min={-5000} max={5000} onCommit={(n) => set({ x: n }, `x:${layer.id}`)} />
            <NumberField label={t("designer.layer.y")} value={layer.y} min={-5000} max={5000} onCommit={(n) => set({ y: n }, `y:${layer.id}`)} />
            <NumberField
              label={t("designer.layer.w")}
              value={layer.width}
              min={1}
              max={5000}
              onCommit={(n) => onLayer(scaleLayer(layer, n / layer.width), `w:${layer.id}`)}
            />
            <NumberField
              label={t("designer.layer.h")}
              value={layer.height}
              min={1}
              max={5000}
              onCommit={(n) => onLayer(scaleLayer(layer, n / layer.height), `h:${layer.id}`)}
            />
            <NumberField label={t("designer.layer.rotation")} value={layer.rotation} min={-360} max={360} onCommit={(n) => set({ rotation: normAngle(n) }, `r:${layer.id}`)} />
            <NumberField
              label={t("designer.layer.opacity")}
              value={Math.round((layer.opacity ?? 1) * 100)}
              decimals={0}
              min={0}
              max={100}
              onCommit={(n) => set({ opacity: n / 100 }, `o:${layer.id}`)}
            />
          </InlineGrid>
        </BlockStack>

        <InlineStack gap="200" wrap>
          <Button icon={BringToFront} onClick={() => onReorder(1)}>
            {t("designer.layer.forward")}
          </Button>
          <Button icon={SendToBack} onClick={() => onReorder(-1)}>
            {t("designer.layer.backward")}
          </Button>
          <Button icon={Copy} onClick={onDuplicate}>
            {t("designer.layer.duplicate")}
          </Button>
          <Button icon={layer.hidden ? Eye : EyeOff} onClick={() => set({ hidden: !layer.hidden })}>
            {layer.hidden ? t("designer.layer.show") : t("designer.layer.hide")}
          </Button>
          <Button icon={Trash2} tone="critical" onClick={onDelete}>
            {t("designer.layer.delete")}
          </Button>
        </InlineStack>
      </BlockStack>
    </section>
  );
}

function TextControls({ layer, set }: { layer: TextLayer; set: (p: Partial<TextLayer>, key?: string) => void }) {
  const { t } = useI18n();
  return (
    <BlockStack gap="300">
      <TextField
        label={t("designer.layer.textValue")}
        autoComplete="off"
        multiline={2}
        maxLength={500}
        value={layer.text}
        dir="auto"
        onChange={(v) => set({ text: v }, `text:${layer.id}`)}
      />
      <InlineGrid columns={2} gap="200">
        <Select
          label={t("designer.layer.font")}
          value={layer.fontFamily}
          options={[
            { value: "IBM Plex Sans Arabic", label: t("designer.layer.fontArabic") },
            { value: "Inter", label: t("designer.layer.fontLatin") },
          ]}
          onChange={(v) => set({ fontFamily: v as TextLayer["fontFamily"] })}
        />
        <NumberField label={t("designer.layer.size")} value={layer.fontSizePt} min={1} max={400} onCommit={(n) => set({ fontSizePt: n }, `fs:${layer.id}`)} />
        <Select
          label={t("designer.layer.weight")}
          value={String(layer.fontWeight)}
          options={[
            { value: "400", label: t("designer.layer.weightRegular") },
            { value: "500", label: t("designer.layer.weightMedium") },
            { value: "600", label: t("designer.layer.weightSemibold") },
            { value: "700", label: t("designer.layer.weightBold") },
          ]}
          onChange={(v) => set({ fontWeight: Number(v) as TextLayer["fontWeight"] })}
        />
        <Select
          label={t("designer.layer.direction")}
          value={layer.direction}
          options={[
            { value: "auto", label: t("designer.layer.dirAuto") },
            { value: "rtl", label: t("designer.layer.dirRtl") },
            { value: "ltr", label: t("designer.layer.dirLtr") },
          ]}
          onChange={(v) => set({ direction: v as TextLayer["direction"] })}
        />
      </InlineGrid>
      <BlockStack gap="100">
        <Text as="span" variant="bodyMd">
          {t("designer.layer.align")}
        </Text>
        <ButtonGroup variant="segmented" accessibilityLabel={t("designer.layer.align")}>
          {(["start", "center", "end"] as const).map((a) => (
            <Button key={a} size="slim" pressed={layer.align === a} onClick={() => set({ align: a })}>
              {t(`designer.layer.align${a === "start" ? "Start" : a === "center" ? "Center" : "End"}` as DictKey)}
            </Button>
          ))}
        </ButtonGroup>
      </BlockStack>
      <ColorField label={t("designer.layer.color")} value={layer.color} onChange={(c) => c && set({ color: c })} />
    </BlockStack>
  );
}
