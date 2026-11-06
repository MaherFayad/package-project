"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Pill } from "@/components/marketing/kit/Pill";
import g from "./gallery.module.css";

/** Gallery controls: other locale, and a reduced-motion preview (html[data-mk-reduced]). */
export function GalleryToolbar({ locale }: { locale: "ar" | "en" }) {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const on = new URLSearchParams(window.location.search).get("motion") === "reduce";
    setReduced(on);
  }, []);
  useEffect(() => {
    const html = document.documentElement;
    if (reduced) html.setAttribute("data-mk-reduced", "");
    else html.removeAttribute("data-mk-reduced");
    return () => html.removeAttribute("data-mk-reduced");
  }, [reduced]);
  const other = locale === "ar" ? "en" : "ar";
  return (
    <div className={g.toolbar} role="group" aria-label="Gallery">
      <Link href={`/${other}/dev/kit`} hrefLang={other} className={g.toolLink}>
        {other === "ar" ? "العربية" : "English"}
      </Link>
      <Pill size="sm" variant={reduced ? "light" : "outline"} aria-pressed={reduced} onClick={() => setReduced((r) => !r)}>
        {locale === "ar" ? "معاينة تقليل الحركة" : "Preview reduced motion"}
      </Pill>
    </div>
  );
}
