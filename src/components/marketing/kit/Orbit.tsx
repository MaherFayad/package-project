import type { CSSProperties, ReactNode } from "react";
import { MotionScope } from "./MotionScope";
import styles from "./kit.module.css";

export interface OrbitNode {
  label: ReactNode;
  icon?: ReactNode;
}

/**
 * Orbit diagram: our hub in the centre, nodes on a slowly turning ring (80s, reverse spin) that
 * stay upright. A list for assistive tech; pause button included (WCAG 2.2.2); still under
 * reduced motion.
 */
export function Orbit({ hub, nodes, label, duration = 80, size = 560, className }: { hub: ReactNode; nodes: OrbitNode[]; label: string; duration?: number; size?: number; className?: string }) {
  const n = nodes.length;
  return (
    <MotionScope className={className}>
      <div className={styles.orbit} style={{ "--orbit-dur": `${duration}s`, "--orbit-size": `${size}px` } as CSSProperties}>
        <span className={styles.orbitRing} aria-hidden="true" />
        <span className={`${styles.orbitRing} ${styles.orbitRing2}`} aria-hidden="true" />
        <div className={styles.orbitHub}>{hub}</div>
        <ul className={styles.orbitTrack} aria-label={label}>
          {nodes.map((node, i) => {
            const a = (i / n) * Math.PI * 2 - Math.PI / 2;
            const x = 50 + 50 * Math.cos(a);
            const y = 50 + 50 * Math.sin(a);
            return (
              <li key={i} className={styles.orbitNode} style={{ left: `${x.toFixed(2)}%`, top: `${y.toFixed(2)}%` } as CSSProperties}>
                <span className={styles.orbitNodeInner}>
                  {node.icon ? <span aria-hidden="true">{node.icon}</span> : null}
                  <span>{node.label}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </MotionScope>
  );
}
