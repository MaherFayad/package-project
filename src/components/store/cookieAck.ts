"use client";

import { useState, useSyncExternalStore } from "react";

/**
 * Cookie-notice acknowledgement, shared by the marketing CookieBar and the store CookieNotice.
 * Kept in its own module (no CSS, no UI kit) so importing it from the marketing chrome does not
 * pull SiteChrome.module.css and the whole Polaris kit into every marketing page's
 * render-blocking CSS (R2-MK-01).
 */
export const COOKIE_ACK = "elba_cookie_ack";

function acknowledged(): boolean {
  try {
    return document.cookie.split("; ").some((c) => c === `${COOKIE_ACK}=1`);
  } catch {
    return true;
  }
}

const noopSubscribe = () => () => undefined;

/**
 * Whether the notice was already acknowledged. The server (and hydration) assume "no", so the
 * notice is in the server HTML and paints with the first frame instead of after hydration
 * (it was the late LCP element). COOKIE_HIDE_SCRIPT hides it before paint for returning
 * visitors; after hydration this reads the real cookie and unmounts it.
 */
export function useCookieAck(): [boolean, () => void] {
  const ack = useSyncExternalStore(noopSubscribe, acknowledged, () => false);
  const [dismissed, setDismissed] = useState(false);
  const dismiss = () => {
    document.cookie = `${COOKIE_ACK}=1; path=/; max-age=31536000; samesite=lax`;
    setDismissed(true);
  };
  return [ack || dismissed, dismiss];
}

/** Inline, runs during HTML parse right after the notice: hides it if the ack cookie exists. */
export const COOKIE_HIDE_SCRIPT = `(function(s){try{if(document.cookie.split("; ").indexOf("${COOKIE_ACK}=1")>-1){s.previousElementSibling.style.display="none"}}catch(e){}})(document.currentScript)`;
