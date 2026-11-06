import type { ComponentType, ReactNode } from "react";
import styles from "./restyle/restyle.module.css";

/**
 * R6: styled from restyle/restyle.module.css (grey 24 px tiles, light display weights).
 * Marketing-native stand-ins for the few admin-kit primitives the public structure, size and
 * printer pages used below their hero (Card, Text, Badge, Icon, Layout). Same props subset, so
 * the page code reads the same, but styled from marketing.module.css only (R4-MK-03): no Polaris
 * stylesheets in front of first paint and no 13 px admin cards under a marketing hero.
 * Server components, no client JavaScript.
 */

type Tone = "subdued" | "success" | "info" | "critical" | undefined;

export function Card({ title, as = "div", tone, children }: { title?: ReactNode; as?: "div" | "section"; tone?: "dark"; children: ReactNode }) {
  const Tag = as;
  return (
    <Tag className={tone === "dark" ? `${styles.tile} ${styles.tileDark}` : styles.tile}>
      {title ? <h2 className={styles.tileTitle}>{title}</h2> : null}
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
    styles.text,
    variant === "bodySm" ? styles.textSm : "",
    variant === "headingSm" ? styles.headingSm : "",
    variant === "headingMd" ? styles.headingMd : "",
    tone === "subdued" ? styles.muted : "",
    fontWeight ? styles.strong : "",
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
  return <div className={styles.withAside}>{children}</div>;
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
    <Tag className={variant === "oneThird" ? `${styles.stack} ${styles.aside}` : styles.stack} {...rest}>
      {children}
    </Tag>
  );
}
