import styles from "@/components/designer/designer.module.css";
import lib from "@/components/designer/library.module.css";

/** Editor-shaped skeleton (toolbar, stage, panel) so the layout does not jump when it loads (CLS). */
export default function EditorLoading() {
  return (
    <div className={styles.editor} aria-busy="true">
      <div className={styles.toolbar}>
        <span className={styles.skeletonBar} style={{ inlineSize: "8rem" }} />
        <span className={styles.toolbarSpacer} />
        <span className={styles.skeletonBar} style={{ inlineSize: "9rem" }} />
      </div>
      <div className={styles.priceRow}>
        <span className={styles.skeletonBar} style={{ inlineSize: "14rem", blockSize: "2.5rem", borderRadius: "999px" }} />
      </div>
      <section className={styles.stage}>
        <div className={styles.stageBody}>
          <div className={lib.stageSkeleton} />
        </div>
      </section>
      <aside className={styles.panel}>
        <div className={styles.panelBody}>
          <span className={styles.skeletonBar} style={{ inlineSize: "100%", blockSize: "2.25rem" }} />
          <span className={styles.skeletonBar} style={{ inlineSize: "60%" }} />
          <span className={styles.skeletonBar} style={{ inlineSize: "100%", blockSize: "5rem" }} />
        </div>
      </aside>
    </div>
  );
}
