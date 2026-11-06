"use client";

import Link from "next/link";
import { useRef, useState, type CSSProperties } from "react";
import { prefersReducedMotion } from "./motion";
import styles from "./kit.module.css";

export interface MediaCardProps {
  poster: { src: string; alt: string; width: number; height: number; srcSet?: string; sizes?: string };
  /** Short muted loop (webm and/or mp4). Loaded only on first hover / focus (preload="none"). */
  video?: { webm?: string; mp4?: string };
  title?: string;
  body?: string;
  href?: string;
  /** CSS aspect-ratio. Default "4 / 5". */
  ratio?: string;
  className?: string;
}

/**
 * Media card: poster first; on hover or keyboard focus a muted loop plays over it (never under
 * reduced motion, never autoplaying on load). The video is decorative (aria-hidden); the poster
 * alt and the title carry the meaning. With `href` the whole card is one link.
 */
export function MediaCard({ poster, video, title, body, href, ratio = "4 / 5", className }: MediaCardProps) {
  const v = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const play = () => {
    if (!video || !v.current || prefersReducedMotion()) return;
    v.current.play().then(() => setPlaying(true)).catch(() => {});
  };
  const stop = () => {
    v.current?.pause();
    setPlaying(false);
  };
  const inner = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={poster.src} srcSet={poster.srcSet} sizes={poster.sizes} alt={poster.alt} width={poster.width} height={poster.height} loading="lazy" decoding="async" />
      {video ? (
        <video ref={v} muted loop playsInline preload="none" poster={poster.src} aria-hidden="true" tabIndex={-1}>
          {video.webm ? <source src={video.webm} type="video/webm" /> : null}
          {video.mp4 ? <source src={video.mp4} type="video/mp4" /> : null}
        </video>
      ) : null}
      {title || body ? (
        <span className={styles.mediaCardText}>
          {title ? <span className={styles.mediaCardTitle} style={{ display: "block" }}>{title}</span> : null}
          {body ? <span className={styles.mediaCardBody} style={{ display: "block" }}>{body}</span> : null}
        </span>
      ) : null}
    </>
  );
  const common = {
    className: [styles.mediaCard, className].filter(Boolean).join(" "),
    "data-playing": playing ? "true" : "false",
    style: { "--ratio": ratio } as CSSProperties,
    onPointerEnter: play,
    onPointerLeave: stop,
    onFocus: play,
    onBlur: stop,
  };
  return href ? (
    <Link href={href} {...common}>
      {inner}
    </Link>
  ) : (
    <div {...common}>{inner}</div>
  );
}
