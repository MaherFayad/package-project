import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { MAX_INSTANT_QTY, QTY_TIERS, type ShippingAddress } from "@/types";
import { getT, toLocale } from "@/i18n";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { fromJson } from "@/lib/json";
import { formatEgyptPhone } from "@/lib/phone";
import { loadCheckoutDesign, quoteDesign, tierPrices, toCheckoutOffer } from "@/lib/orders/service";
import { designerPath } from "@/components/designer/lib/catalog";
import { Button, Card, EmptyState, EmptyBoxIllustration, Page } from "@/components/ui";
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
export default async function CheckoutPage({ params, searchParams }: { params: Params; searchParams: Promise<{ share?: string | string[] }> }) {
  const { locale: raw, designId } = await params;
  const locale = toLocale(raw);
  const t = getT(locale);
  const shareRaw = (await searchParams).share;
  const share = Array.isArray(shareRaw) ? shareRaw[0] : shareRaw;
  const self = `/${locale}/checkout/${encodeURIComponent(designId)}${share ? `?share=${encodeURIComponent(share)}` : ""}`;
  const user = await requireUser(locale, self);
  const design = await loadCheckoutDesign(designId, user);

  // Ordering from a share link (/[locale]/s/[token]): the visitor does not own the design, so
  // give them their own copy (the shared original stays read-only) and check out that copy.
  if (!design && share && /^[\w-]{1,64}$/.test(share) && /^[\w-]{1,64}$/.test(designId)) {
    const src = await db.design.findFirst({ where: { id: designId, shareToken: share } });
    if (src) {
      const copy = await db.design.create({
        data: {
          ownerId: user.id,
          name: src.name,
          structureCode: src.structureCode,
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

  const tiers = await tierPrices(doc, defaultAddress.governorate);
  const initialQty = tiers.find((x) => x.quantity === 500 && x.unitPiasters !== null)?.quantity ?? tiers.find((x) => x.unitPiasters !== null)?.quantity ?? QTY_TIERS[0];
  let initial: OffersResult;
  try {
    const outcome = await quoteDesign(doc, { quantity: initialQty, governorate: defaultAddress.governorate });
    initial =
      outcome.mode === "instant"
        ? { ok: true, mode: "instant", quantity: initialQty, offers: outcome.offers.map(toCheckoutOffer), suggestion: outcome.suggestion, validUntil: outcome.validUntil }
        : { ok: true, mode: "manual_quote", quantity: initialQty, max: MAX_INSTANT_QTY };
  } catch {
    initial = { ok: false, error: "generic" };
  }

  return (
    <CheckoutClient
      locale={locale}
      designId={designId}
      doc={doc}
      designName={doc.name || t("checkout.untitled")}
      editUrl={designerPath(locale, doc.structureCode, { d: designId })}
      tiers={tiers}
      initialQty={initialQty}
      initial={initial}
      defaultAddress={defaultAddress}
    />
  );
}
