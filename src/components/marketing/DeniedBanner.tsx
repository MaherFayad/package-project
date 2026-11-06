"use client";

import { useSearchParams } from "next/navigation";
import styles from "./marketing.module.css";

/**
 * "You don't have access to that page" after a role redirect (?denied=1). Read on the client so
 * the home page does not depend on searchParams and can be prerendered.
 */
export function DeniedBanner({ message }: { message: string }) {
  const sp = useSearchParams();
  if (!sp.get("denied")) return null;
  return (
    <div className={styles.container}>
      <p className={styles.managed} role="status" style={{ marginBlockStart: 16 }}>
        {message}
      </p>
    </div>
  );
}
