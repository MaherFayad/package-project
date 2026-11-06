"use client";

import { FACE_IDS, type DesignDoc, type FaceId, type PrintSurface, type PreflightIssue } from "@/types";
import type { FaceInfo } from "@/lib/dieline";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n/types";
import { Badge, BlockStack, Button, Card, Text } from "@/components/ui";
import { describeFace } from "./lib/describe";
import styles from "./designer.module.css";

/**
 * Text alternative to the 3D view (WCAG 1.1.1): every panel with its size and a sentence per
 * item ("Front panel, 250 × 80 mm: Image, 60 × 40 mm, centred"). Each item can be selected.
 */
export function LayersPanel({
  doc,
  faces,
  faceLabel,
  issues,
  selectedId,
  onSelect,
}: {
  doc: DesignDoc;
  faces: Partial<Record<FaceId, FaceInfo>>;
  faceLabel?: (f: FaceId) => string;
  issues: PreflightIssue[];
  selectedId: string | null;
  onSelect: (id: string, face: FaceId, surface: PrintSurface) => void;
}) {
  const { t } = useI18n();
  const surfaces: PrintSurface[] = doc.printSides === "BOTH" ? ["outside", "inside"] : ["outside"];
  return (
    <BlockStack gap="400">
      <BlockStack gap="100">
        <Text as="h2" variant="headingSm">
          {t("designer.layers.heading")}
        </Text>
        <Text as="p" tone="subdued">
          {t("designer.layers.subtitle")}
        </Text>
      </BlockStack>
      {surfaces.map((surface) => (
        <BlockStack key={surface} gap="300">
          {surfaces.length > 1 ? (
            <Text as="h3" variant="headingXs" tone="subdued">
              {surface === "outside" ? t("designer.layers.surfaceOutside") : t("designer.layers.surfaceInside")}
            </Text>
          ) : null}
          {doc.artwork[surface].background ? (
            <Text as="p" variant="bodySm" tone="subdued">
              {t("designer.describe.background", { color: doc.artwork[surface].background! })}
            </Text>
          ) : null}
          <ul className={styles.faceList}>
            {FACE_IDS.filter((f) => faces[f]).map((f) => {
              const info = faces[f]!;
              const d = describeFace(f, surface, info, doc.artwork[surface].layers, t, faceLabel?.(f));
              return (
                <li key={f}>
                  <Card padding="300">
                    <BlockStack gap="200">
                      <Text as="h4" variant="headingSm">
                        {d.heading}
                      </Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        {d.summary}
                      </Text>
                      {d.items.length > 0 && (
                        <ul className={styles.itemList}>
                          {d.items.map((item) => {
                            const errors = issues.filter((i) => i.layerId === item.id && i.severity === "error").length;
                            const warnings = issues.filter((i) => i.layerId === item.id && i.severity === "warning").length;
                            return (
                              <li key={item.id} className={styles.itemRow} aria-current={item.id === selectedId ? "true" : undefined}>
                                <Button variant="plain" textAlign="start" onClick={() => onSelect(item.id, f, surface)}>
                                  {item.text}
                                </Button>
                                {errors > 0 ? (
                                  <Badge tone="critical" size="small" progress="incomplete">
                                    {t("designer.check.errors", { count: errors })}
                                  </Badge>
                                ) : warnings > 0 ? (
                                  <Badge tone="warning" size="small" progress="partiallyComplete">
                                    {t("designer.check.warnings", { count: warnings })}
                                  </Badge>
                                ) : null}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </BlockStack>
                  </Card>
                </li>
              );
            })}
          </ul>
          {doc.artwork[surface].layers
            .filter((l) => !faces[l.face])
            .map((l) => (
              <Text key={l.id} as="p" variant="bodySm" tone="subdued">
                {faceLabel ? faceLabel(l.face) : t(`designer.faces.${l.face}` as DictKey)}: {t("designer.layers.noPanel")}
              </Text>
            ))}
        </BlockStack>
      ))}
    </BlockStack>
  );
}
