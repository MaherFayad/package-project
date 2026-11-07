import { Fragment } from "react";

/**
 * Joins user-typed parts (address lines, often Latin inside an Arabic page) with the locale's
 * separator, each part in its own <bdi> so its direction is detected on its own (R4-CR-02).
 */
export function IsolatedList({ parts, sep }: { parts: (string | null | undefined | false)[]; sep: string }) {
  const kept = parts.filter((p): p is string => typeof p === "string" && p.trim().length > 0);
  return (
    <>
      {kept.map((p, i) => (
        <Fragment key={i}>
          {i ? sep : null}
          <bdi>{p}</bdi>
        </Fragment>
      ))}
    </>
  );
}
