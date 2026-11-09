import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function completeOrderToCart(orderId) {
  const { completeOrderToCart: fn } = await import("../src/lib/orders/complete-to-cart.ts");
  return fn(orderId);
}

async function main() {
  const fail = await prisma.customOrder.findUnique({ where: { code: "SG-MTO-SEED-READY-FAIL" } });
  if (!fail) throw new Error("missing seed order");

  // ensure ready + fail sku
  await prisma.labCartItem.deleteMany({ where: { customOrderId: fail.id } });
  await prisma.smsMessage.deleteMany({ where: { orderId: fail.id, templateKey: "completed" } });
  await prisma.customOrder.update({
    where: { id: fail.id },
    data: {
      status: "ready",
      labProductId: "LAB-FAIL-CART",
      cartAddError: null,
      completedAt: null,
    },
  });

  const r1 = await completeOrderToCart(fail.id);
  const afterFail = await prisma.customOrder.findUnique({ where: { id: fail.id } });
  console.log("1_fail", r1.ok === false, afterFail.status === "ready", !!afterFail.cartAddError);

  await prisma.customOrder.update({
    where: { id: fail.id },
    data: { labProductId: "LAB-RING-001", cartAddError: null },
  });
  const r2 = await completeOrderToCart(fail.id);
  const r3 = await completeOrderToCart(fail.id);
  const carts = await prisma.labCartItem.count({ where: { customOrderId: fail.id } });
  const done = await prisma.customOrder.findUnique({ where: { id: fail.id } });
  const sms = await prisma.smsMessage.count({
    where: { orderId: fail.id, templateKey: "completed", status: "sent" },
  });
  console.log("2_success", r2.ok === true, r3.already === true, carts === 1, done.status === "completed", sms === 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
