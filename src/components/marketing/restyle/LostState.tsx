"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { Sheet } from "../kit/Sheet";
import { Display, Lead } from "../kit/Display";
import ls from "./lost.module.css";

export type LostLink = { label: string; href?: string; onClick?: () => void };

/**
 * 404 and error layout (R6, modelled on the reference's 404): a full-height dark hero sheet with
 * a soft teal and navy glow; the code, title and lead at the start; three large links at the end,
 * each with a round 44 px arrow button (WCAG 2.5.8). Static: nothing moves.
 */
export function LostState({
  code,
  titleId,
  title,
  body,
  links,
  role,
}: {
  code?: string;
  titleId: string;
  title: string;
  body: ReactNode;
  links: LostLink[];
  role?: "alert";
}) {
  const arrow = (
    <span className={ls.arrow} aria-hidden="true">
      <ArrowRight size={20} />
    </span>
  );
  return (
    <div className={ls.page} role={role}>
      <Sheet tone="dark" hero className={ls.lost} aria-labelledby={titleId}>
        <div className={ls.lostGrid}>
          <div>
            {code ? (
              <span className={ls.code} aria-hidden="true">
                {code}
              </span>
            ) : null}
            <Display as="h1" size="64" id={titleId}>
              {title}
            </Display>
            <Lead>{body}</Lead>
          </div>
          <ul className={ls.lostLinks}>
            {links.map((l) => (
              <li key={l.label}>
                {l.href ? (
                  <Link href={l.href} className={ls.lostLink}>
                    <span>{l.label}</span>
                    {arrow}
                  </Link>
                ) : (
                  <button type="button" className={ls.lostLink} onClick={l.onClick}>
                    <span>{l.label}</span>
                    {arrow}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </Sheet>
    </div>
  );
}
