"use client";

import { X } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useUi } from "./AppProvider";
import { Button } from "./Button";
import { cx, getFocusable } from "./utils";
import styles from "./Modal.module.css";

export interface ModalAction {
  content: ReactNode;
  onAction?: () => void;
  url?: string;
  disabled?: boolean;
  loading?: boolean;
  destructive?: boolean;
  /** Submit a form inside the modal (pair with `form` id). */
  submit?: boolean;
}

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Hide the title visually but keep it as the dialog's accessible name. */
  titleHidden?: boolean;
  /** Icon/badge next to the title (e.g. an info Tooltip). */
  titleMetadata?: ReactNode;
  children?: ReactNode;
  primaryAction?: ModalAction;
  secondaryActions?: ModalAction[];
  /** Custom content on the start side of the footer (e.g. a help link). */
  footer?: ReactNode;
  size?: "small" | "medium" | "large" | "fullScreen";
  /** Body without padding (lists, tables, media). */
  flush?: boolean;
  /** Element that should get focus on open (defaults to the dialog itself so the title is read first). */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /** Pressing Escape / clicking the backdrop closes unless this is true (e.g. while saving). */
  preventClose?: boolean;
  id?: string;
}

/** Exit is --motion-fast (150ms); the fallback unmounts if animationend never fires
 *  (background tab, reduced motion edge cases, test environments). */
const EXIT_FALLBACK_MS = 250;

/**
 * Modal dialog (Polaris anatomy): header (title + × close) / divider / body / divider / footer
 * with secondary then primary on the inline end. Focus is trapped while open and returned
 * to the opener on close; the rest of the page is made inert.
 */
export function Modal({
  open,
  onClose,
  title,
  titleHidden,
  titleMetadata,
  children,
  primaryAction,
  secondaryActions,
  footer,
  size = "medium",
  flush,
  initialFocusRef,
  preventClose,
  id,
}: ModalProps) {
  const { s } = useUi();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Exit (CR-17): when `open` turns false the dialog stays mounted for its 150ms exit. Derived
  // during render (not in an effect) so there is no frame where it unmounts and remounts.
  const [shownOpen, setShownOpen] = useState(open);
  const [closing, setClosing] = useState(false);
  if (open !== shownOpen) {
    setShownOpen(open);
    setClosing(!open);
  }
  useEffect(() => {
    if (!closing) return;
    const t = window.setTimeout(() => setClosing(false), EXIT_FALLBACK_MS);
    return () => window.clearTimeout(t);
  }, [closing]);

  // Open: remember opener, focus inside, lock scroll, make siblings inert. The cleanup runs as
  // soon as `open` turns false, so focus is back on the opener and the page is interactive
  // while the exit plays; the leaving dialog is aria-hidden and ignores the pointer meanwhile.
  // Layout effect, not effect: it runs before the dialog is painted. With a passive effect a Tab
  // pressed between paint and effect (slow device, lazy-loaded dialog) moved focus past the
  // opener, which was then remembered as the return target (2.4.3, R4-K05).
  useLayoutEffect(() => {
    if (!open || !mounted) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    (initialFocusRef?.current ?? dialog)?.focus({ preventScroll: true });

    const portalRoot = dialog?.closest("[data-modal-root]");
    const siblings = Array.from(document.body.children).filter(
      (el) => el !== portalRoot && !el.hasAttribute("inert") && el.tagName !== "SCRIPT",
    ) as HTMLElement[];
    siblings.forEach((el) => el.setAttribute("inert", ""));
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      siblings.forEach((el) => el.removeAttribute("inert"));
      document.body.style.overflow = prevOverflow;
    };
  }, [open, mounted, initialFocusRef]);

  // Focus goes back to the opener from a passive cleanup: layout cleanups run inside React's
  // mutation phase, after which React re-focuses whatever was focused before the commit (the
  // closing dialog, still mounted for its exit), which would undo the restore.
  useEffect(() => {
    if (!open || !mounted) return;
    return () => {
      const r = restoreRef.current;
      if (r && document.contains(r)) r.focus({ preventScroll: true });
    };
  }, [open, mounted]);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (closing) return;
    if (e.key === "Escape") {
      e.stopPropagation();
      if (!preventClose) onClose();
      return;
    }
    if (e.key !== "Tab") return;
    const nodes = getFocusable(dialogRef.current);
    if (nodes.length === 0) {
      e.preventDefault();
      dialogRef.current?.focus();
      return;
    }
    const first = nodes[0]!;
    const last = nodes[nodes.length - 1]!;
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === dialogRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  if (!mounted || (!open && !closing)) return null;

  const hasFooter = primaryAction || (secondaryActions && secondaryActions.length) || footer;

  return createPortal(
    <div
      data-modal-root=""
      data-state={open ? "open" : "closing"}
      className={styles.Root}
      aria-hidden={open ? undefined : true}
      onAnimationEnd={(e) => {
        if (!open && e.target === dialogRef.current) setClosing(false);
      }}
    >
      <div className={styles.Backdrop} aria-hidden="true" onClick={() => open && !preventClose && onClose()} />
      <div className={styles.Container}>
        <div
          ref={dialogRef}
          id={id}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className={cx(styles.Dialog, styles[`size-${size}`])}
          onKeyDown={onKeyDown}
        >
          <div className={cx(styles.Header, titleHidden && styles.headerHidden)}>
            <h2 id={titleId} className={cx(styles.Title, titleHidden && "visually-hidden")}>
              {title}
            </h2>
            {titleMetadata && !titleHidden ? <span className={styles.TitleMeta}>{titleMetadata}</span> : null}
            <span className={styles.Close}>
              <Button variant="tertiary" className={styles.CloseButton} icon={X} accessibilityLabel={s.close} onClick={onClose} />
            </span>
          </div>
          <div className={cx(styles.Body, flush && styles.flush)}>{children}</div>
          {hasFooter ? (
            <div className={styles.Footer}>
              <div className={styles.FooterStart}>{footer}</div>
              <div className={styles.FooterActions}>
                {secondaryActions?.map((a, i) => (
                  <Button key={i} onClick={a.onAction} url={a.url} disabled={a.disabled} loading={a.loading} tone={a.destructive ? "critical" : undefined}>
                    {a.content}
                  </Button>
                ))}
                {primaryAction ? (
                  <Button
                    variant="primary"
                    tone={primaryAction.destructive ? "critical" : undefined}
                    onClick={primaryAction.onAction}
                    url={primaryAction.url}
                    disabled={primaryAction.disabled}
                    loading={primaryAction.loading}
                    submit={primaryAction.submit}
                  >
                    {primaryAction.content}
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
