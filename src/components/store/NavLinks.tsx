"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./SiteChrome.module.css";

export interface NavLinkItem {
  href: string;
  label: string;
  /** Path prefixes that mark this link as the current section. */
  match: string[];
}

/** Top-bar links with aria-current on the active section. */
export function NavLinks({ links }: { links: NavLinkItem[] }) {
  const pathname = usePathname() ?? "";
  return (
    <ul className={styles.navList}>
      {links.map((l) => {
        const current = l.match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
        return (
          <li key={l.href}>
            <Link href={l.href} className={styles.navLink} aria-current={current ? "page" : undefined}>
              {l.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
