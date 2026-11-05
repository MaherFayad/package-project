"use client";

import { useState, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, Modal, Text } from "@/components/ui";
import styles from "./store.module.css";

export interface GalleryItem {
  id: string;
  src: string;
  caption: string;
}

export interface GalleryLabels {
  title: string;
  open: string; // "Open image {n} of {total}: {caption}"
  prev: string;
  next: string;
  counter: string; // "Image {n} of {total}"
}

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m));

/**
 * Portfolio grid with an accessible lightbox (UI kit Modal: focus trap, Escape, focus restore).
 * Previous/next buttons and ArrowLeft/ArrowRight (direction-aware) move between images.
 */
export function PortfolioGallery({ items, labels, dir }: { items: GalleryItem[]; labels: GalleryLabels; dir: "rtl" | "ltr" }) {
  const [index, setIndex] = useState<number | null>(null);
  const total = items.length;
  const go = (delta: number) => setIndex((i) => (i === null ? i : (i + delta + total) % total));
  const current = index === null ? null : items[index];

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const forward = e.key === "ArrowRight" ? dir === "ltr" : dir === "rtl";
    go(forward ? 1 : -1);
  };

  return (
    <>
      <ul className={styles.gallery}>
        {items.map((it, i) => (
          <li key={it.id}>
            <button
              type="button"
              className={styles.galleryButton}
              onClick={() => setIndex(i)}
              aria-label={fill(labels.open, { n: i + 1, total, caption: it.caption })}
              aria-haspopup="dialog"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.src} alt="" loading="lazy" decoding="async" width={320} height={240} />
            </button>
            <p className={styles.galleryCaption}>{it.caption}</p>
          </li>
        ))}
      </ul>
      <Modal open={current !== null} onClose={() => setIndex(null)} title={labels.title} size="large">
        {current ? (
          <div className={styles.lightbox} onKeyDown={onKeyDown}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current.src} alt={current.caption} className={styles.lightboxImage} />
            <div className={styles.lightboxBar}>
              <Button icon={dir === "rtl" ? ChevronRight : ChevronLeft} accessibilityLabel={labels.prev} onClick={() => go(-1)} disabled={total < 2} />
              <div aria-live="polite">
                <Text as="p" alignment="center">
                  {current.caption}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                  {fill(labels.counter, { n: (index ?? 0) + 1, total })}
                </Text>
              </div>
              <Button icon={dir === "rtl" ? ChevronLeft : ChevronRight} accessibilityLabel={labels.next} onClick={() => go(1)} disabled={total < 2} />
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
