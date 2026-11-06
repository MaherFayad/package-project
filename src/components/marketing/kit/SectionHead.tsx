import type { ElementType, ReactNode } from "react";
import { Display, type DisplaySize } from "./Display";
import styles from "./kit.module.css";

export interface SectionHeadProps {
  title: ReactNode;
  /** One-line subtitle / intro under the title (16px below it). */
  sub?: ReactNode;
  eyebrow?: ReactNode;
  as?: "h1" | "h2" | "h3";
  /** Default "56" (h2 section: 56 / 48 / 36). Use "64" for a page-closing h2, "44" for an h3. */
  size?: DisplaySize;
  align?: "start" | "center";
  /** Big feature: content sits --mk-stack-head-content-lg (80 / 64 / 48) below the head, not 40 / 32 / 32. */
  lg?: boolean;
  id?: string;
  className?: string;
  /** The cards / media / grid after the head. */
  children?: ReactNode;
}

/**
 * Section heading block with the measured stacks (spec section 7): eyebrow, title, then the
 * subtitle 16px below, then the content --mk-stack-head-content below the whole head. Centred
 * heads cap at 760px. Use this instead of page-local margins. Server component.
 */
export function SectionHead({ title, sub, eyebrow, as = "h2", size = "56", align = "start", lg = false, id, className, children }: SectionHeadProps) {
  return (
    <div className={[styles.sectionHead, className].filter(Boolean).join(" ")} data-align={align}>
      <div className={styles.head} data-mk-head="">
        {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
        <Display as={as} size={size} id={id} align={align}>
          {title}
        </Display>
        {sub ? (
          <p className={[styles.lead, align === "center" ? styles["align-center"] : ""].filter(Boolean).join(" ")} data-mk-sub="">
            {sub}
          </p>
        ) : null}
      </div>
      {children ? (
        <div className={styles.headContent} data-lg={lg ? "true" : undefined} data-mk-head-content={lg ? "lg" : "md"}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** Vertical stack with a section-7 gap: title-sub 16, head-content 40/32/32, head-content-lg 80/64/48, grid 24/24/16. */
export function Stack({ gap = "head-content", as: Tag = "div", className, children }: { gap?: "title-sub" | "head-content" | "head-content-lg" | "grid"; as?: ElementType; className?: string; children: ReactNode }) {
  return (
    <Tag className={[styles.stack, className].filter(Boolean).join(" ")} data-gap={gap} data-mk-stack={gap}>
      {children}
    </Tag>
  );
}
