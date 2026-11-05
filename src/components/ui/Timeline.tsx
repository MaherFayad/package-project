import type { ReactNode } from "react";
import { cx } from "./utils";
import styles from "./Misc.module.css";

export interface TimelineEvent {
  id: string;
  content: ReactNode;
  /** Right-aligned (left in RTL) secondary timestamp: "17 minutes ago". Use a <time> element. */
  time?: ReactNode;
  /** Expandable details (rendered in a native <details>, keyboard accessible). */
  details?: ReactNode;
  /** Embedded action, e.g. a small "View email" button. */
  action?: ReactNode;
  tone?: "default" | "success" | "critical" | "attention";
}

export interface TimelineGroup {
  /** Date heading: "Today", "12 November". */
  title: ReactNode;
  events: TimelineEvent[];
}

/** Activity timeline: optional composer card, dotted vertical rail, date group headings. */
export function Timeline({ groups, composer, footer, headingLevel = 3 }: { groups: TimelineGroup[]; composer?: ReactNode; footer?: ReactNode; headingLevel?: 2 | 3 | 4 }) {
  const H = `h${headingLevel}` as "h3";
  return (
    <div className={styles.Timeline}>
      {composer ? <div className={styles.TimelineComposer}>{composer}</div> : null}
      <div className={styles.TimelineRail}>
        {groups.map((g, gi) => (
          <section key={gi} className={styles.TimelineGroup}>
            <H className={styles.TimelineDate}>{g.title}</H>
            <ol className={styles.TimelineList}>
              {g.events.map((e) => (
                <li key={e.id} className={cx(styles.TimelineEvent, e.tone && styles[`event-${e.tone}`])}>
                  <span className={styles.TimelineDot} aria-hidden="true" />
                  <div className={styles.TimelineBody}>
                    {e.details ? (
                      <details className={styles.TimelineDetails}>
                        <summary>{e.content}</summary>
                        <div className={styles.TimelineDetailsContent}>{e.details}</div>
                      </details>
                    ) : (
                      <div>{e.content}</div>
                    )}
                    {e.action ? <div className={styles.TimelineAction}>{e.action}</div> : null}
                  </div>
                  {e.time ? <span className={styles.TimelineTime}>{e.time}</span> : null}
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
      {footer ? <div className={styles.TimelineFooter}>{footer}</div> : null}
    </div>
  );
}
