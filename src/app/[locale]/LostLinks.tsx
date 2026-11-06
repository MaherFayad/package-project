"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import styles from "./not-found.module.css";

/** The three large links of the locale 404 / error page, on the small sheet (R4-09, R6). */
export function LostLinks({ links }: { links: { label: string; href?: string; onClick?: () => void }[] }) {
  const arrow = (
    <span className={styles.arrow} aria-hidden="true">
      <ArrowRight size={20} />
    </span>
  );
  return (
    <ul className={styles.links}>
      {links.map((l) => (
        <li key={l.label}>
          {l.href ? (
            <Link href={l.href} className={styles.link}>
              <span>{l.label}</span>
              {arrow}
            </Link>
          ) : (
            <button type="button" className={styles.link} onClick={l.onClick}>
              <span>{l.label}</span>
              {arrow}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
