"use client";

import { CircleCheck } from "lucide-react";
import type { ArtworkLayer, FaceId, PreflightIssue } from "@/types";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n/types";
import { Badge, Banner, BlockStack, Button, InlineStack, Text } from "@/components/ui";
import { layerName } from "./lib/describe";
import type { PreflightSummary } from "./lib/preflight";
import styles from "./designer.module.css";

const TONE = { error: "critical", warning: "warning", info: "info" } as const;

/** Print check: the production preflight, live. Green "Ready to print" when nothing to fix. */
export function PreflightPanel({
  issues,
  summary,
  layers,
  faceLabel,
  onShow,
}: {
  issues: PreflightIssue[];
  summary: PreflightSummary;
  layers: ArtworkLayer[];
  faceLabel?: (f: FaceId) => string;
  onShow: (layerId: string | undefined, face: FaceId | undefined) => void;
}) {
  const { t } = useI18n();
  return (
    <BlockStack gap="400">
      <BlockStack gap="100">
        <Text as="h3" variant="headingSm">
          {t("designer.check.heading")}
        </Text>
        <Text as="p" tone="subdued">
          {t("designer.check.subtitle")}
        </Text>
      </BlockStack>

      {summary.ready ? (
        <Banner tone="success" title={t("designer.check.ready")} inCard>
          {t("designer.check.readyBody")}
        </Banner>
      ) : summary.empty && issues.length === 1 ? (
        <Banner tone="info" inCard>
          {t("designer.check.emptyBody")}
        </Banner>
      ) : (
        <InlineStack gap="200" wrap>
          {summary.errors > 0 && (
            <Badge tone="critical" progress="incomplete">
              {t("designer.check.errors", { count: summary.errors })}
            </Badge>
          )}
          {summary.warnings > 0 && (
            <Badge tone="warning" progress="partiallyComplete">
              {t("designer.check.warnings", { count: summary.warnings })}
            </Badge>
          )}
        </InlineStack>
      )}

      {issues.filter((i) => i.code !== "EMPTY_DESIGN").length > 0 && (
        <ul className={styles.issueList}>
          {issues
            .filter((i) => i.code !== "EMPTY_DESIGN")
            .map((i, n) => {
              const layer = layers.find((l) => l.id === i.layerId);
              return (
                <li key={`${i.code}-${i.layerId ?? n}`} className={styles.issue}>
                  <BlockStack gap="100">
                    <InlineStack gap="200" blockAlign="center" wrap>
                      <Badge tone={TONE[i.severity]}>{t(`designer.check.severity.${i.severity}` as DictKey)}</Badge>
                      {i.face && layer ? (
                        <Text as="span" variant="bodySm" tone="subdued">
                          {t("designer.check.on", { face: faceLabel ? faceLabel(i.face) : t(`designer.faces.${i.face}` as DictKey), layer: layerName(layer, t) })}
                        </Text>
                      ) : null}
                    </InlineStack>
                    <Text as="p">{t(i.messageKey as DictKey)}</Text>
                    {i.layerId ? (
                      <div>
                        <Button size="slim" onClick={() => onShow(i.layerId, i.face)}>
                          {t("designer.check.goTo")}
                        </Button>
                      </div>
                    ) : null}
                  </BlockStack>
                </li>
              );
            })}
        </ul>
      )}
    </BlockStack>
  );
}

/** Compact status for the toolbar / tab badge. */
export function PreflightBadge({ summary }: { summary: PreflightSummary }) {
  const { t } = useI18n();
  if (summary.ready)
    return (
      <Badge tone="success" icon={CircleCheck}>
        {t("designer.check.ready")}
      </Badge>
    );
  if (summary.errors)
    return (
      <Badge tone="critical" progress="incomplete">
        {t("designer.check.errors", { count: summary.errors })}
      </Badge>
    );
  if (summary.warnings)
    return (
      <Badge tone="warning" progress="partiallyComplete">
        {t("designer.check.warnings", { count: summary.warnings })}
      </Badge>
    );
  return null;
}
