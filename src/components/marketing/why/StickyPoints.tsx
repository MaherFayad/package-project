"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./why.module.css";

/**
 * Light-sheet "better packaging": three points beside one sticky device mockup whose screen swaps
 * to the point in view (desktop). Without JS, or on phone, every point shows its own screen
 * under it, so nothing depends on scripting or motion. The active point is decorative state
 * (a rule colour), announced by nothing: all text stays visible at all times.
 */
export function StickyPoints({ points, screens, deviceLabel }: { points: { title: string; body: string }[]; screens: ReactNode[]; deviceLabel: string }) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
        }
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);
  return (
    <div className={styles.points}>
      <ol className={styles.pointList}>
        {points.map((p, i) => (
          <li key={i} ref={(el) => void (refs.current[i] = el)} data-index={i} data-active={i === active ? "true" : "false"} className={styles.point}>
            <h3 className={styles.pointTitle}>{p.title}</h3>
            <p className={styles.pointBody}>{p.body}</p>
            <div className={styles.pointInlineMedia}>{screens[i]}</div>
          </li>
        ))}
      </ol>
      <div className={styles.pointStickyWrap} aria-hidden="true">
        <div className={styles.pointSticky}>
          <div className={styles.device} aria-label={deviceLabel}>
            {screens.map((s, i) => (
              <div key={i} className={styles.deviceScreen} data-active={i === active ? "true" : "false"}>
                {s}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
