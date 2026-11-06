import { preload } from "react-dom";
import type { CSSProperties } from "react";
import { avifSrcSetFor, srcSetFor } from "./assets";

/**
 * An LCP render: `<picture>` with an AVIF source (about half the WebP bytes) over the WebP img,
 * plus a high-priority preload of the AVIF from <head> so the image starts with the CSS instead
 * of when the parser reaches it (R4-MK-06). React does not auto-preload an <img> inside
 * <picture>, so this preload is the only one. Works in server and client components (the
 * preload is a no-op on the client after hydration).
 */
export function HeroImage({
  src,
  sizes,
  alt,
  width,
  height,
  className,
  style,
}: {
  src: string;
  sizes: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  style?: CSSProperties;
}) {
  const avif = avifSrcSetFor(src);
  const webp = srcSetFor(src);
  if (avif) preload(avif.split(/[\s,]/)[0], { as: "image", type: "image/avif", imageSrcSet: avif, imageSizes: sizes, fetchPriority: "high" });
  else preload(src, { as: "image", imageSrcSet: webp, imageSizes: sizes, fetchPriority: "high" });
  return (
    <picture style={{ display: "contents" }}>
      {avif ? <source type="image/avif" srcSet={avif} sizes={sizes} /> : null}
      <img src={src} srcSet={webp} sizes={sizes} alt={alt} width={width} height={height} className={className} style={style} fetchPriority="high" />
    </picture>
  );
}
