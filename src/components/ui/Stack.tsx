import type { CSSProperties, ElementType, ReactNode } from "react";
import { cx, responsiveVars, space, type Responsive, type SpaceScale } from "./utils";
import styles from "./Stack.module.css";

/* ───────────────────────── Box ───────────────────────── */

type BgToken =
  | "bg"
  | "bg-surface"
  | "bg-surface-secondary"
  | "bg-surface-tertiary"
  | "bg-surface-hover"
  | "bg-surface-info"
  | "bg-surface-success"
  | "bg-surface-caution"
  | "bg-surface-warning"
  | "bg-surface-critical"
  | "bg-fill-secondary"
  | "bg-fill-tertiary";

export interface BoxProps {
  as?: ElementType;
  id?: string;
  background?: BgToken;
  padding?: Responsive<SpaceScale>;
  paddingBlock?: Responsive<SpaceScale>;
  paddingInline?: Responsive<SpaceScale>;
  paddingBlockStart?: SpaceScale;
  paddingBlockEnd?: SpaceScale;
  paddingInlineStart?: SpaceScale;
  paddingInlineEnd?: SpaceScale;
  borderRadius?: "0" | "100" | "150" | "200" | "300" | "400" | "full";
  borderColor?: "border" | "border-secondary" | "border-tertiary" | "border-info" | "border-critical";
  borderWidth?: "025" | "050";
  borderBlockStartWidth?: "025" | "050";
  borderBlockEndWidth?: "025" | "050";
  shadow?: "100" | "200" | "300" | "400" | "500" | "600" | "bevel-100";
  minHeight?: string;
  minWidth?: string;
  maxWidth?: string;
  width?: string;
  overflowX?: "hidden" | "auto" | "clip";
  position?: "relative" | "sticky";
  insetBlockStart?: SpaceScale;
  className?: string;
  style?: CSSProperties;
  role?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  children?: ReactNode;
}

/** Polaris Box: the one primitive for padding, background, border, radius and shadow. */
export function Box({
  as: Tag = "div",
  background,
  padding,
  paddingBlock,
  paddingInline,
  paddingBlockStart,
  paddingBlockEnd,
  paddingInlineStart,
  paddingInlineEnd,
  borderRadius,
  borderColor,
  borderWidth,
  borderBlockStartWidth,
  borderBlockEndWidth,
  shadow,
  minHeight,
  minWidth,
  maxWidth,
  width,
  overflowX,
  position,
  insetBlockStart,
  className,
  style,
  children,
  ...rest
}: BoxProps) {
  const v: Record<string, string | undefined> = {
    ...responsiveVars("box-pbs", paddingBlock ?? padding, space),
    ...responsiveVars("box-pis", paddingInline ?? padding, space),
  };
  const hasBorder = borderColor || borderWidth || borderBlockStartWidth || borderBlockEndWidth;
  const s: CSSProperties = {
    ...(v as CSSProperties),
    paddingBlockStart: space(paddingBlockStart),
    paddingBlockEnd: space(paddingBlockEnd),
    paddingInlineStart: space(paddingInlineStart),
    paddingInlineEnd: space(paddingInlineEnd),
    background: background ? `var(--p-color-${background})` : undefined,
    borderRadius: borderRadius ? `var(--p-border-radius-${borderRadius})` : undefined,
    borderStyle: hasBorder ? "solid" : undefined,
    borderColor: hasBorder ? `var(--p-color-${borderColor ?? "border"})` : undefined,
    borderWidth: hasBorder
      ? borderWidth
        ? `var(--p-border-width-${borderWidth})`
        : 0
      : undefined,
    borderBlockStartWidth: borderBlockStartWidth ? `var(--p-border-width-${borderBlockStartWidth})` : undefined,
    borderBlockEndWidth: borderBlockEndWidth ? `var(--p-border-width-${borderBlockEndWidth})` : undefined,
    boxShadow: shadow ? `var(--p-shadow-${shadow})` : undefined,
    minHeight,
    minWidth,
    maxWidth,
    width,
    overflowX,
    position,
    insetBlockStart: space(insetBlockStart),
    ...style,
  };
  return (
    <Tag className={cx(styles.Box, (padding || paddingBlock || paddingInline) && styles.padded, className)} style={s} {...rest}>
      {children}
    </Tag>
  );
}

/* ───────────────────────── Stacks ───────────────────────── */

type Align = "start" | "center" | "end" | "space-between" | "space-around" | "space-evenly";
type BlockAlign = "start" | "center" | "end" | "baseline" | "stretch";

