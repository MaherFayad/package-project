import { ImageOff } from "lucide-react";
import { Icon } from "./Icon";
import { cx } from "./utils";
import styles from "./Misc.module.css";

export interface ThumbnailProps {
  source?: string;
  /** Required: describe the image, or "" if it is decorative next to its name. */
  alt: string;
  size?: "extraSmall" | "small" | "medium" | "large";
  /** Show the whole image (packaging mockups) instead of cropping. */
  fit?: "cover" | "contain";
}

/** Square image tile with a hairline border; radius 8 (6 for extra small). */
export function Thumbnail({ source, alt, size = "medium", fit = "contain" }: ThumbnailProps) {
  return (
    <span className={cx(styles.Thumbnail, styles[`thumbnail-${size}`])}>
      {source ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={source} alt={alt} loading="lazy" decoding="async" style={{ objectFit: fit }} />
      ) : (
        <Icon source={ImageOff} tone="subdued" accessibilityLabel={alt || undefined} />
      )}
    </span>
  );
}
