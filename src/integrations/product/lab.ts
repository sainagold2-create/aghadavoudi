import { prisma } from "@/lib/prisma";
import type { ProductService } from "./types";

export const labProductService: ProductService = {
  async getBySku(sku) {
    const p = await prisma.labProduct.findUnique({ where: { sku } });
    if (!p) return null;
    return { sku: p.sku, title: p.title, activeStock: p.activeStock };
  },
  async assertCartAddable(sku) {
    const p = await this.getBySku(sku);
    if (!p) throw new Error(`کالای «${sku}» یافت نشد.`);
    if (!p.activeStock) throw new Error(`موجودی کالای «${sku}» فعال نیست.`);
    return p;
  },
};
