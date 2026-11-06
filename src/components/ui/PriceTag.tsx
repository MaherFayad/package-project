"use client";

import { formatMoney } from "@/lib/format";
import type { Locale, Piasters } from "@/types";
import { useUi } from "./AppProvider";
import { uiStrings } from "./strings";
import { cx } from "./utils";
import styles from "./PriceTag.module.css";

export interface PriceTagProps {
  /** Integer piasters (1 EGP = 100). */
  amount: Piasters;
  /** Previous price, shown struck through before the amount. */
  compareAt?: Piasters;
  /** Defaults to the UI locale: "1,250.50 ج.م" (ar) / "EGP 1,250.50" (en). */
  locale?: Locale;
  size?: "small" | "medium" | "large" | "display";
  /** Add a VAT qualifier after the amount. */
  vat?: "excluded" | "included";
  perUnit?: boolean;
  alwaysDecimals?: boolean;
  tone?: "base" | "subdued" | "success" | "critical";
  /** Visible label before the amount, e.g. "Total". */
  label?: string;
}

/**
 * EGP price with Western digits, tabular figures and the currency placed per locale.
 * The amount is bidi-isolated so it never reorders inside Arabic text.
 */
export function PriceTag({ amount, compareAt, locale: localeProp, size = "medium", vat, perUnit, alwaysDecimals, tone = "base", label }: PriceTagProps) {
  const ui = useUi();
  const locale: Locale = localeProp ?? ui.locale;
  const s = uiStrings[locale];
  const value = formatMoney(amount, locale, { alwaysDecimals });
  return (
    <span className={cx(styles.PriceTag, styles[`price-${size}`], styles[`priceTone-${tone}`])}>
      {label ? <span className={styles.PriceLabel}>{label}</span> : null}
      {compareAt !== undefined && compareAt > amount ? (
        <s className={styles.PriceCompare}>
          <bdi>{formatMoney(compareAt, locale, { alwaysDecimals })}</bdi>
        </s>
      ) : null}
      <data value={(amount / 100).toFixed(2)} className={styles.PriceAmount}>
        <bdi>{value}</bdi>
      </data>
      {perUnit ? <span className={styles.PriceQualifier}>{s.perUnit}</span> : null}
      {vat ? <span className={styles.PriceQualifier}>{vat === "excluded" ? s.vatExcluded : s.vatIncluded}</span> : null}
    </span>
  );
}
