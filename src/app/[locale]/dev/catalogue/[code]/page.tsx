import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { catalogueEntryFromParam } from "@/data/catalogue";
import { RenderClient } from "./RenderClient";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Chrome-free render of one catalogue model on a transparent square stage. Used by
 * scripts/render-catalogue-thumbnails.ts (writes public/models/<code>.webp) and the per-model
 * e2e (e2e/catalogue-models.spec.ts). `data-ready="true"` once the model is drawn.
 */
export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const e = catalogueEntryFromParam((await params).code);
  if (!e) notFound();
  return <RenderClient code={e.code} render={e.render} source={e.source} />;
}
