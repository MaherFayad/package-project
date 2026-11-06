"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import rs from "./restyle.module.css";

export type LostLink = { label: string; href?: string; onClick?: () => void };

/**
 * 404 and error layout in the product-page language (R6): a full-height dark page with a soft
 * teal and navy glow; the code, title and lead at the start; three large links at the end, each
 * with a round arrow button (44 px, WCAG 2.5.8). Everything is static: no motion to reduce.
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
  return (
    <div className={rs.page}>
      <section className={rs.lost} role={role} aria-labelledby={titleId}>
        <div className={`${rs.container} ${rs.lostGrid}`}>
          <div>
            {code ? (
              <span className={rs.code} aria-hidden="true">
                {code}
              </span>
            ) : null}
            <h1 id={titleId} className={rs.h1}>
              {title}
            </h1>
            <p className={rs.lead} style={{ color: "var(--rs-on-dark-2)" }}>
              {body}
            </p>
          </div>
          <ul className={rs.lostLinks}>
            {links.map((l) => (
              <li key={l.label}>
                {l.href ? (
                  <Link href={l.href} className={rs.lostLink}>
                    <span>{l.label}</span>
                    <span className={rs.arrow} aria-hidden="true">
                      <ArrowRight size={20} />
                    </span>
                  </Link>
                ) : (
                  <button type="button" className={rs.lostLink} onClick={l.onClick}>
                    <span>{l.label}</span>
                    <span className={rs.arrow} aria-hidden="true">
                      <ArrowRight size={20} />
                    </span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
