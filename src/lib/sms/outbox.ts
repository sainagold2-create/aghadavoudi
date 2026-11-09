import { smsService } from "@/integrations";
import { smsCompleted, smsProductionStarted, smsSubmitted } from "./templates";

export async function enqueueSubmittedSms(orderId: string, phone: string, code: string) {
  await smsService.enqueue({
    orderId,
    phone,
    templateKey: "submitted",
    idempotencyKey: `submitted:${orderId}`,
    body: smsSubmitted(code),
  });
  await smsService.processQueue();
}

export async function enqueueProductionStartedSms(
  orderId: string,
  phone: string,
  code: string,
  readyDate?: Date | null
) {
  await smsService.enqueue({
    orderId,
    phone,
    templateKey: "production_started",
    idempotencyKey: `production_started:${orderId}`,
    body: smsProductionStarted(code, readyDate),
  });
  await smsService.processQueue();
}

export async function enqueueCompletedSms(orderId: string, phone: string, code: string) {
  await smsService.enqueue({
    orderId,
    phone,
    templateKey: "completed",
    idempotencyKey: `completed:${orderId}`,
    body: smsCompleted(code),
  });
  await smsService.processQueue();
}
