import { isValidElement, type ComponentType, type ReactElement, type SVGProps } from "react";
import type { LucideProps } from "lucide-react";
import { cx } from "./utils";
import styles from "./Icon.module.css";

/**
 * An icon source: a lucide-react component (client code) or a ready element such as
 * <Icon source={Truck} /> (required when passing icons from a Server Component into a
 * client component, because functions cannot cross the server/client boundary).
 */
export type IconSource = ComponentType<LucideProps> | ComponentType<SVGProps<SVGSVGElement>> | ReactElement;

export type IconTone =
  | "base"
  | "subdued"
  | "inherit"
  | "info"
  | "success"
  | "caution"
  | "warning"
  | "critical"
  | "emphasis"
  | "interactive"
  | "textInverse"
  | "disabled";

export interface IconProps {
  source: IconSource;
  /** 20px box with a 16px glyph like Polaris ("medium"); "small" = 16px box, "large" = 24px. */
  size?: "small" | "medium" | "large";
  tone?: IconTone;
  /** Mirror in RTL. Use for arrows/chevrons that point "forward"/"back", never for logos or clocks. */
  flipInRtl?: boolean;
  /** Give a label only when the icon carries meaning on its own; otherwise it is hidden from AT. */
  accessibilityLabel?: string;
  className?: string;
}

export function Icon({ source, size = "medium", tone = "inherit", flipInRtl, accessibilityLabel, className }: IconProps) {
  const cls = cx(styles.Icon, styles[`size-${size}`], styles[`tone-${tone}`], flipInRtl && styles.flip, className);
  const glyph = isValidElement(source) ? (
    source
  ) : (
    (() => {
      const Src = source as ComponentType<LucideProps>;
      return <Src aria-hidden="true" focusable="false" strokeWidth={1.75} className={styles.Svg} />;
    })()
  );
  return (
    <span className={cls} role={accessibilityLabel ? "img" : undefined} aria-label={accessibilityLabel} aria-hidden={accessibilityLabel ? undefined : true}>
      {glyph}
    </span>
  );
}

/** Render an IconSource at the default size, or nothing. */
export function renderIcon(src: IconSource | undefined, props: Omit<IconProps, "source"> = {}) {
  if (!src) return null;
  return <Icon source={src} {...props} />;
}
