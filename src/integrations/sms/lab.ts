import { prisma } from "@/lib/prisma";
import type { SmsService } from "./types";

export const labSmsService: SmsService = {
  async enqueue(input) {
    try {
      await prisma.smsMessage.create({
        data: {
          phone: input.phone,
          body: input.body,
          idempotencyKey: input.idempotencyKey,
          templateKey: input.templateKey,
          orderId: input.orderId,
          status: "queued",
        },
      });
    } catch {
      // duplicate idempotencyKey — ignore
    }
  },

  async processQueue(limit = 20) {
    const queued = await prisma.smsMessage.findMany({
      where: { status: "queued" },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
    let sent = 0;
    for (const msg of queued) {
      try {
        console.log(
          `[SMS:lab] to=${msg.phone} key=${msg.idempotencyKey} template=${msg.templateKey}\n${msg.body}`
        );
        await prisma.smsMessage.update({
          where: { id: msg.id },
          data: {
            status: "sent",
            attempts: { increment: 1 },
            sentAt: new Date(),
            lastError: null,
          },
        });
        sent += 1;
      } catch (e: unknown) {
        const err = e instanceof Error ? e.message : String(e);
        await prisma.smsMessage.update({
          where: { id: msg.id },
          data: {
            status: "failed",
            attempts: { increment: 1 },
            lastError: err,
          },
        });
      }
    }
    return sent;
  },
};
