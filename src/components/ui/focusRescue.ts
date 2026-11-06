import { useEffect } from "react";

/**
 * Focus rescue for a control that is removed from the page while it has focus (a list row's
 * "Remove", a banner action that closes the banner, a form replaced by its confirmation).
 * Browsers drop focus to <body>, so keyboard and screen-reader users lose their place
 * (WCAG 2.4.3 Focus order; a11y R6-AX-01).
 *
 * Call `captureFocusRescue(el)` while `el` is still in the document (a layout-effect cleanup runs
 * before React detaches the node). It records the focusable elements after `el` and then before
 * it, inside the same dialog when there is one. One frame later, and only if focus really did
 * fall to <body> (the caller's own focus management always wins: an effect, a Modal returning
 * focus, a step heading focused in requestAnimationFrame) and the page did not navigate, the
 * first recorded element that is still connected and focusable gets focus.
 */
const TABBABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), summary';

function usable(el: HTMLElement): boolean {
  if (!el.isConnected || el.closest("[inert],[aria-hidden=true]")) return false;
  if (el.matches(":disabled")) return false;
  return el.getClientRects().length > 0;
}

export function captureFocusRescue(el: HTMLElement | null): void {
  if (!el || typeof document === "undefined" || document.activeElement !== el) return;
  const root = el.closest<HTMLElement>('[role="dialog"],[role="alertdialog"],dialog') ?? document.body;
  const all = Array.from(root.querySelectorAll<HTMLElement>(TABBABLE)).filter((x) => x !== el && !el.contains(x));
  const after: HTMLElement[] = [];
  const before: HTMLElement[] = [];
  for (const x of all) {
    if (el.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING) after.push(x);
    else before.push(x);
  }
  const candidates = [...after.slice(0, 25), ...before.reverse().slice(0, 25)];
  const href = window.location.href;
  requestAnimationFrame(() => {
    const active = document.activeElement;
    if (active && active !== document.body) return;
    if (window.location.href !== href) return;
    candidates.find(usable)?.focus();
  });
}

/**
 * Focus across a remount (a form keyed by its stored `updatedAt` re-mounts after a save and
 * router.refresh(), so the field being edited is replaced and focus falls to <body>). Before the
 * refresh, `rememberFocusedField(el)`; the remounted form calls `useRestoreRememberedFocus()` and,
 * if focus is still lost, the control at the same position in <main> gets it (ids from useId are
 * not stable across a client remount, positions are: the form renders the same structure).
 */
const FIELDS = "input:not([type=hidden]), select, textarea, button";
let remembered: number | null = null;
export function rememberFocusedField(el: HTMLElement | null | undefined): void {
  const root = el?.closest("main") ?? document.body;
  const i = el ? Array.from(root.querySelectorAll<HTMLElement>(FIELDS)).indexOf(el) : -1;
  remembered = i >= 0 ? i : null;
}
export function useRestoreRememberedFocus(): void {
  useEffect(() => {
    const i = remembered;
    if (i === null) return;
    remembered = null;
    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (active && active !== document.body) return;
      const root = document.querySelector("main") ?? document.body;
      root.querySelectorAll<HTMLElement>(FIELDS)[i]?.focus();
    });
  }, []);
}