export interface BlockStackProps {
  as?: ElementType;
  gap?: Responsive<SpaceScale>;
  align?: Align;
  inlineAlign?: "start" | "center" | "end" | "baseline" | "stretch";
  reverseOrder?: boolean;
  id?: string;
  className?: string;
  role?: string;
  children?: ReactNode;
}

/** Vertical stack with consistent gaps. */
export function BlockStack({ as: Tag = "div", gap, align, inlineAlign, reverseOrder, className, children, ...rest }: BlockStackProps) {
  const style = {
    ...responsiveVars("stack-gap", gap, space),
    justifyContent: align === "start" ? "flex-start" : align === "end" ? "flex-end" : align,
    alignItems: inlineAlign === "start" ? "flex-start" : inlineAlign === "end" ? "flex-end" : inlineAlign,
    flexDirection: reverseOrder ? "column-reverse" : undefined,
  } as CSSProperties;
  return (
    <Tag className={cx(styles.BlockStack, gap !== undefined && styles.gapped, className)} style={style} {...rest}>
      {children}
    </Tag>
  );
}

export interface InlineStackProps {
  as?: ElementType;
  gap?: Responsive<SpaceScale>;
  align?: Align;
  blockAlign?: BlockAlign;
  wrap?: boolean;
  /** Logical direction; "row" follows the document direction (RTL puts the first child on the right). */
  direction?: "row" | "row-reverse";
  id?: string;
  className?: string;
  role?: string;
  children?: ReactNode;
}

/** Horizontal (inline-axis) stack. Wraps by default, like Polaris. */
export function InlineStack({ as: Tag = "div", gap, align, blockAlign, wrap = true, direction, className, children, ...rest }: InlineStackProps) {
  const style = {
    ...responsiveVars("stack-gap", gap, space),
    justifyContent: align === "start" ? "flex-start" : align === "end" ? "flex-end" : align,
    alignItems: blockAlign === "start" ? "flex-start" : blockAlign === "end" ? "flex-end" : blockAlign,
    flexWrap: wrap ? "wrap" : "nowrap",
    flexDirection: direction,
  } as CSSProperties;
  return (
    <Tag className={cx(styles.InlineStack, gap !== undefined && styles.gapped, className)} style={style} {...rest}>
      {children}
    </Tag>
  );
}

export interface InlineGridProps {
  as?: ElementType;
  /** Number of equal columns, or a CSS grid-template-columns string; responsive. */
  columns?: Responsive<number | string>;
  gap?: Responsive<SpaceScale>;
  alignItems?: "start" | "center" | "end";
  className?: string;
  children?: ReactNode;
}

/** Equal-column grid (e.g. metric cards, form rows). Collapse to 1 column on phones via {xs: 1, md: 3}. */
export function InlineGrid({ as: Tag = "div", columns = 1, gap, alignItems, className, children }: InlineGridProps) {
  const style = {
    ...responsiveVars("grid-cols", columns, (c) => (typeof c === "number" ? `repeat(${c}, minmax(0, 1fr))` : c)),
    ...responsiveVars("stack-gap", gap, space),
    alignItems,
  } as CSSProperties;
  return (
    <Tag className={cx(styles.InlineGrid, gap !== undefined && styles.gapped, className)} style={style}>
      {children}
    </Tag>
  );
}

/* ───────────────────────── Divider ───────────────────────── */

export function Divider({ borderColor = "border", borderWidth = "025" }: { borderColor?: "border" | "border-secondary" | "border-inverse" | "transparent"; borderWidth?: "025" | "050" | "100" }) {
  return (
    <hr
      className={styles.Divider}
      style={{
        borderBlockStartColor: borderColor === "transparent" ? "transparent" : `var(--p-color-${borderColor})`,
        borderBlockStartWidth: `var(--p-border-width-${borderWidth})`,
      }}
    />
  );
}

/* ───────────────────────── Bleed ───────────────────────── */

/** Pull content out to a card's edges (negative margins), e.g. full-bleed tables inside a Card. */
export function Bleed({ marginInline = "400", marginBlock, children }: { marginInline?: SpaceScale; marginBlock?: SpaceScale; children?: ReactNode }) {
  return (
    <div
      style={{
        marginInline: `calc(-1 * var(--p-space-${marginInline}))`,
        marginBlock: marginBlock ? `calc(-1 * var(--p-space-${marginBlock}))` : undefined,
      }}
    >
      {children}
    </div>
  );
}
