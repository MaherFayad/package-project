/**
 * Account area logic (owner: storefront). Pure: zod schemas for the account forms and the
 * PDPL data-export document builder. Server actions in app/[locale]/(store)/account use these.
 */
import { cleanDisplayName } from "@/lib/auth/display-name";
import { z } from "zod";

export const DATA_REQUEST_KINDS = ["EXPORT", "DELETE"] as const;
export type DataRequestKind = (typeof DATA_REQUEST_KINDS)[number];
export const DATA_REQUEST_STATUSES = ["OPEN", "IN_PROGRESS", "COMPLETED", "REJECTED"] as const;
export type DataRequestStatus = (typeof DATA_REQUEST_STATUSES)[number];

/** Error codes map to `account.errors.<code>` in the dictionaries. */
export type AccountErrorCode = "generic" | "invalid" | "unauthorized" | "notFound" | "rateLimited" | "emailInvalid" | "nameTooLong";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: AccountErrorCode; fieldErrors?: Partial<Record<"name" | "email", AccountErrorCode>> };

export const profileSchema = z.object({
  name: z
    .string()
    // R5-SEC-11: control and bidi-override characters removed before the length check.
    .transform(cleanDisplayName)
    .pipe(z.string().max(80, { message: "nameTooLong" }))
    .transform((v) => (v === "" ? null : v)),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, { message: "emailInvalid" })
    .refine((v) => v === "" || z.string().email().safeParse(v).success, { message: "emailInvalid" })
    .transform((v) => (v === "" ? null : v)),
});
export type ProfileInput = z.infer<typeof profileSchema>;

/** Parse the profile form. Field errors carry dictionary codes. */
export function parseProfile(form: { name?: unknown; email?: unknown }): ActionResult<ProfileInput> {
  const r = profileSchema.safeParse({ name: form.name ?? "", email: form.email ?? "" });
  if (r.success) return { ok: true, data: r.data };
  const fieldErrors: Partial<Record<"name" | "email", AccountErrorCode>> = {};
  for (const issue of r.error.issues) {
    const key = issue.path[0];
    if (key === "name" || key === "email") fieldErrors[key] = (issue.message as AccountErrorCode) ?? "invalid";
  }
  return { ok: false, error: "invalid", fieldErrors };
}

export const consentSchema = z.object({ granted: z.boolean() });
export const designIdSchema = z.string().trim().min(1).max(64).regex(/^[a-z0-9]+$/i);

// ───────────────────────────── PDPL data export ─────────────────────────────

export interface ExportSource {
  user: { id: string; phone: string; name: string | null; email: string | null; role: string; locale: string; marketingConsent: boolean; createdAt: Date };
  organization?: { name: string; taxId: string | null; commercialRegister: string | null; city: string | null } | null;
  consents: { kind: string; granted: boolean; textVersion: string; locale: string; createdAt: Date }[];
  designs: { id: string; name: string; structureCode: string; dims: unknown; finishCode: string; printSides: string; artwork: unknown; createdAt: Date; updatedAt: Date }[];
  orders: {
    number: string;
    status: string;
    totalPiasters: number;
    vatPiasters: number;
    shippingAddress: unknown;
    placedAt: Date;
    items: { structureCode: string; dims: unknown; materialCode: string; quantity: number; unitPiasters: number }[];
  }[];
  reviews: { rating: number; body: string | null; createdAt: Date }[];
  requests: { kind: string; status: string; createdAt: Date }[];
  /** R5-SEC-03: price requests and offers (with the notes the buyer wrote), disputes, signed-in devices. */
  quotes?: { status: string; lines: unknown; totalPiasters: number; validUntil: Date; createdAt: Date }[];
  disputes?: { reason: string; description: string; status: string; resolution: string | null; createdAt: Date }[];
  sessions?: { ip: string | null; userAgent: string | null; createdAt: Date; expiresAt: Date }[];
}

/** Quote line fields a buyer may see (never a vendor cost or margin, whatever a line carries). */
const QUOTE_LINE_FIELDS = ["kind", "type", "labelKey", "modelCode", "name", "standard", "presetId", "dims", "quantity", "notes", "unitPiasters", "totalPiasters"] as const;

function exportQuoteLines(lines: unknown): Record<string, unknown>[] {
  if (!Array.isArray(lines)) return [];
  return lines
    .filter((l): l is Record<string, unknown> => !!l && typeof l === "object" && !Array.isArray(l))
    .map((l) => Object.fromEntries(QUOTE_LINE_FIELDS.filter((k) => k in l).map((k) => [k, l[k]])));
}

/**
 * The JSON document a user downloads under their PDPL right of access. Contains only the
 * user's own data; never vendor costs, margins, other users or internal ids of other parties.
 */
export function buildDataExport(src: ExportSource, generatedAt: Date = new Date()) {
  const iso = (d: Date) => d.toISOString();
  return {
    format: "elba-personal-data-export",
    version: 1,
    generatedAt: iso(generatedAt),
    law: "Egypt Personal Data Protection Law No. 151 of 2020",
    profile: {
      phone: src.user.phone,
      name: src.user.name,
      email: src.user.email,
      role: src.user.role,
      language: src.user.locale,
      marketingConsent: src.user.marketingConsent,
      createdAt: iso(src.user.createdAt),
    },
    organization: src.organization ?? null,
    consents: src.consents.map((c) => ({ kind: c.kind, granted: c.granted, textVersion: c.textVersion, locale: c.locale, at: iso(c.createdAt) })),
    designs: src.designs.map((d) => ({
      id: d.id,
      name: d.name,
      structureCode: d.structureCode,
      dims: d.dims,
      finishCode: d.finishCode,
      printSides: d.printSides,
      artwork: d.artwork,
      createdAt: iso(d.createdAt),
      updatedAt: iso(d.updatedAt),
    })),
    orders: src.orders.map((o) => ({
      number: o.number,
      status: o.status,
      totalPiasters: o.totalPiasters,
      vatPiasters: o.vatPiasters,
      shippingAddress: o.shippingAddress,
      placedAt: iso(o.placedAt),
      items: o.items.map((i) => ({ structureCode: i.structureCode, dims: i.dims, materialCode: i.materialCode, quantity: i.quantity, unitPiasters: i.unitPiasters })),
    })),
    reviews: src.reviews.map((r) => ({ rating: r.rating, body: r.body, at: iso(r.createdAt) })),
    privacyRequests: src.requests.map((r) => ({ kind: r.kind, status: r.status, at: iso(r.createdAt) })),
    priceRequests: (src.quotes ?? []).map((q) => ({ status: q.status, lines: exportQuoteLines(q.lines), totalPiasters: q.totalPiasters, validUntil: iso(q.validUntil), at: iso(q.createdAt) })),
    disputes: (src.disputes ?? []).map((d) => ({ reason: d.reason, description: d.description, status: d.status, resolution: d.resolution, at: iso(d.createdAt) })),
    signedInDevices: (src.sessions ?? []).map((x) => ({ ip: x.ip, userAgent: x.userAgent, since: iso(x.createdAt), expires: iso(x.expiresAt) })),
  };
}

export function exportFileName(phone: string, at: Date = new Date()): string {
  const digits = phone.replace(/\D/g, "").slice(-4);
  return `elba-data-${digits}-${at.toISOString().slice(0, 10)}.json`;
}
