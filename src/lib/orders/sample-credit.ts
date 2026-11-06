/**
 * Sample-credit bookkeeping (B-05) shared by `sampleCreditFor()` and order placement in ./service.
 * Takes the Prisma client or a transaction client, so the claim can run inside the order transaction.
 */

/** The subset of the Prisma client these helpers use (a full client or a transaction client). */
/** Orders that hold a credit: anything not cancelled, except unpaid orders whose quote has expired. */
export type LiveOrderWhere = {
  number: { in: string[] };
  OR: [{ status: { notIn: string[] } }, { status: "PENDING_PAYMENT"; quote: { validUntil: { gt: Date } } }];
};

export interface SampleCreditClient {
  order: {
    count(args: { where: LiveOrderWhere }): Promise<number>;
    findUnique(args: {
      where: { id: string };
      select: { status: true; updatedAt: true; productionEvents: { where: { type: "NOTE"; note: { startsWith: string } }; select: { note: true } } };
    }): Promise<{ status: string; updatedAt: Date; productionEvents: { note: string | null }[] } | null>;
    updateMany(args: { where: { id: string; updatedAt: Date }; data: { updatedAt: Date } }): Promise<{ count: number }>;
  };
}

export const SAMPLE_CREDITED_PREFIX = "SAMPLE_CREDITED:";

/**
 * Is a sample's credit used by a live order? Reads its `SAMPLE_CREDITED:<number>` notes.
 * Live = not cancelled, and not an unpaid order whose quote has expired (R4-12): the order is
 * created at proof approval, before payment, so a buyer who approved and walked away used to lose
 * the credit for good (startPayment refuses an expired quote, so that order can never be paid).
 */
export async function sampleCreditInUse(client: Pick<SampleCreditClient, "order">, notes: { note: string | null }[], now = new Date()): Promise<boolean> {
  const usedBy = notes.map((e) => (e.note ?? "").slice(SAMPLE_CREDITED_PREFIX.length)).filter(Boolean);
  if (!usedBy.length) return false;
  const where: LiveOrderWhere = {
    number: { in: usedBy },
    OR: [{ status: { notIn: ["CANCELLED", "PENDING_PAYMENT"] } }, { status: "PENDING_PAYMENT", quote: { validUntil: { gt: now } } }],
  };
  return (await client.order.count({ where })) > 0;
}

/**
 * Claim a sample credit inside the order transaction (technical R4-02). `sampleCreditFor()` runs
 * before the transaction, so two orders placed at once (double click, two tabs) both saw the credit
 * unused and both took it (live: one 750 EGP credit on 3 orders). Here usage is re-checked inside the
 * transaction (serialised writers on SQLite see the first claim) and the sample order row is claimed
 * with an optimistic lock on `updatedAt` (concurrent writers on Postgres: the second conditional
 * update matches 0 rows). Returns false when the credit can no longer be used; the caller fails the
 * placement so the buyer re-prices instead of paying a total they were not shown.
 * OWASP ASVS 4.0.3 V11.1.6 (concurrency of business logic), money integrity.
 */
export async function claimSampleCredit(tx: SampleCreditClient, sampleOrderId: string, now: Date): Promise<boolean> {
  const sample = await tx.order.findUnique({
    where: { id: sampleOrderId },
    select: { status: true, updatedAt: true, productionEvents: { where: { type: "NOTE", note: { startsWith: SAMPLE_CREDITED_PREFIX } }, select: { note: true } } },
  });
  if (!sample || ["CANCELLED", "REFUNDED", "PENDING_PAYMENT"].includes(sample.status)) return false;
  if (await sampleCreditInUse(tx, sample.productionEvents, now)) return false;
  const lock = await tx.order.updateMany({ where: { id: sampleOrderId, updatedAt: sample.updatedAt }, data: { updatedAt: now } });
  return lock.count === 1;
}
