/**
 * Erasure (PDPL Law 151/2020 right to erasure): personal data that sits OUTSIDE the user's own
 * rows and that the account anonymisation in `decideDataRequestAction` used to leave behind
 * (security R5-SEC-02). Verified live: after "Complete" on a deletion request, the AuditLog still
 * held the phone number twice (`actorPhone`, `after.phone`), the IP and the free-text note of each
 * price request, the Quote kept the same note in its lines (people write phone numbers and
 * addresses there), and every DataRequest of the user kept its IP.
 *
 * What stays, on purpose: the rows themselves (who did what and when, by pseudonymous User.id, is
 * the accountability record of OWASP ASVS 4.0.3 V7.1), quantities, models and dimensions, and the
 * proof approval record (`Proof.approvedIp`), which is the evidence of the print approval for the
 * orders that tax and consumer law make us keep.
 */
import { Prisma } from "@prisma/client";

/** Keys of an audit `after`/`before` snapshot or a quote line that carry personal data. */
const PERSONAL_KEYS = new Set(["phone", "note", "notes", "name", "email", "address", "ip", "userAgent"]);
/** Quote line keys that are product labels, not a person ("name": { ar, en } of a catalogue model). */
const QUOTE_LINE_KEEP = new Set(["name"]);

type Json = Prisma.JsonValue;

function isObject(v: Json | undefined): v is Prisma.JsonObject {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** Pure: an audit snapshot without its personal fields (top level; `spec` holds the product only). */
export function scrubAuditSnapshot(v: Json | null): Json | null {
  if (!isObject(v)) return v;
  const out: Prisma.JsonObject = {};
  for (const [k, val] of Object.entries(v)) if (!PERSONAL_KEYS.has(k)) out[k] = val ?? null;
  return out;
}

/** Pure: quote lines without free text (`notes`) written by the buyer. Product names are kept. */
export function scrubQuoteLines(lines: Json): Json {
  if (!Array.isArray(lines)) return lines;
  return lines.map((l) => {
    if (!isObject(l)) return l;
    const out: Prisma.JsonObject = {};
    for (const [k, val] of Object.entries(l)) if (!PERSONAL_KEYS.has(k) || QUOTE_LINE_KEEP.has(k)) out[k] = val ?? null;
    return out;
  });
}

/** The slice of the Prisma transaction client this needs (a fake in tests). */
export type ErasureClient = Pick<Prisma.TransactionClient, "auditLog" | "quote" | "dataRequest">;

/**
 * Remove the user's phone, IP and free text from audit rows they authored, their quote lines and
 * their privacy requests. Run inside the anonymisation transaction. Returns what was touched.
 */
export async function scrubErasedUserTraces(tx: ErasureClient, userId: string): Promise<{ audit: number; quotes: number; requests: number }> {
  const audits = await tx.auditLog.findMany({ where: { actorId: userId }, select: { id: true, before: true, after: true } });
  for (const a of audits) {
    const before = scrubAuditSnapshot(a.before);
    const after = scrubAuditSnapshot(a.after);
    await tx.auditLog.update({
      where: { id: a.id },
      data: { actorPhone: null, ip: null, before: before === null ? Prisma.JsonNull : (before as Prisma.InputJsonValue), after: after === null ? Prisma.JsonNull : (after as Prisma.InputJsonValue) },
    });
  }
  const quotes = await tx.quote.findMany({ where: { userId }, select: { id: true, lines: true } });
  for (const q of quotes) await tx.quote.update({ where: { id: q.id }, data: { lines: scrubQuoteLines(q.lines) as Prisma.InputJsonValue } });
  const requests = await tx.dataRequest.updateMany({ where: { userId }, data: { ip: null } });
  return { audit: audits.length, quotes: quotes.length, requests: requests.count };
}
