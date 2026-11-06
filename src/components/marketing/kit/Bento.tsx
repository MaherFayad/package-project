import type { CSSProperties, ElementType, ReactNode } from "react";
import styles from "./kit.module.css";

/** Bento grid: `cols` columns from 768px (1 column on phones), rows at least `row` px. */
export function Bento({ cols = 3, row = 280, as: Tag = "div", className, children }: { cols?: 2 | 3 | 4; row?: number; as?: ElementType; className?: string; children: ReactNode }) {
  return (
    <Tag className={[styles.bento, className].filter(Boolean).join(" ")} data-mk-grid="bento" style={{ "--bento-cols": cols, "--bento-row": `${row}px` } as CSSProperties}>
      {children}
    </Tag>
  );
}

export interface BentoCardProps {
  /** Column / row span from 768px. */
  span?: 1 | 2 | 3 | 4;
  rowSpan?: 1 | 2;
  /** white (default, the reference's light cards), grey, dark, green, violet. */
  tone?: "white" | "grey" | "dark" | "green" | "violet";
  eyebrow?: ReactNode;
  title: ReactNode;
  titleAs?: "h3" | "h4";
  body?: ReactNode;
  /** UI mockup or image, pinned to the card foot. */
  media?: ReactNode;
  as?: ElementType;
  className?: string;
  children?: ReactNode;
}

/** Bento card: 32px radius, 32px padding, title 20/450, muted body, media at the foot. */
export function BentoCard({ span = 1, rowSpan = 1, tone = "white", eyebrow, title, titleAs: H = "h3", body, media, as: Tag = "article", className, children }: BentoCardProps) {
  return (
    <Tag className={[styles.bentoCard, className].filter(Boolean).join(" ")} data-tone={tone} style={{ "--cs": span, "--rs": rowSpan } as CSSProperties}>
      {eyebrow ? <p className={styles.eyebrow} style={{ marginBlockEnd: 4 }}>{eyebrow}</p> : null}
      <H className={styles.bentoTitle}>{title}</H>
      {body ? <p className={styles.bentoBody}>{body}</p> : null}
      {children}
      {media ? <div className={styles.bentoMedia}>{media}</div> : null}
    </Tag>
  );
}
