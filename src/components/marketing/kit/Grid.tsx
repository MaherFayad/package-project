import type { CSSProperties, ElementType, ReactNode } from "react";
import styles from "./kit.module.css";

export interface GridProps {
  /** Columns from 1024px. Default 3. */
  cols?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Columns from 768 to 1023px. Default 2. */
  colsMd?: 1 | 2 | 3 | 4;
  /** Columns under 768px. Default 1. */
  colsSm?: 1 | 2 | 3;
  /** default 24/24/16, tight (dense rows, icon walls) 16/16/12, bento 32/24/16. */
  gap?: "default" | "tight" | "bento";
  as?: ElementType;
  className?: string;
  children: ReactNode;
}

/** Card grid with the measured gaps (spec section 7). Server component. */
export function Grid({ cols = 3, colsMd = 2, colsSm = 1, gap = "default", as: Tag = "div", className, children }: GridProps) {
  return (
    <Tag className={[styles.grid, className].filter(Boolean).join(" ")} data-gap={gap} data-mk-grid={gap} style={{ "--cols": cols, "--cols-md": colsMd, "--cols-sm": colsSm } as CSSProperties}>
      {children}
    </Tag>
  );
}
