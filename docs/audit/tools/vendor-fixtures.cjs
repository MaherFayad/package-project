/**
 * Vendor audit fixture (idempotent): a paid Nile Pack job for a family model (FEFCO 0203, priced on
 * the FEFCO 0201 card), so the job inbox and job detail can be checked against a library model.
 *   node docs/audit/tools/vendor-fixtures.cjs        (removes and re-creates ELB-26290)
 */
const { PrismaClient } = require("@prisma/client");
const path = require("node:path");
const db = new PrismaClient({ datasources: { db: { url: process.env.ELBA_DATABASE_URL || `file:${path.resolve(__dirname, "../../../prisma/dev.db")}` } } });
const NUMBER = "ELB-26290";

(async () => {
  const src = await db.order.findUniqueOrThrow({ where: { number: "ELB-26202" }, include: { items: true, productionEvents: true } });
  await db.order.deleteMany({ where: { number: NUMBER } });
  const { id: _id, number: _n, items, productionEvents, ...rest } = src;
  const it = items[0];
  const o = await db.order.create({
    data: {
      ...rest,
      number: NUMBER,
      shippingAddress: rest.shippingAddress ?? undefined,
      items: {
        create: [{
          structureCode: "FEFCO_0201",
          modelCode: "FEFCO_0203",
          dims: { L: 300, W: 200, H: 150 },
          materialCode: it.materialCode,
          finishCode: it.finishCode,
          printSides: it.printSides,
          quantity: 500,
          unitPiasters: it.unitPiasters,
          lineTotalPiasters: it.unitPiasters * 500,
          proofId: it.proofId,
        }],
      },
      productionEvents: { create: productionEvents.map((e) => ({ type: e.type, note: e.note, actorId: e.actorId, createdAt: e.createdAt })) },
    },
  });
  console.log("created", o.number);
  await db.$disconnect();
})();
