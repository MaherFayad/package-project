import { cx } from "./utils";
import styles from "./Avatar.module.css";

export interface AvatarProps {
  /** Full name: used for initials, colour and the accessible name. */
  name?: string;
  initials?: string;
  source?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** Square-ish (radius 8) like the admin shop/user avatar; round for people lists. */
  shape?: "square" | "round";
  /** Decorative when the name is already shown next to it. */
  decorative?: boolean;
  className?: string;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

function colourIndex(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return (h % 6) + 1;
}

/** Initials on a soft colour (our own AA-checked palette) or an image. */
export function Avatar({ name, initials, source, size = "md", shape = "square", decorative, className }: AvatarProps) {
  const text = initials ?? (name ? initialsOf(name) : "");
  const idx = colourIndex(name ?? text ?? "?");
  return (
    <span
      className={cx(styles.Avatar, styles[`size-${size}`], styles[shape], className)}
      style={{ background: `var(--e-color-avatar-${idx}-bg)`, color: `var(--e-color-avatar-${idx}-text)` }}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : name}
      aria-hidden={decorative ? true : undefined}
    >
      {source ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={source} alt="" className={styles.Image} />
      ) : (
        <span className={styles.Initials} aria-hidden="true">
          {text}
        </span>
      )}
    </span>
  );
}
