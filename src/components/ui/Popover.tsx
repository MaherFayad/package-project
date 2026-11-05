"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { useAnchoredPosition, type Alignment } from "./useAnchor";
import { cx, getFocusable } from "./utils";
import styles from "./Popover.module.css";

export interface PopoverProps {
  active: boolean;
  /** The element that toggles the popover (usually a Button with `disclosure`). */
  activator: ReactNode;
  onClose: (source: "escape" | "outside" | "focusout") => void;
  children?: ReactNode;
  preferredAlignment?: Alignment;
  preferredPosition?: "below" | "above";
  /** Where focus goes on open: the first focusable node in the panel (default), the panel itself, or nowhere. */
  autofocusTarget?: "first-node" | "container" | "none";
  /** Fixed panel width in rem; otherwise sized to content (min 12rem). */
  fullWidth?: boolean;
  /** Accessible name for the panel (role=dialog when it holds a form, otherwise a plain group). */
  ariaLabel?: string;
  ariaHaspopup?: "menu" | "listbox" | "dialog" | "true";
  className?: string;
}

/**
 * Popover: white panel, radius 12, shadow 300. Closes on Escape (focus returns to the
 * activator), outside pointer down, and when focus leaves both activator and panel.
 */
export function Popover({
  active,
  activator,
  onClose,
  children,
  preferredAlignment = "start",
  preferredPosition = "below",
  autofocusTarget = "first-node",
  fullWidth,
  ariaLabel,
  ariaHaspopup = "true",
  className,
}: PopoverProps) {
  const id = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { style } = useAnchoredPosition(active, anchorRef, panelRef, {
    alignment: preferredAlignment,
    preferred: preferredPosition,
  });
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Mirror state onto the activator's focusable element.
  useEffect(() => {
    const el = getFocusable(anchorRef.current)[0];
    if (!el) return;
    el.setAttribute("aria-expanded", String(active));
    el.setAttribute("aria-controls", id);
    el.setAttribute("aria-haspopup", ariaHaspopup);
  }, [active, id, ariaHaspopup]);

  // Focus management on open.
  useEffect(() => {
    if (!active || autofocusTarget === "none") return;
    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const target = autofocusTarget === "first-node" ? getFocusable(panel)[0] : undefined;
      (target ?? panel).focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [active, autofocusTarget]);

  // Outside pointer down.
  useEffect(() => {
    if (!active) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) onCloseRef.current("outside");
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [active]);

  return (
    <div
      ref={wrapRef}
      className={cx(styles.Wrapper, className)}
      onKeyDown={(e) => {
        if (active && e.key === "Escape") {
          e.stopPropagation();
          onClose("escape");
          getFocusable(anchorRef.current)[0]?.focus();
        }
      }}
      onBlur={(e) => {
        if (!active) return;
        const next = e.relatedTarget as Node | null;
        if (next && wrapRef.current && !wrapRef.current.contains(next)) onClose("focusout");
      }}
    >
      <div ref={anchorRef} className={styles.Activator}>
        {activator}
      </div>
      {active ? (
        <div
          ref={panelRef}
          id={id}
          tabIndex={-1}
          aria-label={ariaLabel}
          role={ariaHaspopup === "dialog" ? "dialog" : undefined}
          className={cx(styles.Panel, fullWidth && styles.fullWidth)}
          style={style}
        >
          <div className={styles.Content}>{children}</div>
        </div>
      ) : null}
    </div>
  );
}

/** Padded content area inside a popover. */
export function PopoverPane({ children, padded = true }: { children?: ReactNode; padded?: boolean }) {
  return <div className={cx(styles.Pane, padded && styles.padded)}>{children}</div>;
}
