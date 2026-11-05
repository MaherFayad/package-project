import { describe, expect, it } from "vitest";
import { breadcrumbJsonLd, egpString, faqJsonLd, productJsonLd, serializeJsonLd, vendorJsonLd } from "../jsonld";
import { buildDataExport, exportFileName, parseProfile } from "../account-logic";
import { LEGAL_DOCS, isLegalDoc, paragraphs } from "../legal";
import { en } from "@/i18n/en";
import { ar } from "@/i18n/ar";

describe("JSON-LD", () => {
  it("builds a Product with an EGP AggregateOffer", () => {
    const p = productJsonLd({
      name: "علبة بريدية مطبوعة 25×18×8 سم",
      description: "d",
      url: "https://x/ar/boxes/mailer-box/250x180x80",
      image: "https://x/i.svg",
      sku: "FEFCO_0427-250x180x80",
      brand: "علبة",
      lowPiasters: 1950,
      highPiasters: 4205,
      offerCount: 3,
      priceValidUntil: "2026-11-08T10:00:00.000Z",
      size: { L: 250, W: 180, H: 80 },
    });
    expect(p["@type"]).toBe("Product");
    expect(p.offers).toMatchObject({ "@type": "AggregateOffer", priceCurrency: "EGP", lowPrice: "19.50", highPrice: "42.05", offerCount: 3, priceValidUntil: "2026-11-08" });
    expect(productJsonLd({ name: "n", description: "d", url: "u", image: "i", sku: "s", brand: "b" }).offers).toBeUndefined();
  });

  it("formats piasters as EGP strings", () => {
    expect(egpString(0)).toBe("0.00");
    expect(egpString(123456)).toBe("1234.56");
  });

  it("builds breadcrumbs, FAQ and vendor organisation", () => {
    const b = breadcrumbJsonLd([{ name: "A", url: "/a" }, { name: "B", url: "/b" }]) as { itemListElement: { position: number }[] };
    expect(b.itemListElement.map((i) => i.position)).toEqual([1, 2]);
    expect((faqJsonLd([{ q: "Q", a: "A" }]) as { mainEntity: unknown[] }).mainEntity).toHaveLength(1);
    expect(vendorJsonLd({ name: "V", url: "u", city: "Cairo", description: "d", rating: 4.66, ratingCount: 9 }).aggregateRating).toMatchObject({ ratingValue: "4.7" });
    expect(vendorJsonLd({ name: "V", url: "u", city: "Cairo", description: "d", rating: 0, ratingCount: 0 }).aggregateRating).toBeUndefined();
  });

  it("escapes </script> so JSON-LD cannot break out of its tag", () => {
    const s = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(s).not.toContain("</script>");
    expect(JSON.parse(s).name).toBe("</script><script>alert(1)</script>");
  });
});

describe("account logic", () => {
  it("validates the profile form", () => {
    expect(parseProfile({ name: "  Mona  ", email: " Mona@Example.COM " })).toEqual({ ok: true, data: { name: "Mona", email: "mona@example.com" } });
    expect(parseProfile({ name: "", email: "" })).toEqual({ ok: true, data: { name: null, email: null } });
    const bad = parseProfile({ name: "x".repeat(81), email: "not-an-email" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.fieldErrors).toEqual({ name: "nameTooLong", email: "emailInvalid" });
  });

  it("exports only the user's own data, with ISO dates", () => {
    const at = new Date("2026-11-05T10:00:00Z");
    const doc = buildDataExport(
      {
        user: { id: "u1", phone: "+201000000002", name: "Mona", email: null, role: "BUYER", locale: "ar", marketingConsent: true, createdAt: at },
        consents: [{ kind: "MARKETING", granted: true, textVersion: "v", locale: "ar", createdAt: at }],
        designs: [{ id: "d1", name: "Bloom", structureCode: "FEFCO_0427", dims: { L: 1, W: 1, H: 1 }, finishCode: "NONE", printSides: "OUTSIDE", artwork: {}, createdAt: at, updatedAt: at }],
        orders: [{ number: "ELB-1", status: "PAID", totalPiasters: 100, vatPiasters: 14, shippingAddress: {}, placedAt: at, items: [{ structureCode: "FEFCO_0427", dims: {}, materialCode: "E_FLUTE_KRAFT", quantity: 100, unitPiasters: 1 }] }],
        reviews: [],
        requests: [{ kind: "EXPORT", status: "COMPLETED", createdAt: at }],
      },
      at,
    );
    expect(doc.generatedAt).toBe("2026-11-05T10:00:00.000Z");
    expect(doc.profile.phone).toBe("+201000000002");
    expect(doc.orders[0]).not.toHaveProperty("vendorCostPiasters");
    expect(JSON.stringify(doc)).not.toContain("vendorCost");
    expect(exportFileName("+201000000002", at)).toBe("elba-data-0002-2026-11-05.json");
  });
});

describe("legal documents", () => {
  it("every section has a title and body in both languages", () => {
    for (const [doc, ids] of Object.entries(LEGAL_DOCS)) {
      expect(isLegalDoc(doc)).toBe(true);
      for (const lang of [en, ar]) {
        const d = (lang.legal as unknown as Record<string, { title: string; intro: string; sections: Record<string, { title: string; body: string }> }>)[doc];
        expect(d.title.length).toBeGreaterThan(3);
        for (const id of ids) {
          expect(d.sections[id]?.title, `${doc}.${id}`).toBeTruthy();
          expect(paragraphs(d.sections[id].body).length).toBeGreaterThan(0);
        }
      }
    }
    expect(isLegalDoc("constructor")).toBe(false);
    expect(isLegalDoc("refunds")).toBe(false);
  });

  it("marks the privacy policy as PDPL-aware", () => {
    expect(en.legal.privacy.intro).toContain("151");
    expect(ar.legal.privacy.intro).toContain("151");
  });
});
