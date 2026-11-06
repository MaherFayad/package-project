import { Fragment, type CSSProperties } from "react";
import styles from "./kit.module.css";

export interface HeroTitleProps {
  /** One string per line (rendered as block spans), or a single `text`. */
  lines?: string[];
  text?: string;
  as?: "h1" | "h2" | "p";
  size?: "hero" | "96" | "64";
  align?: "start" | "center";
  id?: string;
  className?: string;
}

/**
 * Hero headline with the reference's word slide-in (400ms per word, 45ms apart, in reading order
 * for both directions). Words rise without fading, so the headline still counts as the LCP paint.
 * Split on spaces only, so Arabic letters keep joining inside each word. Server component.
 */
export function HeroTitle({ lines, text, as: Tag = "h1", size = "96", align = "start", id, className }: HeroTitleProps) {
  const all = lines ?? [text ?? ""];
  let w = 0;
  return (
    <Tag id={id} className={[styles.display, styles[`size-${size}`], align === "center" ? styles["align-center"] : "", className].filter(Boolean).join(" ")}>
      {all.map((line, li) => (
        <span key={li} className={styles.heroLine}>
          {line.split(/\s+/).filter(Boolean).map((word, wi, arr) => (
            <Fragment key={wi}>
              <span className={styles.heroWord} style={{ "--w": w++ } as CSSProperties}>
                {word}
              </span>
              {wi < arr.length - 1 ? " " : null}
            </Fragment>
          ))}
          {li < all.length - 1 ? " " : null}
        </span>
      ))}
    </Tag>
  );
}
