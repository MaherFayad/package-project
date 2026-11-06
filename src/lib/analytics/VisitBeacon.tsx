"use client";

import { useEffect } from "react";
import { trackVisitOnce } from "./client";

/** Renders nothing; sends one `visit` per browser session (launch-metrics.md §1). */
export function VisitBeacon({ locale }: { locale: string }) {
  useEffect(() => {
    trackVisitOnce({ locale });
  }, [locale]);
  return null;
}
