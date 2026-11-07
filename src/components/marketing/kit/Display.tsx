import type { ElementType, ReactNode } from "react";
import styles from "./kit.module.css";

/** Type scale (desktop px, fluid down to phone): hero 180, 96, 64, 56, 44, 20. */
export type DisplaySize = "hero" | "96" | "64" | "56" | "44" | "20";

export interface DisplayProps {
  /** Heading level or element. Pick by document outline, not by size. */
  as?: "h1" | "h2" | "h3" | "h4" | "p" | "span" | "div";
  size?: DisplaySize;
  align?: "start" | "center";
  id?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Display and section headings. Weights: 300 for hero/96, 330 for 64/56/44, 450 for 20.
 * Tracking -0.02em in Latin, 0 in Arabic (joins), with taller Arabic line height.
 */
export function Display({ as: Tag = "h2", size = "64", align = "start", id, className, children }: DisplayProps) {
  return (
    <Tag id={id} className={[styles.display, styles[`size-${size}`], align === "center" ? styles["align-center"] : "", className].filter(Boolean).join(" ")}>
      {children}
    </Tag>
  );
}

/** Alias with a heading-first default (h2, size 64). */
export const Heading = Display;

/** Small accent line above a heading (green on dark, deep green on light, lilac on violet). */
export function Eyebrow({ as: Tag = "p", children, className }: { as?: ElementType; className?: string; children: ReactNode }) {
  return <Tag className={[styles.eyebrow, className].filter(Boolean).join(" ")}>{children}</Tag>;
}

/** Intro paragraph under a heading: 18px, muted for the tone, max 40em. */
export function Lead({ align = "start", children, className }: { align?: "start" | "center"; className?: string; children: ReactNode }) {
  return <p className={[styles.lead, align === "center" ? styles["align-center"] : "", className].filter(Boolean).join(" ")}>{children}</p>;
}

/** Body copy, 16px muted. */
export function Body({ children, className }: { className?: string; children: ReactNode }) {
  return <p className={[styles.body, className].filter(Boolean).join(" ")}>{children}</p>;
}
