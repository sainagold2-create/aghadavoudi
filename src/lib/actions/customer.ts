"use server";

import { revalidatePath } from "next/cache";
import { accountService, cartService } from "@/integrations";
import { ALANGO_GROUP, CONFIRM_TEXT, PRODUCT_GROUPS, PRODUCT_GROUP_LABEL } from "@/lib/constants";
import { setCustomerSession, getCustomerSession } from "@/lib/customer-session";
import { issueOtp, verifyOtp } from "@/lib/otp";
import { generateOrderCode } from "@/lib/orders/codes";
import { storePrivateFile } from "@/lib/orders/files";
import { defaultOrdersDecisionDueAt } from "@/lib/orders/tehran-day";
import { prisma } from "@/lib/prisma";
import { enqueueSubmittedSms } from "@/lib/sms/outbox";
import { normalizePhone, appBaseUrl } from "@/lib/utils";

function parseSizeLines(raw: string | null): { size: string; quantity: number }[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { size?: string; quantity?: number }[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((r) => ({
        size: String(r.size || "").trim(),
        quantity: Number(r.quantity) || 0,
      }))
      .filter((r) => r.size && r.quantity > 0);
  } catch {
    return [];
  }
}

export async function requestSubmitOtp(phoneRaw: string) {
  const phone = normalizePhone(phoneRaw);
  if (!/^09\d{9}$/.test(phone)) {
    return { ok: false as const, error: "شماره موبایل معتبر نیست." };
  }
  const { previewCode } = await issueOtp({ phone, purpose: "submit" });
  return { ok: true as const, phone, previewCode };
}

export async function submitCustomOrder(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const phone = normalizePhone(String(formData.get("phone") || ""));
  const otp = String(formData.get("otp") || "").trim();
  const productGroup = String(formData.get("productGroup") || "").trim();
  const productName = String(formData.get("productName") || "").trim() || null;
  const description = String(formData.get("description") || "").trim() || null;
  const shippingAddress = String(formData.get("shippingAddress") || "").trim();
  const confirmed = formData.get("confirmed") === "on" || formData.get("confirmed") === "true";
  const sizeLines = parseSizeLines(String(formData.get("sizeLinesJson") || ""));

  const validGroup = PRODUCT_GROUPS.some((g) => g.value === productGroup);
  if (!validGroup) {
    return { ok: false as const, error: "گروه محصول معتبر نیست." };
  }
  if (!name || !phone || !shippingAddress) {
    return { ok: false as const, error: "نام، موبایل و آدرس الزامی است." };
  }
  if (!confirmed) {
    return { ok: false as const, error: "لطفاً تأیید ساخت را بپذیرید." };
  }
  if (productGroup === ALANGO_GROUP && sizeLines.length === 0) {
    return { ok: false as const, error: "برای النگو حداقل یک سایز و تعداد لازم است." };
  }
  if (productGroup !== ALANGO_GROUP && !description) {
    return { ok: false as const, error: "برای این گروه محصول، توضیحات الزامی است." };
  }

  const session = await getCustomerSession();
  let customerId = session?.id;
  if (!customerId || session?.phone !== phone) {
    const ok = await verifyOtp({ phone, purpose: "submit", code: otp });
    if (!ok) return { ok: false as const, error: "کد تأیید نامعتبر یا منقضی است." };
  }

  const customer = await accountService.findOrCreateByPhone(phone, name);
  await setCustomerSession(customer.id);
  customerId = customer.id;

  const files = formData.getAll("designFiles").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) {
    return { ok: false as const, error: "حداقل یک فایل طرح لازم است." };
  }

  const code = generateOrderCode();
  const stored = [];
  for (const f of files) {
    stored.push(await storePrivateFile(f));
  }

  const groupLabel = PRODUCT_GROUP_LABEL[productGroup] || productGroup;
  const ordersDecisionDueAt = defaultOrdersDecisionDueAt();
  const order = await prisma.customOrder.create({
    data: {
      code,
      status: "pending_review",
      customerName: name,
      customerPhone: phone,
      productGroup,
      productName,
      description,
      shippingAddress,
      customerId,
      ordersDecisionDueAt,
      files: {
        create: stored.map((s) => ({
          originalName: s.originalName,
          storedName: s.storedName,
          mimeType: s.mimeType,
          sizeBytes: s.sizeBytes,
        })),
      },
      sizeLines:
        productGroup === ALANGO_GROUP
          ? { create: sizeLines.map((l) => ({ size: l.size, quantity: l.quantity })) }
          : undefined,
      history: {
        create: {
          fromStatus: null,
          toStatus: "pending_review",
          note: `ثبت درخواست ${groupLabel}${productName ? ` «${productName}»` : ""}. تعیین‌تکلیف حداکثر تا پایان فردا. ${CONFIRM_TEXT}`,
          metaJson: JSON.stringify({
            ordersDecisionDueAt: ordersDecisionDueAt.toISOString(),
          }),
          actorType: "customer",
        },
      },
    },
  });

  await enqueueSubmittedSms(order.id, phone, code);

  revalidatePath("/me/orders");
  return {
    ok: true as const,
    code: order.code,
    trackingUrl: `${appBaseUrl()}/track?code=${encodeURIComponent(order.code)}`,
  };
}

export async function requestTrackOtp(code: string, phoneRaw: string) {
  const phone = normalizePhone(phoneRaw);
  const order = await prisma.customOrder.findUnique({ where: { code: code.trim() } });
  if (!order || order.customerPhone !== phone) {
    return { ok: false as const, error: "سفارش با این کد و موبایل یافت نشد." };
  }
  const { previewCode } = await issueOtp({ phone, purpose: "track", orderCode: order.code });
  return { ok: true as const, previewCode };
}

export async function verifyTrackAccess(code: string, phoneRaw: string, otp: string) {
  const phone = normalizePhone(phoneRaw);
  const order = await prisma.customOrder.findUnique({
    where: { code: code.trim() },
    include: {
      history: { orderBy: { createdAt: "asc" }, include: { staff: true } },
      files: { select: { id: true, originalName: true, createdAt: true } },
    },
  });
  if (!order || order.customerPhone !== phone) {
    return { ok: false as const, error: "سفارش یافت نشد." };
  }
  const ok = await verifyOtp({ phone, purpose: "track", code: otp, orderCode: order.code });
  if (!ok) return { ok: false as const, error: "کد تأیید نامعتبر است." };
  await setCustomerSession(order.customerId);
  return { ok: true as const, order };
}

export async function loginCustomerWithOtp(phoneRaw: string, otp?: string, step?: "request" | "verify") {
  const phone = normalizePhone(phoneRaw);
  if (!/^09\d{9}$/.test(phone)) {
    return { ok: false as const, error: "شماره موبایل معتبر نیست." };
  }
  if (step === "request" || !otp) {
    const { previewCode } = await issueOtp({ phone, purpose: "login" });
    return { ok: true as const, stage: "otp" as const, previewCode };
  }
  const ok = await verifyOtp({ phone, purpose: "login", code: otp });
  if (!ok) return { ok: false as const, error: "کد تأیید نامعتبر است." };
  const customer = await accountService.findOrCreateByPhone(phone);
  await setCustomerSession(customer.id);
  return { ok: true as const, stage: "done" as const };
}

export async function removeCartItemAction(itemId: string) {
  const customer = await getCustomerSession();
  if (!customer) return { ok: false as const, error: "وارد نشده‌اید." };
  await cartService.removeById(itemId, customer.id);
  revalidatePath("/cart");
  return { ok: true as const };
}
