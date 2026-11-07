import type { CSSProperties, ElementType, ReactNode } from "react";
import { Container, type ContainerProps } from "./Container";
import styles from "./kit.module.css";

export type SheetTone = "dark" | "dark-2" | "green" | "navy" | "violet" | "light" | "white";

export interface SheetProps {
  /** Background band. dark = page canvas #02090a; dark-2 = raised dark #141a1a (does not collapse with dark); light = #f5f5f3; white = #fff. */
  tone?: SheetTone;
  /** Slide over the previous section: -48px margin and 48px rounded top corners. Default true (false for the first section). */
  overlap?: boolean;
  /**
   * First section of a page that sits UNDER the transparent header (the header turns solid once
   * the page scrolls). Adds header-height top padding and a near-full-height block. Implies overlap=false.
   */
  hero?: boolean;
  /**
   * Band padding (spec section 7): "md" standard band 64/56/40 (default), "lg" feature, sheet,
   * violet and green bands 100/80/64, "xl" closing CTA and after-hero statement 128/96/80.
   */
  y?: "md" | "lg" | "xl";
  /** "none" removes the band padding (full-bleed media that lays itself out). "sm" is kept as an alias of y="md". */
  pad?: "default" | "sm" | "none";
  /** Wrap children in <Container size>. Pass false to lay out full-bleed yourself. Default "default". */
  container?: ContainerProps["size"] | false;
  as?: ElementType;
  id?: string;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  children: ReactNode;
}

/**
 * A page section as a rounded sheet that overlaps the one before it (each later sheet stacks
 * above the earlier one). Spacing follows spec section 7: the overlap equals --mk-radius-sheet
 * and the first heading sits --mk-section-y-lg below the sheet's top edge (rule 3); two adjacent
 * sheets of the same tone collapse to one --mk-section-y between them (rule 2). Sets text colour, muted text, lines and focus ring for its tone.
 * Server component; no JS.
 */
export function Sheet({ tone = "dark", overlap, hero = false, y = "md", pad = "default", container = "default", as: Tag = "section", className, children, ...rest }: SheetProps) {
  const over = hero ? false : overlap ?? true;
  return (
    <Tag
      className={[styles.sheet, className].filter(Boolean).join(" ")}
      data-tone={tone}
      data-overlap={over ? "true" : "false"}
      data-hero={hero ? "true" : undefined}
      data-mk-header-overlay={hero ? "" : undefined}
      data-pad={pad === "none" ? "none" : undefined}
      data-y={y}
      data-mk-band={hero ? "hero" : y}
      {...rest}
    >
      {container === false ? children : <Container size={container}>{children}</Container>}
    </Tag>
  );
}

/** A rounded band INSIDE the container (32px radius on all corners), e.g. the green feature card. */
export function SheetCard({ tone = "green", as: Tag = "div", className, children, ...rest }: { tone?: SheetTone; as?: ElementType; className?: string; style?: CSSProperties; id?: string; "aria-labelledby"?: string; children: ReactNode }) {
  return (
    <Tag className={[styles.sheetCard, className].filter(Boolean).join(" ")} data-tone={tone} {...rest}>
      {children}
    </Tag>
  );
}
