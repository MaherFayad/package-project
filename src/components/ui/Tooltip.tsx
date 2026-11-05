"use client";

import { isValidElement, useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from "react";
import { useAnchoredPosition } from "./useAnchor";
import { getFocusable } from "./utils";
import styles from "./Misc.module.css";

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  preferredPosition?: "above" | "below";
  /** ms before showing on hover (focus shows immediately). */
  hoverDelay?: number;
  /** Treat the content as the trigger's label (icon-only buttons) instead of a description. */
  asLabel?: boolean;
  /** Show the dotted underline used for metric labels. */
  dotted?: boolean;
}

/**
 * Tooltip shown on hover AND keyboard focus, dismissible with Escape, and hoverable
 * (WCAG 1.4.13). It describes its trigger via aria-describedby. Never put essential
 * information only in a tooltip — touch users rarely see it.
 */
export function Tooltip({ content, children, preferredPosition = "above", hoverDelay = 300, asLabel, dotted }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const { style } = useAnchoredPosition(open, wrapRef, tipRef, { alignment: "center", preferred: preferredPosition, gap: 6 });

  const show = (delay: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(true), delay);
  };
  const hide = (delay = 100) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(false), delay);
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    const el = getFocusable(wrapRef.current)[0] ?? wrapRef.current;
    if (!el) return;
    const attr = asLabel ? "aria-labelledby" : "aria-describedby";
    const prev = el.getAttribute(attr);
    const ids = new Set((prev ?? "").split(" ").filter(Boolean));
    ids.add(id);
    el.setAttribute(attr, [...ids].join(" "));
  }, [id, asLabel]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const focusable = isValidElement(children) && getFocusableLike(children);
  const trigger = focusable ? children : (
    <span tabIndex={0} className={dotted ? styles.Dotted : styles.TooltipText}>
      {children}
    </span>
  );

  return (
    <span
      ref={wrapRef}
      className={styles.TooltipWrapper}
      onPointerEnter={() => show(hoverDelay)}
      onPointerLeave={() => hide()}
      onFocus={() => show(0)}
      onBlur={() => hide(0)}
    >
      {trigger}
      {/* Always in the DOM so aria-describedby resolves; visually hidden while closed. */}
      <span
        ref={tipRef}
        id={id}
        role="tooltip"
        className={open ? styles.Tooltip : "visually-hidden"}
        style={open ? style : undefined}
        onPointerEnter={() => window.clearTimeout(timer.current)}
        onPointerLeave={() => hide()}
      >
        {content}
      </span>
    </span>
  );
}

function getFocusableLike(el: ReactElement): boolean {
  const t = el.type;
  if (typeof t === "string") return ["button", "a", "input", "select", "textarea"].includes(t);
  // Components (Button, Link…) are assumed to render a focusable element.
  return true;
}
