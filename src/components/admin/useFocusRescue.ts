"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * R6-AD (WCAG 2.4.3 focus order): after an action moves a row or card out of the current view
 * (a lead priced or closed, a bio edit decided), the button that had focus is gone and the browser
 * drops focus to <body>, so keyboard and screen-reader users restart from the top of the page.
 * Call `arm()` when such an action finishes; when `dep` next changes (the refreshed data) and focus
 * is lost, it moves to `selector` (a stable container with tabindex).
 */
export function useFocusRescue(selector: string, dep: unknown) {
  const armed = useRef(false);
  const rescue = useCallback(() => {
    const lost = !document.activeElement || document.activeElement === document.body;
    if (!lost) return;
    const el = document.querySelector<HTMLElement>(selector);
    if (el) {
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
      el.focus();
      armed.current = false;
    }
  }, [selector]);
  useEffect(() => {
    if (armed.current) rescue();
  }, [dep, rescue]);
  return useCallback(() => {
    armed.current = true;
    // The dialog may close before or after the refresh lands: try now and again on the next change.
    setTimeout(() => armed.current && rescue(), 50);
  }, [rescue]);
}
