import type { CSSProperties, ReactNode } from "react";
import styles from "./kit.module.css";

export interface FanCard {
  media: ReactNode;
  /** Caption over the card foot (e.g. "Sample design"). Label sample brands as samples. */
  label?: ReactNode;
}

/**
 * Card fan / lineup: tall cards in a tilted arc that rise into place once on enter and
 * straighten on hover or focus. Phones: a snap-scrolling row. No continuous motion (nothing to
 * pause). Server component.
 */
export function CardFan({ cards, width = 240, tilt = 6, height = 520, className, "aria-label": label }: { cards: FanCard[]; width?: number; tilt?: number; height?: number; className?: string; "aria-label"?: string }) {
  return (
    // tabIndex: on phones the fan is a horizontal scroller, which keyboard users must be able to scroll (WCAG 2.1.1).
    <ul className={[styles.fan, className].filter(Boolean).join(" ")} data-reveal="fade" aria-label={label} tabIndex={0} style={{ "--fan-w": `${width}px`, "--fan-tilt": `${tilt}deg`, "--fan-h": `${height}px`, margin: 0, listStyle: "none" } as CSSProperties}>
      {cards.map((c, i) => (
        <li key={i} className={styles.fanCard} style={{ "--i": i, "--n": cards.length } as CSSProperties}>
          {c.media}
          {c.label ? <span className={styles.fanLabel}>{c.label}</span> : null}
        </li>
      ))}
    </ul>
  );
}
