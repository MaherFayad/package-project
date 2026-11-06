"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackVisitOnce } from "./client";

/**
 * Renders nothing; sends one `visit` per browsing session (launch-metrics.md §1). Runs on every
 * route change too, so client-side navigation keeps the session alive (only the first view after
 * 30 idle minutes counts).
 */
export function VisitBeacon({ locale }: { locale: string }) {
  const pathname = usePathname();
  useEffect(() => {
    trackVisitOnce({ locale });
  }, [locale, pathname]);
  return null;
}
