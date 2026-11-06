"use client";

import { useState, useSyncExternalStore } from "react";

/**
 * Cookie-notice acknowledgement, used by the one cookie notice (src/components/ui/CookieNotice.tsx).
 * Kept in its own module (no CSS, no UI kit) so importing it from the marketing chrome does not
 * pull the whole Polaris kit into every marketing page's
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

/**
 * Inline, runs during HTML parse right after the notice: hides it if the ack cookie exists.
 * Otherwise, while the web fonts are still loading, it reserves the notice's first-paint height
 * (R5-PL-16): the notice is anchored to the bottom, so a font swap that shortened its text moved
 * its top edge (a layout shift). The reservation is released on the first tap or key press (shifts
 * right after input do not count) or on a resize.
 */
export const COOKIE_HIDE_SCRIPT = `(function(s){try{var n=s.previousElementSibling;if(document.cookie.split("; ").indexOf("${COOKIE_ACK}=1")>-1){n.style.display="none";return}if(document.fonts&&document.fonts.status!=="loaded"){n.style.minBlockSize=n.offsetHeight+"px";var u=function(){n.style.minBlockSize="";removeEventListener("pointerdown",u,true);removeEventListener("keydown",u,true);removeEventListener("resize",u)};addEventListener("pointerdown",u,true);addEventListener("keydown",u,true);addEventListener("resize",u)}}catch(e){}})(document.currentScript)`;
