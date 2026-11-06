import type { ElementType, ReactNode } from "react";
import styles from "./kit.module.css";

export interface ContainerProps {
  /** default 1280px, narrow 880px, wide 1440px, full: no max width (gutters only). */
  size?: "default" | "narrow" | "wide" | "full";
  as?: ElementType;
  className?: string;
  children: ReactNode;
}

/** Centred page column with the fluid gutter (16 / 32 / 40px). Server component. */
export function Container({ size = "default", as: Tag = "div", className, children }: ContainerProps) {
  const sz = size === "narrow" ? styles.containerNarrow : size === "wide" ? styles.containerWide : size === "full" ? styles.containerFull : "";
  return <Tag className={[styles.container, sz, className].filter(Boolean).join(" ")}>{children}</Tag>;
}
