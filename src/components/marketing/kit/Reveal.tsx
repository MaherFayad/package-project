import { Children, cloneElement, isValidElement, type CSSProperties, type ElementType, type ReactElement, type ReactNode } from "react";
import styles from "./kit.module.css";

export interface RevealProps {
  as?: ElementType;
  /** rise (default): opacity + 24px rise. fade: opacity only. scale: from 0.96. */
  variant?: "rise" | "fade" | "scale";
  /** Stagger index: delay = index x 60ms. */
  index?: number;
  className?: string;
  id?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/**
 * Reveal once on scroll into view (600ms, cubic-bezier(0.215,0.61,0.355,1)). Uses the shell's
 * <RevealScope> observer (MarketingShell mounts it): without JS nothing is hidden (the hidden
 * state needs html[data-motion="on"]), and reduced motion shows everything at once.
 * Never wrap the LCP element (hero headline) in Reveal; use <HeroTitle> instead.
 */
export function Reveal({ as: Tag = "div", variant = "rise", index, className, style, children, id }: RevealProps) {
  return (
    <Tag
      id={id}
      data-reveal={variant === "rise" ? "" : variant}
      className={[styles.reveal, className].filter(Boolean).join(" ")}
      style={index != null ? ({ ...style, "--m-i": index } as CSSProperties) : style}
    >
      {children}
    </Tag>
  );
}

/**
 * Staggered reveal: every direct child element gets data-reveal and its index (60ms apart).
 * Renders a wrapper `as` (default div) with your className, e.g. a grid.
 */
export function Stagger({ as: Tag = "div", variant = "rise", start = 0, className, children }: { as?: ElementType; variant?: RevealProps["variant"]; start?: number; className?: string; children: ReactNode }) {
  let i = start;
  return (
    <Tag className={className}>
      {Children.map(children, (child) => {
        if (!isValidElement(child)) return child;
        const el = child as ReactElement<{ className?: string; style?: CSSProperties; "data-reveal"?: string }>;
        const idx = i++;
        return cloneElement(el, {
          "data-reveal": variant === "rise" ? "" : variant,
          className: [el.props.className, styles.reveal].filter(Boolean).join(" "),
          style: { ...el.props.style, "--m-i": idx } as CSSProperties,
        });
      })}
    </Tag>
  );
}
