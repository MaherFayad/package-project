/**
 * schema.org JSON-LD builders for SEO pages (owner: storefront). Pure.
 * Money arrives in piasters and is written as a decimal EGP string ("19.50").
 */
import type { Piasters } from "@/types";

type Json = Record<string, unknown>;

export function egpString(p: Piasters): string {
  return (Math.round(p) / 100).toFixed(2);
}

export interface ProductJsonLdInput {
  name: string;
  description: string;
  url: string;
  image: string;
  sku: string;
  brand: string;
  /** Lowest and highest per-box price (ex-VAT) across the quantity tiers. */
  lowPiasters?: Piasters | null;
  highPiasters?: Piasters | null;
  offerCount?: number;
  /** ISO date the shown prices are valid until. */
  priceValidUntil?: string;
  material?: string;
  /** Inner size in mm. */
  size?: { L: number; W: number; H: number };
}

export function productJsonLd(p: ProductJsonLdInput): Json {
  const out: Json = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.description,
    url: p.url,
    image: p.image,
    sku: p.sku,
    brand: { "@type": "Brand", name: p.brand },
  };
  if (p.material) out.material = p.material;
  if (p.size) {
    out.depth = { "@type": "QuantitativeValue", value: p.size.W, unitCode: "MMT" };
    out.width = { "@type": "QuantitativeValue", value: p.size.L, unitCode: "MMT" };
    out.height = { "@type": "QuantitativeValue", value: p.size.H, unitCode: "MMT" };
  }
  if (p.lowPiasters != null) {
    out.offers = {
      "@type": "AggregateOffer",
      priceCurrency: "EGP",
      lowPrice: egpString(p.lowPiasters),
      highPrice: egpString(p.highPiasters ?? p.lowPiasters),
      offerCount: p.offerCount ?? 1,
      availability: "https://schema.org/MadeToOrder",
      ...(p.priceValidUntil ? { priceValidUntil: p.priceValidUntil.slice(0, 10) } : {}),
      url: p.url,
    };
  }
  return out;
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: it.url })),
  };
}

export function faqJsonLd(qa: { q: string; a: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: qa.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };
}

export function vendorJsonLd(v: {
  name: string;
  url: string;
  logo?: string | null;
  city: string;
  description: string;
  rating?: number;
  ratingCount?: number;
}): Json {
  const out: Json = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: v.name,
    url: v.url,
    description: v.description,
    address: { "@type": "PostalAddress", addressLocality: v.city, addressCountry: "EG" },
  };
  if (v.logo) out.logo = v.logo;
  if (v.rating && v.ratingCount) {
    out.aggregateRating = { "@type": "AggregateRating", ratingValue: v.rating.toFixed(1), reviewCount: v.ratingCount, bestRating: "5" };
  }
  return out;
}

/** Serialise for <script type="application/ld+json">: escapes "<" so content cannot close the tag. */
export function serializeJsonLd(data: Json | Json[]): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
