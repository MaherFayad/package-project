import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { devPagesEnabled } from "@/lib/env";
import { FinishesDevClient } from "./FinishesDevClient";

export const metadata: Metadata = {
  title: "Finishes dev view",
  robots: { index: false, follow: false },
};

/** Developer page: configurator rules + 3D finishes (foil, spot UV, emboss), stage contexts and motion. */
export default function FinishesDevPage() {
  // Developer tool: hidden in production unless explicitly enabled.
  if (!devPagesEnabled()) notFound();
  return <FinishesDevClient />;
}
