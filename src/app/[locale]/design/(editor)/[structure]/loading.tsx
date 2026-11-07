import styles from "@/components/designer/designer.module.css";
import lib from "@/components/designer/library.module.css";

/** Editor-shaped skeleton (canvas, rail, panel, dock) so the layout does not jump when it loads (CLS). */
export default function EditorLoading() {
  return (
    <div className={styles.editor} data-sheet="closed" aria-busy="true">
      <div className={styles.workspace}>
        <section className={styles.stage}>
          <div className={styles.stageBody}>
            <div className={styles.sceneLoading}>
              <div className={lib.stageSkeleton} />
            </div>
          </div>
        </section>
        <div className={styles.dock}>
          <span
            className={styles.skeletonBar}
            style={{
              inlineSize: "20rem",
              blockSize: "3.25rem",
              borderRadius: "1rem",
            }}
          />
        </div>
        <aside className={styles.panel}>
          <div className={styles.rail}>
            <div className={styles.railCard}>
              <span
                className={styles.skeletonBar}
                style={{ blockSize: "15rem" }}
              />
            </div>
          </div>
          <div className={styles.sheet}>
            <div className={styles.panelInner}>
              <div className={styles.panelBody}>
                <span
                  className={styles.skeletonBar}
                  style={{ inlineSize: "40%" }}
                />
                <span
                  className={styles.skeletonBar}
                  style={{ inlineSize: "100%", blockSize: "13rem" }}
                />
                <span
                  className={styles.skeletonBar}
                  style={{ inlineSize: "100%", blockSize: "3.25rem" }}
                />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
