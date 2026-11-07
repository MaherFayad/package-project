// Eager model library: doc helpers below read the registry (PERF-04).
import "@/lib/library";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { MAX_INSTANT_QTY, QTY_TIERS, type ShippingAddress } from "@/types";
import { getT, toLocale, type DictKey } from "@/i18n";
import { boxName } from "@/lib/orders/box-name";
import { modelPoster } from "@/lib/orders/poster";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { fromJson } from "@/lib/json";
import { formatEgyptPhone } from "@/lib/phone";
import { designerReference, loadCheckoutDesign, loadPricedQuote, minOrderQuantity, quoteDesign, sampleCreditFor, sampleOffers, tierPrices, toCheckoutOffer } from "@/lib/orders/service";
import { designerPath } from "@/components/designer/lib/catalog";
import { loadCheckoutSettings } from "@/lib/orders/checkout-settings";
import { quoteGovernorate } from "@/lib/orders/quote-requests";
import { orderTotals } from "@/lib/orders/totals";
import { orderModeOf } from "@/data/catalogue/order-mode";
import { docGeometry } from "@/lib/library/doc";
import { runPreflight, summarizePreflight } from "@/components/designer/lib/preflight";
import { docSpec } from "@/lib/library/spec";
import { track } from "@/lib/analytics/track";
import { rateLimit } from "@/lib/rate-limit";
import { supportContact } from "@/lib/support";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState, EmptyBoxIllustration } from "@/components/ui/EmptyState";
import { Page } from "@/components/ui/Page";
import { CheckoutClient, type AddressState } from "../_components/CheckoutClient";
import type { OffersResult } from "../actions";

type Params = Promise<{ locale: string; designId: string }>;

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getT(toLocale(locale))("checkout.title"), robots: { index: false } };
}

/**
 * /[locale]/checkout/[designId] — quantity + printer, delivery address, proof approval.
 * Signed-in owners only (soft gate G2). Prices are computed on the server; the browser only
 * ever sees buyer prices (no vendor cost or margin).
 */
