"use client";

import { useId, useMemo, useState } from "react";
import { Badge, BlockStack, Button, Card, Link, Text, TextField } from "@/components/ui";
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
/** Instant first, then special gluing, then quote-only; stable within a group. */
const RANK = { instant: 0, listed: 1, quote: 2, preview: 2 } as const;

export function ModelCoverage({ models: all0, material, listed = [] }: { models: JobModelDTO[]; material: string; listed?: string[] }) {
  const { t, locale } = useI18n();
  // R4: say which models really get an instant price from this card. Special gluing models only
  // do once the printer lists them in its profile; quote / preview models never do.
  const instantOf = (m: JobModelDTO) => !m.mode || m.mode === "instant" || (m.mode === "listed" && listed.includes(m.code));
  const models = useMemo(
    () => all0.map((m, i) => ({ m, i, r: instantOf(m) ? 0 : RANK[m.mode ?? "instant"] })).sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.m),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all0, listed],
  );
  const instant = models.filter(instantOf).length;
  const unlisted = models.filter((m) => m.mode === "listed" && !listed.includes(m.code)).length;
  const byQuote = models.length - instant - unlisted;
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
    <Card title={`${t("vendorPortal.rateCards.modelsTitle")} (${formatNumber(instant)})`}>
      <BlockStack gap="300">
        <Text as="p" tone="subdued" variant="bodySm">
          {t("vendorPortal.rateCards.modelsHelp", { material })}
        </Text>
        {unlisted || byQuote ? (
          <Text as="p" tone="subdued" variant="bodySm">
            {unlisted ? t("vendorPortal.rateCards.modelsUnlisted", { count: formatNumber(unlisted) }) : null}
            {unlisted && byQuote ? " " : null}
            {byQuote ? t("vendorPortal.rateCards.modelsByQuote", { count: formatNumber(byQuote) }) : null}
            {unlisted ? (
              <>
                {" "}
                <Link url={`/${locale}/vendor/profile#special-gluing`}>{t("vendorPortal.rateCards.modelsListLink")}</Link>
              </>
            ) : null}
          </Text>
        ) : null}
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
                {m.mode === "listed" ? (
                  <span>
                    <Badge size="small" tone={listed.includes(m.code) ? "success" : "attention"}>
                      {listed.includes(m.code) ? t("vendorPortal.rateCards.modelBadge.listedOn") : t("vendorPortal.rateCards.modelBadge.listedOff")}
                    </Badge>
                  </span>
                ) : m.mode === "quote" || m.mode === "preview" ? (
                  <span>
                    <Badge size="small">{t("vendorPortal.rateCards.modelBadge.quote")}</Badge>
                  </span>
                ) : null}
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
