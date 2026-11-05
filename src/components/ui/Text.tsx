import type { ElementType, ReactNode } from "react";
import { cx } from "./utils";
import styles from "./Text.module.css";

export type TextVariant =
  | "heading3xl"
  | "heading2xl"
  | "headingXl"
  | "headingLg"
  | "headingMd"
  | "headingSm"
  | "headingXs"
  | "bodyLg"
  | "bodyMd"
  | "bodySm"
  | "bodyXs";

export type TextTone =
  | "base"
  | "subdued"
  | "disabled"
  | "success"
  | "critical"
  | "caution"
  | "warning"
  | "info"
  | "magic"
  | "textInverse"
  | "inherit"
  | "link";

export interface TextProps {
  /** Element to render. Required so heading levels are always a conscious choice. */
  as: ElementType;
  variant?: TextVariant;
  tone?: TextTone;
  fontWeight?: "regular" | "medium" | "semibold" | "bold";
  alignment?: "start" | "center" | "end" | "justify";
  /** Tabular, LTR-isolated digits for money, quantities and sizes (never mirrored in RTL). */
  numeric?: boolean;
  truncate?: boolean;
  breakWord?: boolean;
  visuallyHidden?: boolean;
  textDecorationLine?: "line-through";
  id?: string;
  className?: string;
  children?: ReactNode;
  /** Pass-through for <label htmlFor>. */
  htmlFor?: string;
  dir?: "ltr" | "rtl" | "auto";
}

export function Text({
  as: Tag,
  variant = "bodyMd",
  tone,
  fontWeight,
  alignment,
  numeric,
  truncate,
  breakWord,
  visuallyHidden,
  textDecorationLine,
  className,
  children,
  ...rest
}: TextProps) {
  return (
    <Tag
      className={cx(
        styles.Text,
        styles[variant],
        tone && styles[`tone-${tone}`],
        fontWeight && styles[`weight-${fontWeight}`],
        alignment && styles[`align-${alignment}`],
        numeric && styles.numeric,
        truncate && styles.truncate,
        breakWord && styles.breakWord,
        textDecorationLine === "line-through" && styles.lineThrough,
        visuallyHidden && "visually-hidden",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}