export default async function CheckoutPage({ params, searchParams }: { params: Params; searchParams: Promise<{ share?: string | string[]; quote?: string | string[] }> }) {
  const { locale: raw, designId } = await params;
  const locale = toLocale(raw);
  const t = getT(locale);
  const sp = await searchParams;
  const shareRaw = sp.share;
  const share = Array.isArray(shareRaw) ? shareRaw[0] : shareRaw;
  const quoteParam = Array.isArray(sp.quote) ? sp.quote[0] : sp.quote;
  const self = `/${locale}/checkout/${encodeURIComponent(designId)}${share ? `?share=${encodeURIComponent(share)}` : quoteParam ? `?quote=${encodeURIComponent(quoteParam)}` : ""}`;
  const user = await requireUser(locale, self);
  const design = await loadCheckoutDesign(designId, user);

  // Ordering from a share link (/[locale]/s/[token]): the visitor does not own the design, so
  // give them their own copy (the shared original stays read-only) and check out that copy.
  if (!design && share && /^[\w-]{1,64}$/.test(share) && /^[\w-]{1,64}$/.test(designId)) {
    const src = await db.design.findFirst({ where: { id: designId, shareToken: share } });
    if (src) {
      // Re-opening the same share link must not pile up duplicate copies in the buyer's designs.
      const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
      const mine = await db.design.findMany({
        where: { ownerId: user.id, structureCode: src.structureCode, modelCode: src.modelCode, name: src.name, materialId: src.materialId, finishCode: src.finishCode, printSides: src.printSides },
        orderBy: { updatedAt: "desc" },
        take: 20,
        select: { id: true, dims: true, artwork: true, config: true },
      });
      const existing = mine.find((d) => same(d.dims, src.dims) && same(d.artwork, src.artwork) && same(d.config, src.config));
      if (existing) redirect(`/${locale}/checkout/${encodeURIComponent(existing.id)}`);
      const copy = await db.design.create({
        data: {
          ownerId: user.id,
          name: src.name,
          structureCode: src.structureCode,
          // The library model and its options travel with the copy: without them a quote-only
          // model (aseptic brick, crash-lock…) became its instantly priced base box (B-16, R4-01).
          modelCode: src.modelCode,
          ...(src.config != null ? { config: src.config as Prisma.InputJsonValue } : {}),
          dims: src.dims as Prisma.InputJsonValue,
          materialId: src.materialId,
          finishCode: src.finishCode,
          printSides: src.printSides,
          artwork: src.artwork as Prisma.InputJsonValue,
          thumbnailUrl: src.thumbnailUrl,
        },
        select: { id: true },
      });
      redirect(`/${locale}/checkout/${encodeURIComponent(copy.id)}`);
    }
  }

  if (!design) {
    return (
      <Page title={t("checkout.title")} narrowWidth>
        <Card>
          <EmptyState
            heading={t("checkout.notFound.title")}
            image={<EmptyBoxIllustration />}
            action={
              <Button variant="primary" url={`/${locale}/checkout`}>
                {t("checkout.start.title")}
              </Button>
            }
          >
            {t("checkout.notFound.body")}
          </EmptyState>
        </Card>
      </Page>
    );
  }

  const { doc } = design;
  // Prefill the address from the last order, else from the account.
  const last = await db.order.findFirst({ where: { buyerId: user.id }, orderBy: { placedAt: "desc" }, select: { shippingAddress: true } });
  const prev = last ? fromJson<Partial<ShippingAddress>>(last.shippingAddress) : null;
  const defaultAddress: AddressState = {
    name: prev?.name ?? user.name ?? "",
    phone: prev?.phone ? formatEgyptPhone(prev.phone) : formatEgyptPhone(user.phone),
    governorate: prev?.governorate ?? "Cairo",
    city: prev?.city ?? "",
    street: prev?.street ?? "",
    building: prev?.building ?? "",
    floor: prev?.floor ?? "",
    apartment: prev?.apartment ?? "",
    landmark: prev?.landmark ?? "",
    notes: "",
  };

  // R4-B-03: a price the team sent for this buyer's request on this design (link from the
  // WhatsApp/SMS or the account). It fixes quantity, printer, total and delivery governorate.
  const priced = quoteParam ? await loadPricedQuote(quoteParam, user, designId) : null;
  if (priced) {
    const leadGov = await quoteGovernorate(priced.id);
    if (leadGov) defaultAddress.governorate = leadGov;
  }
  const tiers = await tierPrices(doc, defaultAddress.governorate);
  // B-16: a model no Egyptian SME printer makes is never ordered here, not even as a paid sample.
  const byQuote = ["quote", "preview"].includes(orderModeOf(doc.modelCode).mode);
  const initialQty = tiers.find((x) => x.quantity === 500 && x.unitPiasters !== null)?.quantity ?? tiers.find((x) => x.unitPiasters !== null)?.quantity ?? QTY_TIERS[0];
  const [settings, credit, org, minQty] = await Promise.all([
    loadCheckoutSettings(),
    sampleCreditFor(user.id, designId),
    db.user.findUnique({ where: { id: user.id }, select: { organization: { select: { name: true, taxId: true, commercialRegister: true } } } }),
    minOrderQuantity(),
  ]);
  // Same production preflight as the designer (B-04), run on the server.
  const geo = docGeometry(doc);
  const issues = geo ? runPreflight(doc, geo.dieline) : [];
  const sum = summarizePreflight(issues);
  const preflight = { ready: sum.ready, errors: sum.errors, warnings: sum.warnings, issues: issues.map((i) => ({ code: i.code, severity: i.severity, face: i.face })) };
  let initial: OffersResult;
  try {
    const outcome = await quoteDesign(doc, { quantity: initialQty, governorate: defaultAddress.governorate });
    const prepay = settings.prepayDiscountPct;
    const reference = outcome.mode === "instant" ? await designerReference(doc, initialQty, defaultAddress.governorate, prepay).catch(() => null) : null;
    initial =
      outcome.mode === "instant"
        ? {
            ok: true,
            mode: "instant",
            quantity: initialQty,
            offers: outcome.offers.map((o) => toCheckoutOffer(o, prepay, { creditPiasters: credit?.piasters })),
            suggestion: outcome.suggestion,
            validUntil: outcome.validUntil,
            credit: credit ? { piasters: credit.piasters, sampleNumber: credit.sampleNumber, expiresAt: credit.expiresAt.toISOString() } : null,
            reference,
          }
        : { ok: true, mode: "manual_quote", quantity: initialQty, max: MAX_INSTANT_QTY, ...(outcome.reason === "MODEL_BY_QUOTE" ? { reason: "MODEL_BY_QUOTE" as const, orderReason: outcome.orderReason } : {}) };
  } catch {
    initial = { ok: false, error: "generic" };
  }
  if (priced) {
    initial = {
      ok: true,
      mode: "instant",
      quantity: priced.quantity,
      offers: [{ ...priced.publicOffer, pay: orderTotals(priced.publicOffer.lines, 0) }],
      suggestion: null,
      validUntil: priced.validUntil.toISOString(),
    };
  }

  // launch-metrics.md §1 `order_started` ("Order this exact box" / checkout opened) and the
  // checkout half of `price_viewed` (the tier table above is an instant price). A reload within
  // 10 minutes is the same visit.
  if (rateLimit("analytics:checkout", `${user.id}:${designId}`, 1, 600_000).ok) {
    const props = { locale, structure_code: doc.structureCode, model_code: doc.modelCode ?? null };
    void track("order_started", props, { userId: user.id, designId });
    if (initial.ok && initial.mode === "instant") void track("price_viewed", { ...props, source: "checkout", quantity: initialQty }, { userId: user.id, designId });
  }

  // R2-09: the sample row shows what the sample costs in full (delivery and VAT in), as /pricing does,
  // from the same offer checkout charges when the sample is picked (sampleOffers → no prepay discount).
  const sampleOn = !priced && settings.sample.enabled && !byQuote && !(initial.ok && initial.mode === "manual_quote" && initial.reason === "MODEL_BY_QUOTE");
  const sampleBest = sampleOn ? ((await sampleOffers(doc, defaultAddress.governorate).catch(() => null))?.offers[0] ?? null) : null;
  const sampleTotal = sampleBest ? orderTotals(sampleBest.lines, 0).totalPiasters : null;

  // R1-18: a design without its own name is called by its box and size, never "Untitled box".
  const spec = docSpec(doc, locale);
  const boxLabel = boxName({ modelCode: doc.modelCode, structureCode: doc.structureCode, dims: doc.dims, size: spec.vesselSize }, locale, t(`structures.${doc.structureCode}` as DictKey));

  return (
    <CheckoutClient
      locale={locale}
      designId={designId}
      doc={doc}
      designName={doc.name.trim() || boxLabel}
      boxLabel={boxLabel}
      thumbnail={design.thumbnailUrl ?? modelPoster(doc.modelCode, doc.structureCode)}
      editUrl={designerPath(locale, doc.modelCode ?? doc.structureCode, { d: designId })}
      tiers={tiers}
      initialQty={priced ? priced.quantity : initialQty}
      initial={initial}
      defaultAddress={defaultAddress}
      spec={spec}
      contactPhone={formatEgyptPhone(user.phone)}
      quoted={priced ? { id: priced.id, quantity: priced.quantity, validUntil: priced.validUntil.toISOString() } : null}
      quoteInvalid={!!quoteParam && !priced}
      sample={sampleOn ? { pieces: settings.sample.maxPieces, pricePiasters: settings.sample.pricePiasters, totalPiasters: sampleTotal, creditDays: settings.sample.creditDays } : null}
      prepayDiscountPct={settings.prepayDiscountPct}
      minQty={minQty}
      preflight={preflight}
      defaultCompany={org?.organization ? { name: org.organization.name, taxId: org.organization.taxId ?? "", commercialRegister: org.organization.commercialRegister ?? "" } : null}
      support={supportContact()}
    />
  );
}
