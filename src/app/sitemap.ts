import type { MetadataRoute } from "next";
import { LOCALES } from "@/types";
import { db } from "@/lib/db";
import { siteUrl } from "@/lib/env";
import { STRUCTURE_SLUGS, seoSizeParams } from "@/components/store/catalog";
import { LEGAL_DOC_IDS } from "@/components/store/legal";
import { STRUCTURE_CODES } from "@/types";

/** sitemap.xml (owner: storefront): every public storefront URL in both languages, with hreflang alternates. */
export const revalidate = 3600;

type Entry = MetadataRoute.Sitemap[number];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl().replace(/\/$/, "");
  const now = new Date();
  const paths: { path: string; priority: number; freq: Entry["changeFrequency"] }[] = [
    { path: "", priority: 1, freq: "weekly" },
    { path: "/catalog", priority: 0.9, freq: "weekly" },
    { path: "/vendors", priority: 0.8, freq: "weekly" },
    // r6-why: the 2026 marketing pages (prices on /pricing are live, so weekly).
    { path: "/why-elba", priority: 0.8, freq: "monthly" },
    { path: "/pricing", priority: 0.9, freq: "weekly" },
    ...STRUCTURE_CODES.map((c) => ({ path: `/boxes/${STRUCTURE_SLUGS[c]}`, priority: 0.9, freq: "weekly" as const })),
    ...seoSizeParams().map((p) => ({ path: `/boxes/${p.structure}/${p.size}`, priority: 0.7, freq: "weekly" as const })),
    ...LEGAL_DOC_IDS.map((d) => ({ path: `/legal/${d}`, priority: 0.3, freq: "yearly" as const })),
  ];
  try {
    const vendors = await db.vendor.findMany({ where: { status: "ACTIVE" }, select: { slug: true } });
    for (const v of vendors) paths.push({ path: `/vendors/${v.slug}`, priority: 0.6, freq: "monthly" });
  } catch {
    // DB unavailable at build time: ship the static part of the sitemap.
  }
  return paths.flatMap(({ path, priority, freq }) =>
    LOCALES.map((locale) => ({
      url: `${base}/${locale}${path}`,
      lastModified: now,
      changeFrequency: freq,
      priority,
      alternates: { languages: Object.fromEntries(LOCALES.map((l) => [l, `${base}/${l}${path}`])) },
    })),
  );
}
