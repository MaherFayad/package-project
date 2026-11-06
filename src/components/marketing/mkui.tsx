import type { ComponentType, ReactNode } from "react";
import styles from "./marketing.module.css";

/**
 * Marketing-native stand-ins for the few admin-kit primitives the public structure, size and
 * printer pages used below their hero (Card, Text, Badge, Icon, Layout). Same props subset, so
 * the page code reads the same, but styled from marketing.module.css only (R4-MK-03): no Polaris
 * stylesheets in front of first paint and no 13 px admin cards under a marketing hero.
 * Server components, no client JavaScript.
 */

type Tone = "subdued" | "success" | "info" | "critical" | undefined;

export function Card({ title, as = "div", children }: { title?: ReactNode; as?: "div" | "section"; children: ReactNode }) {
  const Tag = as;
  return (
    <Tag className={styles.panel}>
      {title ? <h2 className={styles.panelTitle}>{title}</h2> : null}
      {children}
    </Tag>
  );
}

export function Text({
  as = "p",
  tone,
  variant,
  fontWeight,
  numeric,
  alignment,
  children,
}: {
  as?: "p" | "span" | "h2" | "h3";
  tone?: Tone;
  variant?: "bodySm" | "bodyMd" | "headingSm" | "headingMd";
  fontWeight?: "semibold" | "bold";
  numeric?: boolean;
  alignment?: "start" | "center" | "end";
  children: ReactNode;
}) {
  const Tag = as;
  const cls = [
    styles.mkText,
    variant === "bodySm" ? styles.mkTextSm : "",
    variant === "headingSm" ? styles.mkHeadingSm : "",
    variant === "headingMd" ? styles.mkHeadingMd : "",
    tone === "subdued" ? styles.mkMuted : "",
    fontWeight ? styles.mkStrong : "",
    numeric ? styles.num : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <Tag className={cls} style={alignment ? { textAlign: alignment } : undefined}>
      {children}
    </Tag>
  );
}

export function Badge({ tone, icon, children }: { tone?: "success" | "info"; icon?: ReactNode; progress?: string; children: ReactNode }) {
  const t = tone === "success" ? styles.tagSuccess : tone === "info" ? styles.tagInfo : "";
  return (
    <span className={`${styles.tag} ${t}`}>
      {icon}
      {children}
    </span>
  );
}

export function Icon({ source: I, size }: { source: ComponentType<{ size?: number; "aria-hidden"?: boolean }>; size?: "small" | "medium" }) {
  return <I size={size === "small" ? 14 : 18} aria-hidden />;
}

export function Layout({ children }: { children: ReactNode }) {
  return <div className={styles.detailLayout}>{children}</div>;
}

export function LayoutSection({
  variant,
  as = "div",
  children,
  ...rest
}: {
  variant?: "oneThird";
  as?: "div" | "aside";
  children: ReactNode;
  "aria-label"?: string;
}) {
  const Tag = as;
  return (
    <Tag className={variant === "oneThird" ? styles.detailSide : styles.detailMain} {...rest}>
      {children}
    </Tag>
  );
}
