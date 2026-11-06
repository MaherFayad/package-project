import type { ReactNode } from "react";
import styles from "./store.module.css";

/**
 * Lean, server-rendered data table for the public pages (price tiers, printer machines).
 *
 * Replaces the UI kit DataTable there: it lives in IndexTable.tsx, which also carries the admin
 * filters (Popover, TextField, Tabs), so one price table linked 5 extra render-blocking
 * stylesheets on /boxes/[structure] and /vendors/[slug] (R2-MK-05). Same accessibility contract:
 * a focusable, named scroll region for wide tables on phones (WCAG 2.1.1), a caption, column
 * headers and row headers.
 *
 * Under 490 px each row becomes a small stacked card (row header as its title, then
 * "label: value" lines from `data-label`), so no column is clipped at 390 px and nothing needs
 * sideways scrolling (CR-10, WCAG 1.4.10 Reflow). The markup stays a real table for AT.
 */
export function SpecTable({
  caption,
  headings,
  rows,
  numeric = [],
}: {
  caption: string;
  headings: string[];
  rows: ReactNode[][];
  /** Column indexes that hold numbers (tabular figures, end-aligned). */
  numeric?: number[];
}) {
  const cls = (i: number) => (numeric.includes(i) ? styles.specNum : undefined);
  return (
    <div className={styles.specScroll} tabIndex={0} role="region" aria-label={caption}>
      <table className={styles.specTable}>
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {headings.map((h, i) => (
              <th key={i} scope="col" className={cls(i)}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((c, ci) =>
                ci === 0 ? (
                  <th key={ci} scope="row" className={cls(ci)} data-label={headings[ci]}>
                    {c}
                  </th>
                ) : (
                  <td key={ci} className={cls(ci)} data-label={headings[ci]}>
                    {c}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
