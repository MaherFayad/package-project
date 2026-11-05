"use client";

import { ExternalLink } from "lucide-react";
import NextLink from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { useUi } from "./AppProvider";
import { Icon } from "./Icon";
import { cx } from "./utils";
import styles from "./Misc.module.css";

export interface LinkProps {
  url: string;
  children?: ReactNode;
  /** Opens in a new tab; adds an icon and screen-reader hint. */
  external?: boolean;
  /** Inherit surrounding text colour (inside banners, dark surfaces). */
  monochrome?: boolean;
  removeUnderline?: boolean;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  id?: string;
  accessibilityLabel?: string;
  /** Prefetch for next/link (default Next behaviour when undefined). */
  prefetch?: boolean;
  className?: string;
}

/** Text link: Polaris blue (#005bd3), underlined; internal URLs use next/link. */
export function Link({ url, children, external, monochrome, removeUnderline, onClick, id, accessibilityLabel, prefetch, className }: LinkProps) {
  const { s } = useUi();
  const cls = cx(styles.Link, monochrome && styles.monochrome, removeUnderline && styles.noUnderline, className);
  const isAbsolute = /^(https?:|mailto:|tel:|\/\/)/.test(url);
  if (external || isAbsolute) {
    return (
      <a
        id={id}
        href={url}
        className={cls}
        onClick={onClick}
        aria-label={accessibilityLabel}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
      >
        {children}
        {external ? (
          <>
            <Icon source={ExternalLink} size="small" className={styles.ExternalIcon} />
            <span className="visually-hidden"> {s.opensInNewTab}</span>
          </>
        ) : null}
      </a>
    );
  }
  return (
    <NextLink id={id} href={url} className={cls} onClick={onClick} aria-label={accessibilityLabel} prefetch={prefetch}>
      {children}
    </NextLink>
  );
}

export interface BreadcrumbItem {
  content: ReactNode;
  url?: string;
}

/** Breadcrumb trail; chevrons point along the reading direction. The last item is the current page. */
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  const { s } = useUi();
  return (
    <nav aria-label={s.breadcrumb}>
      <ol className={styles.Breadcrumbs}>
        {items.map((it, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className={styles.Crumb}>
              {it.url && !last ? (
                <NextLink href={it.url} className={styles.CrumbLink}>
                  {it.content}
                </NextLink>
              ) : (
                <span aria-current={last ? "page" : undefined} className={last ? styles.CrumbCurrent : undefined}>
                  {it.content}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
