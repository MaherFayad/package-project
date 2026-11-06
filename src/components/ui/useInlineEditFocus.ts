"use client";

import { useEffect, useRef } from "react";

/**
 * Focus management for an inline "Edit → form → Cancel/Save" swap (WCAG 2.4.3 Focus order;
 * a11y R5-AX-06). When `open` turns true the opener button unmounts, so focus would fall to
 * <body>: move it to the first field of the form. When it turns false again (cancel or saved),
 * return focus to the opener. Only acts on a change of `open`, never on first render.
 *
 *   const { containerRef, openerRef } = useInlineEditFocus(open);
 *   {!open ? <Button ref={openerRef} …/> : <form ref={containerRef}>…</form>}
 */
export function useInlineEditFocus<C extends HTMLElement = HTMLFormElement>(
  open: boolean,
) {
  const containerRef = useRef<C | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const prev = useRef(open);
  useEffect(() => {
    if (prev.current === open) return;
    prev.current = open;
    const active = document.activeElement;
    // Only steer focus that would otherwise be lost (on <body>) or still sits in the swapped part.
    const lost =
      !active ||
      active === document.body ||
      (containerRef.current?.contains(active) ?? false);
    if (open) {
      if (!lost) return;
      containerRef.current
        ?.querySelector<HTMLElement>(
          "input:not([type=hidden]):not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled)",
        )
        ?.focus();
    } else if (!active || active === document.body) {
      openerRef.current?.focus();
    }
  }, [open]);
  return { containerRef, openerRef };
}
