import "server-only";
import { db } from "@/lib/db";
import { fromJson } from "@/lib/json";
import { toGovernorateKey, type GovernorateKey } from "./governorates";

/**
 * Price requests above the instant cap (B-15, checkout half). Each is a `Quote` with status
 * REQUESTED (zero totals, one line carrying the quantity) plus a QUOTE_REQUEST audit row with the
 * details (governorate, needed-by date, note, phone, spec snapshot). This reader is what the admin
 * "quote leads" inbox lists; the SLA is one working day (24 h shown as a timer).
 */
export const QUOTE_REQUESTED = "REQUESTED";
export const QUOTE_REQUEST_SLA_HOURS = 24;

export interface QuoteRequestLead {
  quoteId: string;
  createdAt: Date;
  /** Reply due (createdAt + 24 h). */
  dueAt: Date;
  /** Request closes (no reply) after this. */
  validUntil: Date;
  status: string;
  quantity: number;
  designId: string | null;
  buyer: { id: string | null; name: string | null; phone: string | null };
  /** Governorate code (CAIRO, GIZA…); label with `governorates.<code>`. */
  governorate: GovernorateKey | null;
  neededBy: string | null;
  note: string | null;
  spec: Record<string, unknown> | null;
}

export async function listQuoteRequests(opts: { status?: string; take?: number } = {}): Promise<QuoteRequestLead[]> {
  const quotes = await db.quote.findMany({
    where: { status: opts.status ?? QUOTE_REQUESTED },
    orderBy: { createdAt: "desc" },
    take: opts.take ?? 100,
    include: { user: { select: { id: true, name: true, phone: true } } },
  });
  if (!quotes.length) return [];
  const audits = await db.auditLog.findMany({ where: { action: "QUOTE_REQUEST", entityType: "QUOTE", entityId: { in: quotes.map((q) => q.id) } } });
  const byId = new Map(audits.map((a) => [a.entityId, fromJson<Record<string, unknown>>(a.after) ?? {}]));
  return quotes.map((q) => {
    const lines = fromJson<{ quantity?: number }[]>(q.lines);
    const d = byId.get(q.id) ?? {};
    const str = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : null);
    return {
      quoteId: q.id,
      createdAt: q.createdAt,
      dueAt: new Date(q.createdAt.getTime() + QUOTE_REQUEST_SLA_HOURS * 3_600_000),
      validUntil: q.validUntil,
      status: q.status,
      quantity: Array.isArray(lines) ? (lines[0]?.quantity ?? 0) : 0,
      designId: q.designId,
      buyer: { id: q.user?.id ?? null, name: q.user?.name ?? null, phone: q.user?.phone ?? str("phone") },
      // Code, also for leads stored before codes were enforced (they held the English name).
      governorate: toGovernorateKey(str("governorate")),
      neededBy: str("neededBy"),
      note: str("note"),
      spec: d.spec && typeof d.spec === "object" ? (d.spec as Record<string, unknown>) : null,
    };
  });
}
