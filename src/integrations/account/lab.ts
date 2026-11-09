import { prisma } from "@/lib/prisma";
import type { AccountService } from "./types";

export const labAccountService: AccountService = {
  async findOrCreateByPhone(phone, name) {
    const existing = await prisma.customerAccount.findUnique({ where: { phone } });
    if (existing) {
      if (name && !existing.name) {
        return prisma.customerAccount.update({
          where: { id: existing.id },
          data: { name },
        });
      }
      return existing;
    }
    return prisma.customerAccount.create({
      data: { phone, name: name || null },
    });
  },
  async getById(id) {
    return prisma.customerAccount.findUnique({ where: { id } });
  },
  async getByPhone(phone) {
    return prisma.customerAccount.findUnique({ where: { phone } });
  },
};
