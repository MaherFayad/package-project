"use client";

import { useId, useMemo, useState } from "react";
import { BlockStack, Button, Card, Text, TextField } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { formatNumber } from "@/lib/format";
import { normaliseQuery } from "./lib/jobs";
import type { JobModelDTO } from "./types";
import styles from "./vendor.module.css";

const FIRST = 8;

/**
 * "Models priced with this card": a rate card prices every library model built on its structure and
 * board (up to ~90 on one card), so the list is searchable and collapsed to the first few.
 */
export function ModelCoverage({ models, material }: { models: JobModelDTO[]; material: string }) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState("");
  const [all, setAll] = useState(false);
  const listId = useId();
  const q = normaliseQuery(query);
  const hits = useMemo(
    () => (q ? models.filter((m) => `${m.code} ${m.standard} ${m.name.ar} ${m.name.en}`.toLowerCase().includes(q)) : models),
    [models, q],
  );
  const shown = all || q ? hits : hits.slice(0, FIRST);
  const more = !q && hits.length > FIRST;

  return (
    <Card title={`${t("vendorPortal.rateCards.modelsTitle")} (${formatNumber(models.length)})`}>
      <BlockStack gap="300">
        <Text as="p" tone="subdued" variant="bodySm">
          {t("vendorPortal.rateCards.modelsHelp", { material })}
        </Text>
        {models.length > FIRST ? (
          <TextField
            label={t("vendorPortal.rateCards.modelsSearch")}
            labelHidden
            type="search"
            autoComplete="off"
            value={query}
            onChange={setQuery}
            placeholder={t("vendorPortal.rateCards.modelsSearchHelp")}
            clearButton
            onClearButtonClick={() => setQuery("")}
          />
        ) : null}
        {shown.length ? (
          <ul className={styles.ModelList} id={listId} aria-label={t("vendorPortal.rateCards.modelsTitle")}>
            {shown.map((m) => (
              <li key={m.code} className={styles.ModelItem}>
                <Text as="span" variant="bodySm" fontWeight="medium">
                  {m.name[locale]}
                </Text>
                <Text as="span" variant="bodySm" tone="subdued">
                  <bdi dir="ltr">{m.standard}</bdi>
                </Text>
              </li>
            ))}
          </ul>
        ) : (
          <p role="status">
            <Text as="span" tone="subdued" variant="bodySm">
              {t("vendorPortal.rateCards.modelsNone")}
            </Text>
          </p>
        )}
        {more ? (
          <div>
            <Button variant="plain" onClick={() => setAll((v) => !v)} ariaControls={listId} ariaExpanded={all}>
              {all ? t("vendorPortal.rateCards.modelsShowFewer") : t("vendorPortal.rateCards.modelsShowAll", { count: formatNumber(models.length) })}
            </Button>
          </div>
        ) : null}
      </BlockStack>
    </Card>
  );
}
