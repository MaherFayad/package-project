import styles from "@/components/marketing/marketing.module.css";

/**
 * Store-wide loading state, streamed while a page's data loads. It mirrors the marketing hero
 * (eyebrow, display headline, lead, pill CTA) and reserves at least a viewport of height, so
 * the footer never paints in view and then jumps when the page arrives (CLS < 0.1).
 */
export default function Loading() {
  return (
    <div className={styles.skeletonPage} role="status" aria-busy="true">
      <section className={`${styles.hero} ${styles.skeletonHero}`} aria-hidden="true">
        <div className={styles.container}>
          <div className={styles.skeletonCopy}>
            <span className={`${styles.skel} ${styles.skelEyebrow}`} />
            <span className={`${styles.skel} ${styles.skelTitle}`} />
            <span className={`${styles.skel} ${styles.skelTitle} ${styles.skelShort}`} />
            <span className={`${styles.skel} ${styles.skelLine}`} />
            <span className={`${styles.skel} ${styles.skelLine} ${styles.skelShort}`} />
            <span className={`${styles.skel} ${styles.skelPill}`} />
          </div>
        </div>
      </section>
    </div>
  );
}
