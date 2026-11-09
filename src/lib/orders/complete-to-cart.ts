import { prisma } from "@/lib/prisma";
import { enqueueCompletedSms } from "@/lib/sms/outbox";
import { assertTransition } from "./state-machine";

/**
 * تکمیل پرونده سفارش (بدون الزام SKU / سبد).
 * از وضعیت ready یا مستقیم از مسیر موجودی پس از رسیدن به ready.
 */
export async function markOrderCompleted(orderId: string, staffId?: string) {
  const order = await prisma.customOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("سفارش یافت نشد.");
  if (order.status === "completed") {
    return { ok: true as const, already: true };
  }
  if (order.status !== "ready") {
    throw new Error("فقط سفارش‌های آماده قابل تکمیل هستند.");
  }

  assertTransition("ready", "completed");
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.customOrder.update({
      where: { id: order.id },
      data: {
        status: "completed",
        completedAt: now,
        cartAddError: null,
      },
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: "ready",
        toStatus: "completed",
        note: "تکمیل در پرونده سفارش ثبت شد.",
        actorType: staffId ? "staff" : "system",
        staffId: staffId || null,
      },
    });
  });

  await enqueueCompletedSms(order.id, order.customerPhone, order.code);
  return { ok: true as const, already: false };
}

/** @deprecated use markOrderCompleted */
export const completeOrderToCart = markOrderCompleted;
