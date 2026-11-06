// Round 6 probe data: a delivered order (dispute + photos), a refunded order, a quote lead.
// ELBA_DATABASE_URL=file:./ax6.db npx tsx docs/audit/tools/a11y-r6-setup.ts > r6-data.json
import { cloneOrder, db, SEEDED } from "../../../e2e/fixtures/factory";
(async () => {
  const buyer = await db.user.findUniqueOrThrow({ where: { phone: SEEDED.buyer } });
  const delivered = await cloneOrder("ELB-26001", { status: "DELIVERED", buyerId: buyer.id, label: "AXD" });
  await db.order.update({ where: { id: delivered.id }, data: { deliveredAt: new Date() } });
  const refunded = await cloneOrder("ELB-26001", { status: "REFUNDED", buyerId: buyer.id, label: "AXR" });
  await db.payment.updateMany({ where: { orderId: refunded.id }, data: { status: "REFUNDED" } });
  await db.productionEvent.create({ data: { orderId: refunded.id, type: "REFUNDED", note: "Refund after dispute" } }).catch(() => undefined);
  console.log(JSON.stringify({ delivered, refunded, buyerId: buyer.id }));
  await db.$disconnect();
})();
