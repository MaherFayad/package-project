import type { ElementType, ReactNode } from "react";
import styles from "./kit.module.css";

export interface ContainerProps {
  /** default 1260px content box, narrow 880px, wide 1440px, full: no max width (gutters only). */
  size?: "default" | "narrow" | "wide" | "full";
  as?: ElementType;
  className?: string;
  children: ReactNode;
}

/** Centred page column: content box 1260px; gutter 16 phone, 32 tablet, max(24px, (100vw - 1260px) / 2) desktop. Server component. */
export function Container({ size = "default", as: Tag = "div", className, children }: ContainerProps) {
  const sz = size === "narrow" ? styles.containerNarrow : size === "wide" ? styles.containerWide : size === "full" ? styles.containerFull : "";
  return (
    <Tag className={[styles.container, sz, className].filter(Boolean).join(" ")} data-mk-container={size}>
      {children}
    </Tag>
  );
}
