"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./kit.module.css";

export interface StoryStep {
  id: string;
  title: ReactNode;
  body?: ReactNode;
  /** Shown in the sticky column on desktop and inline above the step on phones. */
  media: ReactNode;
  /** Optional extra content under the body (pills, lists). */
  extra?: ReactNode;
}

export interface StickyStoryProps {
  steps: StoryStep[];
  /** Which side the sticky media sits on (logical: start = right in Arabic). Default "end". */
  mediaSide?: "start" | "end";
  headingLevel?: "h2" | "h3";
  className?: string;
}

/**
 * Pinned story: the media column sticks while text steps scroll past; the step nearest the
 * viewport centre becomes active and its media cross-fades in (450ms). Phones and no-JS: each
 * step shows its own media inline, all text at full opacity. Media is decorative duplication of
 * the step on desktop (aria-hidden there), so screen readers read each step once.
 */
export function StickyStory({ steps, mediaSide = "end", headingLevel: H = "h3", className }: StickyStoryProps) {
  const [active, setActive] = useState(0);
  const [js, setJs] = useState(false);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    setJs(true);
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [steps.length]);
  return (
    <div className={[styles.story, className].filter(Boolean).join(" ")} data-media={mediaSide} data-js={js ? "true" : undefined}>
      <div className={styles.storySteps}>
        {steps.map((s, i) => (
          <div key={s.id} ref={(el) => void (refs.current[i] = el)} data-index={i} className={styles.storyStep} data-active={i === active ? "true" : "false"}>
            <div className={styles.storyStepMedia}>{s.media}</div>
            <H className={`${styles.display} ${styles["size-44"]}`}>{s.title}</H>
            {s.body ? <p className={styles.body}>{s.body}</p> : null}
            {s.extra}
          </div>
        ))}
      </div>
      <div className={styles.storyMedia} aria-hidden="true">
        {steps.map((s, i) => (
          <div key={s.id} className={styles.storyMediaItem} data-active={i === active ? "true" : "false"}>
            {s.media}
          </div>
        ))}
      </div>
    </div>
  );
}
