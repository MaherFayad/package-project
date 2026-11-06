import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./kit.module.css";

/**
 * light: white pill, black text (primary on dark). outline: 2px white border (secondary on dark).
 * tint: lilac pill (primary on violet). dark / outline-dark: the same pair for light sheets.
 * ghost: text link with pill hit area.
 */
export type PillVariant = "light" | "outline" | "tint" | "dark" | "outline-dark" | "ghost";

interface Common {
  variant?: PillVariant;
  /** sm 40px, md 44px (default), lg 56px. Every size meets the 24px target minimum (WCAG 2.5.8). */
  size?: "sm" | "md" | "lg";
  className?: string;
  children: ReactNode;
}

export type PillProps = Common &
  (
    | ({ href: string; prefetch?: boolean; target?: string; rel?: string; "aria-label"?: string; hrefLang?: string } & { type?: never })
    | ({ href?: undefined } & ButtonHTMLAttributes<HTMLButtonElement>)
  );

/** Pill button or link (pass `href` for a Next <Link>). Server-safe; add onClick only from client code. */
export function Pill(props: PillProps) {
  const { variant = "light", size = "md", className, children } = props;
  const cls = [styles.pill, className].filter(Boolean).join(" ");
  if (props.href !== undefined) {
    const { href, prefetch, target, rel, hrefLang } = props;
    return (
      <Link href={href} prefetch={prefetch} target={target} rel={rel} hrefLang={hrefLang} aria-label={props["aria-label"]} className={cls} data-variant={variant} data-size={size}>
        {children}
      </Link>
    );
  }
  const { variant: _v, size: _s, className: _c, children: _ch, href: _h, ...button } = props;
  void _v; void _s; void _c; void _ch; void _h;
  return (
    <button type="button" {...button} className={cls} data-variant={variant} data-size={size}>
      {children}
    </button>
  );
}

/** Row of pills with the reference's 40px top gap and 12px between. */
export function PillRow({ align = "start", children, className }: { align?: "start" | "center"; className?: string; children: ReactNode }) {
  return (
    <div className={[styles.pillRow, className].filter(Boolean).join(" ")} data-align={align}>
      {children}
    </div>
  );
}

/** 44px round icon button (pause / play, carousel arrows). Needs an aria-label. */
export function IconPill({ className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { "aria-label": string }) {
  return <button type="button" {...rest} className={[styles.iconPill, className].filter(Boolean).join(" ")} />;
}
