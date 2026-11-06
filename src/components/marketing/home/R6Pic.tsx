import { preload } from "react-dom";
import type { CSSProperties } from "react";
import { srcSetW, src, type R6Image } from "@/components/marketing/kit/assets";

/**
 * <picture> for an R6 asset (AVIF over WebP, 1x/2x width descriptors). `priority` preloads the
 * AVIF from <head> with high priority (the hero LCP image); everything else is lazy.
 */
export function R6Pic({
  a,
  sizes,
  alt = "",
  className,
  style,
  priority = false,
}: {
  a: R6Image;
  sizes: string;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  priority?: boolean;
}) {
  const avif = srcSetW(a, "avif");
  if (priority) preload(src(a, "avif"), { as: "image", type: "image/avif", imageSrcSet: avif, imageSizes: sizes, fetchPriority: "high" });
  return (
    <picture style={{ display: "contents" }}>
      <source type="image/avif" srcSet={avif} sizes={sizes} />
      <img
        src={src(a)}
        srcSet={srcSetW(a, "webp")}
        sizes={sizes}
        alt={alt}
        width={a.width}
        height={a.height}
        className={className}
        style={style}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        fetchPriority={priority ? "high" : "low"}
      />
    </picture>
  );
}
