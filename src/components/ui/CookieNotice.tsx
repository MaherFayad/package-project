"use client";

import NextLink from "next/link";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
// Acknowledgement lives in a dependency-free module (no CSS, no UI kit) so the marketing chrome
// does not pull the Polaris kit into its render-blocking CSS (R2-MK-01).
import { COOKIE_ACK, COOKIE_HIDE_SCRIPT, useCookieAck } from "@/components/store/cookieAck";
import { uiStrings } from "./strings";
import styles from "./CookieNotice.module.css";

export { COOKIE_ACK, COOKIE_HIDE_SCRIPT, useCookieAck };

/** Exit fade length; matches --p-motion-duration-150 (0 under reduced motion, see the CSS). */
const EXIT_MS = 150;

/**
 * The one essential-cookies notice (CR-06), used by every buyer-facing shell. We set no
 * advertising cookies, so this is information, not a consent wall. Shown once per browser.
 *
 * White surface card at the bottom inline-start (full width on phones), rises in over 200 ms and
 * fades out over 150 ms (no movement under prefers-reduced-motion). While it is shown it never
 * covers content (WCAG 2.4.11): it publishes its height as `--e-cookie-h` on <html> (shell
 * footers add it to their bottom padding) and as scroll padding, so a focused control is always
 * scrolled clear of it.
 */
export function CookieNotice() {
  const { t, locale } = useI18n();
  const [ack, dismiss] = useCookieAck();
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);
  const show = !ack || (leaving && !gone);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    const el = ref.current;
    if (!show || leaving || !el) return;
    const apply = () => {
      const h = el.offsetHeight + 16;
      root.style.setProperty("--e-cookie-h", `${h}px`);
      root.style.scrollPaddingBlockEnd = `${h + 16}px`;
    };
    apply();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(apply) : null;
    ro?.observe(el);
    // Scroll padding only helps when the browser scrolls. A control that is already inside the
    // viewport but under the notice gets focus without any scroll and stays hidden (2.4.11,
    // R4-K01: "Other quantity" at checkout on a 390 px phone). Move it clear of the notice.
    // Keyboard focus only: scrolling between pointerdown and pointerup would move the target
    // out from under the pointer and swallow the click (a pointer user can see what they hit).
    let pointerDown = false;
    let padded = false;
    const onPointerDown = () => (pointerDown = true);
    const onPointerUp = () => (pointerDown = false);
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target;
      if (pointerDown || !(target instanceof HTMLElement) || el.contains(target)) return;
      if (!target.matches(":focus-visible")) return;
      const n = el.getBoundingClientRect();
      const r = target.getBoundingClientRect();
      const under = (b: DOMRect) => b.bottom > n.top && b.top < n.bottom && b.right > n.left && b.left < n.right;
      if (!under(r)) return;
      window.scrollBy({ top: r.bottom - n.top + 16, behavior: "instant" as ScrollBehavior });
      // R6-AX-13: at the end of the page there is nothing left to scroll (a shell footer without
      // the `--e-cookie-h` padding, e.g. the last footer links on a phone). Add the room here.
      const r2 = target.getBoundingClientRect();
      if (under(r2)) {
        padded = true;
        root.style.paddingBlockEnd = `${el.offsetHeight + 32}px`;
        window.scrollBy({ top: r2.bottom - n.top + 16, behavior: "instant" as ScrollBehavior });
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("pointercancel", onPointerUp, true);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("pointercancel", onPointerUp, true);
      document.removeEventListener("focusin", onFocusIn);
      ro?.disconnect();
      root.style.removeProperty("--e-cookie-h");
      root.style.scrollPaddingBlockEnd = "";
      if (padded) root.style.paddingBlockEnd = "";
    };
  }, [show, leaving]);

  useEffect(() => {
    if (!leaving) return;
    const id = window.setTimeout(() => setGone(true), EXIT_MS + 50);
    return () => window.clearTimeout(id);
  }, [leaving]);

  if (!show) return null;
  return (
    <>
      <div
        ref={ref}
        className={styles.notice}
        // Stable hook for page layouts that keep their primary CTA clear of the notice (2.4.11).
        data-cookie-notice=""
        data-leaving={leaving ? "true" : undefined}
        role="region"
        // Kit string, not store.cookie.label: that equals the /legal/cookies page title, and two
        // landmarks with one name on that page fail 1.3.1 / landmark-unique (R4-K02).
        aria-label={uiStrings[locale === "ar" ? "ar" : "en"].cookieBanner}
        onAnimationEnd={(e) => {
          if (leaving && e.target === e.currentTarget) setGone(true);
        }}
        suppressHydrationWarning
      >
        <p className={styles.text}>
          {t("store.cookie.message")}{" "}
          <NextLink href={`/${locale}/legal/cookies`} className={styles.more}>
            {t("store.cookie.more")}
          </NextLink>
        </p>
        <button
          type="button"
          className={styles.ok}
          onClick={() => {
            dismiss();
            setLeaving(true);
          }}
        >
          {t("store.cookie.ok")}
        </button>
      </div>
      <script dangerouslySetInnerHTML={{ __html: COOKIE_HIDE_SCRIPT }} />
    </>
  );
}
