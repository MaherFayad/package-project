import type { CSSProperties, ReactNode } from "react";
import styles from "./kit.module.css";

export interface FloatChip {
  content: ReactNode;
  /** Position relative to the frame (logical start / top), CSS lengths. */
  x: string;
  y: string;
}

export interface MockupFrameProps {
  /** none: rounded card with float shadow; browser: adds a window bar; phone: device bezel 9:19.5. */
  frame?: "none" | "browser" | "phone";
  /** Slight 3D tilt (mirrors in RTL). */
  tilt?: boolean;
  /** Small floating UI chips (price badge, order status) over the frame. */
  chips?: FloatChip[];
  caption?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** The UI image (our real screens, cropped). */
  children: ReactNode;
}

/** Floating product-UI mockup with soft shadow. Server component; no motion of its own (wrap in Reveal). */
export function MockupFrame({ frame = "none", tilt = false, chips, caption, className, style, children }: MockupFrameProps) {
  return (
    <figure className={[styles.mockup, className].filter(Boolean).join(" ")} data-frame={frame} data-tilt={tilt ? "true" : undefined} style={style}>
      <div className={styles.mockupInner}>
        {frame === "browser" ? (
          <div className={styles.mockupBar} aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        ) : null}
        {children}
      </div>
      {chips?.map((c, i) => (
        <div key={i} className={styles.floatChip} style={{ insetInlineStart: c.x, insetBlockStart: c.y }}>
          {c.content}
        </div>
      ))}
      {caption ? <figcaption className={styles.mockupCaption}>{caption}</figcaption> : null}
    </figure>
  );
}
