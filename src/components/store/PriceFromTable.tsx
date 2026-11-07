import type { Dims, Locale } from "@/types";
import { Card, Text } from "@/components/marketing/mkui";
import { MAX_INSTANT_QTY } from "@/types";
import { getT } from "@/i18n";
import type { DictKey } from "@/i18n";
import { formatMoney, formatNumber } from "@/lib/format";
import { formatCm } from "./catalog";
import type { PriceFrom } from "./data";
import { SpecTable } from "./SpecTable";
import styles from "./store.module.css";

/** Public "price from" table per quantity tier (ex-VAT, delivery included). */
export function PriceFromTable({ locale, dims, price, title }: { locale: Locale; dims: Dims; price: PriceFrom; title?: string }) {
  const t = getT(locale);
  return (
    <Card title={title ?? t("store.structure.priceTitle")} as="section">
      <div className={styles.prose}>
        <Text as="p" tone="subdued">
          {/* R3-06: cm and the plain board name, as on the rest of the page. */}
          {t("store.structure.priceIntro", { dims: `⁦${formatCm(dims).replace(/×/g, " × ")}⁩ ${t("common.cm")}`, material: t(`materialsPlain.${price.material}` as DictKey) })}
        </Text>
        {price.rows.length ? (
          <div className={styles.tableWrap}>
            <SpecTable
              caption={t("store.structure.tableCaption")}
              numeric={[1, 2]}
              headings={[t("store.structure.qty"), t("store.structure.perBox"), t("store.structure.subtotal"), t("store.structure.delivery")]}
              rows={price.rows.map((r) => [
                <bdi key="q">{formatNumber(r.quantity)}</bdi>,
                <strong key="u">
                  <bdi>{formatMoney(r.unitPiasters, locale, { alwaysDecimals: true })}</bdi>
                </strong>,
                <bdi key="s">{formatMoney(r.subtotalPiasters, locale, { alwaysDecimals: true })}</bdi>,
                t("store.structure.deliveryDays", { days: r.deliveryDays }),
              ])}
            />
          </div>
        ) : (
          <Text as="p">{t("store.structure.priceEmpty")}</Text>
        )}
        <Text as="p" variant="bodySm" tone="subdued">
          {t("store.structure.priceNote")}
        </Text>
        <Text as="p" variant="bodySm" tone="subdued">
          {t("store.structure.manualQuote", { max: formatNumber(MAX_INSTANT_QTY) })}
        </Text>
      </div>
    </Card>
  );
}
