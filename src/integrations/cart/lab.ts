import { prisma } from "@/lib/prisma";
import type { CartService } from "./types";

const failSkus = () =>
  (process.env.CART_FAIL_PRODUCT_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export const labCartService: CartService = {
  async addCustomOrderLine(input) {
    if (failSkus().includes(input.productSku)) {
      throw new Error("خطای آزمایشی افزودن به سبد (CART_FAIL_PRODUCT_IDS).");
    }

    const existing = await prisma.labCartItem.findUnique({
      where: { customOrderId: input.customOrderId },
    });
    if (existing) return existing;

    try {
      return await prisma.labCartItem.create({
        data: {
          customerId: input.customerId,
          customOrderId: input.customOrderId,
          productSku: input.productSku,
          title: input.title,
          quantity: 1,
        },
      });
    } catch (e: unknown) {
      // race: unique on customOrderId
      const again = await prisma.labCartItem.findUnique({
        where: { customOrderId: input.customOrderId },
      });
      if (again) return again;
      throw e;
    }
  },

  async listByCustomer(customerId) {
    return prisma.labCartItem.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
    });
  },

  async removeById(id, customerId) {
    const item = await prisma.labCartItem.findFirst({ where: { id, customerId } });
    if (!item) return;
    await prisma.labCartItem.delete({ where: { id } });
  },
};
