"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import {
  ALANGO_GROUP,
  isOrdersRole,
  isSupplyRole,
  PRODUCT_GROUPS,
  PRODUCT_GROUP_LABEL,
  SUPPLIER_DELAY_REASON_LABEL,
  SUPPLIER_DELAY_REASONS,
} from "@/lib/constants";
import { generateOrderCode } from "@/lib/orders/codes";
import { markOrderCompleted } from "@/lib/orders/complete-to-cart";
import { isDelayed } from "@/lib/orders/deadlines";
import { currentSupplierOverdueDays } from "@/lib/orders/delay-flags";
import { assertTransition } from "@/lib/orders/state-machine";
import { defaultOrdersDecisionDueAt } from "@/lib/orders/tehran-day";
import { prisma } from "@/lib/prisma";
import { enqueueProductionStartedSms } from "@/lib/sms/outbox";

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

async function requireStaff() {
  const session = await getServerSession(authOptions);
  const sessionId = session?.user?.id;
  const email = session?.user?.email?.toLowerCase();
  if (!sessionId && !email) throw new Error("دسترسی ادمین لازم است.");

  // بعد از seed شناسهٔ JWT ممکن است قدیمی باشد — از دیتابیس resolve می‌کنیم
  let staff = sessionId
    ? await prisma.staffUser.findUnique({ where: { id: sessionId } })
    : null;
  if (!staff && email) {
    staff = await prisma.staffUser.findUnique({ where: { email } });
  }
  if (!staff || !staff.isActive) {
    throw new Error("نشست منقضی شده؛ لطفاً دوباره وارد شوید.");
  }
  return { id: staff.id, role: staff.role, email: staff.email, name: staff.name };
}

function revalidateOrder(code: string) {
  revalidatePath("/admin");
  revalidatePath(`/admin/orders/${code}`);
  revalidatePath("/me/orders");
  revalidatePath(`/orders/${code}`);
}

async function maybeSendProgressSms(order: {
  id: string;
  customerPhone: string;
  code: string;
  customerReadyDueAt: Date | null;
  productionSmsSentAt: Date | null;
}) {
  if (order.productionSmsSentAt) return;
  await enqueueProductionStartedSms(
    order.id,
    order.customerPhone,
    order.code,
    order.customerReadyDueAt
  );
  await prisma.customOrder.update({
    where: { id: order.id },
    data: { productionSmsSentAt: new Date() },
  });
}

/** واحد سفارشات: موجود است و ثبت می‌شود */
export async function acceptInStock(formData: FormData) {
  const staff = await requireStaff();
  if (!isOrdersRole(staff.role)) {
    return { ok: false as const, error: "فقط واحد سفارشات می‌تواند این کار را انجام دهد." };
  }
  const orderId = String(formData.get("orderId"));
  const salesOwnerId = String(formData.get("salesOwnerId") || "") || staff.id;
  const customerReadyDueAtRaw = String(formData.get("customerReadyDueAt") || "");
  const nextAction = String(formData.get("nextAction") || "").trim() || null;
  const extra = String(formData.get("note") || "").trim();
  const note = extra
    ? `تأیید موجودی و ارسال به مرحله بعد. ${extra}`
    : "تأیید موجودی توسط سفارشات و ارسال به مرحله آماده‌سازی";

  const order = await prisma.customOrder.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false as const, error: "سفارش یافت نشد." };
  assertTransition(order.status, "accepted_in_stock");

  const now = new Date();
  const customerReadyDueAt = customerReadyDueAtRaw ? new Date(customerReadyDueAtRaw) : null;

  await prisma.$transaction(async (tx) => {
    await tx.customOrder.update({
      where: { id: orderId },
      data: {
        status: "accepted_in_stock",
        ordersReviewedAt: now,
        salesOwnerId,
        customerReadyDueAt,
        nextAction,
        stopReason: null,
      },
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        fromStatus: order.status,
        toStatus: "accepted_in_stock",
        note,
        metaJson: JSON.stringify({
          action: "accept_in_stock",
          at: now.toISOString(),
          customerReadyDueAt: customerReadyDueAt?.toISOString() || null,
        }),
        actorType: "staff",
        staffId: staff.id,
      },
    });
  });

  const updated = await prisma.customOrder.findUniqueOrThrow({ where: { id: orderId } });
  await maybeSendProgressSms(updated);
  revalidateOrder(order.code);
  return { ok: true as const };
}

/** واحد سفارشات: ارسال به واحد تأمین */
export async function sendToSupply(formData: FormData) {
  const staff = await requireStaff();
  if (!isOrdersRole(staff.role)) {
    return { ok: false as const, error: "فقط واحد سفارشات می‌تواند این کار را انجام دهد." };
  }
  const orderId = String(formData.get("orderId"));
  const salesOwnerId = String(formData.get("salesOwnerId") || "") || staff.id;
  const supplierDueAtRaw = String(formData.get("supplierDueAt") || "");
  const extra = String(formData.get("note") || "").trim();
  if (!supplierDueAtRaw) {
    return { ok: false as const, error: "هنگام ارجاع به تأمین، ثبت تاریخ تحویل الزامی است." };
  }
  const supplierDueAt = new Date(supplierDueAtRaw);
  const note = extra
    ? `ارجاع به تأمین با تاریخ تحویل. ${extra}`
    : `ارجاع به واحد تأمین — تاریخ تحویل ثبت شد (${supplierDueAt.toISOString().slice(0, 10)})`;

  const order = await prisma.customOrder.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false as const, error: "سفارش یافت نشد." };
  assertTransition(order.status, "awaiting_supply");

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.customOrder.update({
      where: { id: orderId },
      data: {
        status: "awaiting_supply",
        ordersReviewedAt: now,
        salesOwnerId,
        supplierDueAt,
        nextAction: "بررسی امکان تأمین و پیگیری تاریخ تحویل",
        stopReason: null,
      },
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        fromStatus: order.status,
        toStatus: "awaiting_supply",
        note,
        metaJson: JSON.stringify({
          action: "send_to_supply",
          at: now.toISOString(),
          supplierDueAt: supplierDueAt.toISOString(),
        }),
        actorType: "staff",
        staffId: staff.id,
      },
    });
  });

  revalidateOrder(order.code);
  return { ok: true as const };
}

/** واحد تأمین: رد — نمی‌شود ثبت کرد */
export async function rejectBySupply(formData: FormData) {
  const staff = await requireStaff();
  if (!isSupplyRole(staff.role)) {
    return { ok: false as const, error: "فقط واحد تأمین می‌تواند این کار را انجام دهد." };
  }
  const orderId = String(formData.get("orderId"));
  const reason = String(formData.get("reason") || "").trim();
  if (!reason) return { ok: false as const, error: "علت رد الزامی است." };

  const order = await prisma.customOrder.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false as const, error: "سفارش یافت نشد." };
  assertTransition(order.status, "supply_rejected");

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.customOrder.update({
      where: { id: orderId },
      data: {
        status: "supply_rejected",
        supplyReviewedAt: now,
        supplyOwnerId: staff.id,
        stopReason: reason,
        nextAction: "اطلاع به مشتری / بستن پرونده",
      },
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        fromStatus: order.status,
        toStatus: "supply_rejected",
        note: `رد توسط واحد تأمین — نمی‌شود ثبت کرد. علت: ${reason}`,
        metaJson: JSON.stringify({ action: "supply_reject", at: now.toISOString() }),
        actorType: "staff",
        staffId: staff.id,
      },
    });
  });

  revalidateOrder(order.code);
  return { ok: true as const };
}

/** واحد تأمین: تأیید و سفارش به تأمین‌کننده */
export async function orderFromSupplier(formData: FormData) {
  const staff = await requireStaff();
  if (!isSupplyRole(staff.role)) {
    return { ok: false as const, error: "فقط واحد تأمین می‌تواند این کار را انجام دهد." };
  }
  const orderId = String(formData.get("orderId"));
  const supplierName = String(formData.get("supplierName") || "").trim();
  const supplierDueAtRaw = String(formData.get("supplierDueAt") || "");
  const customerReadyDueAtRaw = String(formData.get("customerReadyDueAt") || "");
  const note = String(formData.get("note") || "").trim() || undefined;

  if (!supplierName) return { ok: false as const, error: "نام تأمین‌کننده الزامی است." };

  const order = await prisma.customOrder.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false as const, error: "سفارش یافت نشد." };
  assertTransition(order.status, "awaiting_supplier");

  const now = new Date();
  const supplierDueAt = supplierDueAtRaw
    ? new Date(supplierDueAtRaw)
    : order.supplierDueAt;
  if (!supplierDueAt) {
    return { ok: false as const, error: "تاریخ تحویل تأمین‌کننده ثبت نشده است." };
  }
  const customerReadyDueAt = customerReadyDueAtRaw
    ? new Date(customerReadyDueAtRaw)
    : order.customerReadyDueAt;

  await prisma.$transaction(async (tx) => {
    await tx.customOrder.update({
      where: { id: orderId },
      data: {
        status: "awaiting_supplier",
        supplyReviewedAt: now,
        supplyOwnerId: staff.id,
        supplierName,
        supplierDueAt,
        customerReadyDueAt,
        supplierConfirmedAt: null,
        supplierRejectedAt: null,
        stopReason: null,
        nextAction: "پیگیری تأیید و رسیدن از تأمین‌کننده",
      },
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        fromStatus: order.status,
        toStatus: "awaiting_supplier",
        note:
          note ||
          `تأیید واحد تأمین و ارسال به تأمین‌کننده «${supplierName}» (موعد: ${supplierDueAt.toISOString().slice(0, 10)})`,
        metaJson: JSON.stringify({
          action: "order_from_supplier",
          at: now.toISOString(),
          supplierName,
          supplierDueAt: supplierDueAt.toISOString(),
          customerReadyDueAt: customerReadyDueAt?.toISOString() || null,
        }),
        actorType: "staff",
        staffId: staff.id,
      },
    });
  });

  const updated = await prisma.customOrder.findUniqueOrThrow({ where: { id: orderId } });
  await maybeSendProgressSms(updated);
  revalidateOrder(order.code);
  return { ok: true as const };
}

/** واحد تأمین: ثبت تأیید تأمین‌کننده */
export async function confirmSupplier(orderId: string) {
  const staff = await requireStaff();
  if (!isSupplyRole(staff.role)) {
    return { ok: false as const, error: "فقط واحد تأمین می‌تواند این کار را انجام دهد." };
  }
  const order = await prisma.customOrder.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false as const, error: "سفارش یافت نشد." };
  assertTransition(order.status, "supplier_confirmed");

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.customOrder.update({
      where: { id: orderId },
      data: {
        status: "supplier_confirmed",
        supplierConfirmedAt: now,
        supplierRejectedAt: null,
        supplyOwnerId: order.supplyOwnerId || staff.id,
        nextAction: "انتظار رسیدن کالا",
        stopReason: null,
      },
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        fromStatus: order.status,
        toStatus: "supplier_confirmed",
        note: "ثبت تأیید تأمین‌کننده و ارسال به مرحله انتظار رسیدن کالا",
        metaJson: JSON.stringify({ action: "supplier_confirm", at: now.toISOString() }),
        actorType: "staff",
        staffId: staff.id,
      },
    });
  });

  revalidateOrder(order.code);
  return { ok: true as const };
}

/** واحد تأمین: رد تأمین‌کننده */
export async function rejectSupplier(formData: FormData) {
  const staff = await requireStaff();
  if (!isSupplyRole(staff.role)) {
    return { ok: false as const, error: "فقط واحد تأمین می‌تواند این کار را انجام دهد." };
  }
  const orderId = String(formData.get("orderId"));
  const reason = String(formData.get("reason") || "").trim();
  if (!reason) return { ok: false as const, error: "علت رد الزامی است." };

  const order = await prisma.customOrder.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false as const, error: "سفارش یافت نشد." };
  assertTransition(order.status, "supplier_rejected");

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.customOrder.update({
      where: { id: orderId },
      data: {
        status: "supplier_rejected",
        supplierRejectedAt: now,
        supplyOwnerId: order.supplyOwnerId || staff.id,
        stopReason: reason,
        nextAction: "جایگزینی تأمین‌کننده یا بستن پرونده",
      },
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        fromStatus: order.status,
        toStatus: "supplier_rejected",
        note: `رد تأمین‌کننده ثبت شد. علت: ${reason}`,
        metaJson: JSON.stringify({ action: "supplier_reject", at: now.toISOString() }),
        actorType: "staff",
        staffId: staff.id,
      },
    });
  });

  revalidateOrder(order.code);
  return { ok: true as const };
}

export async function retryAddToCart(orderId: string) {
  const staff = await requireStaff();
  const order = await prisma.customOrder.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false as const, error: "سفارش یافت نشد." };
  if (order.status === "ready") {
    const result = await markOrderCompleted(orderId, staff.id);
    revalidateOrder(order.code);
    return result;
  }
  return { ok: false as const, error: "سفارش آماده نیست." };
}

export async function extendSupplierDue(formData: FormData) {
  const staff = await requireStaff();
  if (!isSupplyRole(staff.role) && !isOrdersRole(staff.role)) {
    return { ok: false as const, error: "دسترسی برای به‌روزرسانی تاریخ تحویل ندارید." };
  }
  const orderId = String(formData.get("orderId"));
  const newDue = String(formData.get("supplierDueAt") || "");
  const note = String(formData.get("note") || "").trim();
  if (!newDue) return { ok: false as const, error: "موعد جدید لازم است." };
  const order = await prisma.customOrder.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false as const, error: "سفارش یافت نشد." };
  const previous = order.supplierDueAt?.toISOString() || null;
  const supplierDueAt = new Date(newDue);
  const wasDelayed = isDelayed(order.supplierDueAt, order.arrivedFromSupplierAt);
  const delayCount = wasDelayed ? order.supplierDelayCount + 1 : order.supplierDelayCount;
  const segmentDays = currentSupplierOverdueDays(order);
  const accrued = wasDelayed
    ? (order.supplierDelayDaysAccrued || 0) + segmentDays
    : order.supplierDelayDaysAccrued;
  const logNote = wasDelayed
    ? note ||
      `تأخیر تأمین‌کننده ثبت شد (دفعه ${delayCount}، انباشته ${accrued} روز) و تاریخ تحویل جدید تعیین شد (${supplierDueAt.toISOString().slice(0, 10)})`
    : note || `به‌روزرسانی تاریخ تحویل تأمین‌کننده (${supplierDueAt.toISOString().slice(0, 10)})`;

  await prisma.$transaction(async (tx) => {
    await tx.customOrder.update({
      where: { id: orderId },
      data: {
        supplierDueAt,
        supplierDelayCount: delayCount,
        supplierDelayDaysAccrued: accrued,
        nextAction: wasDelayed ? "پیگیری پس از تأخیر تأمین‌کننده" : order.nextAction,
      },
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        fromStatus: order.status,
        toStatus: order.status,
        note: logNote,
        metaJson: JSON.stringify({
          action: wasDelayed ? "supplier_delay_reschedule" : "extend_supplier_due",
          previousSupplierDueAt: previous,
          supplierDueAt: supplierDueAt.toISOString(),
          supplierDelayCount: delayCount,
          supplierDelayDaysAccrued: accrued,
          segmentDays,
        }),
        actorType: "staff",
        staffId: staff.id,
      },
    });
  });
  revalidateOrder(order.code);
  return { ok: true as const };
}

export async function extendCustomerReadyDue(formData: FormData) {
  const staff = await requireStaff();
  const orderId = String(formData.get("orderId"));
  const newDue = String(formData.get("customerReadyDueAt") || "");
  const note = String(formData.get("note") || "").trim();
  if (!newDue) return { ok: false as const, error: "موعد جدید لازم است." };
  const order = await prisma.customOrder.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false as const, error: "سفارش یافت نشد." };
  const previous = order.customerReadyDueAt?.toISOString() || null;
  const customerReadyDueAt = new Date(newDue);
  await prisma.$transaction(async (tx) => {
    await tx.customOrder.update({
      where: { id: orderId },
      data: { customerReadyDueAt },
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        fromStatus: order.status,
        toStatus: order.status,
        note: note || "تمدید موعد آمادگی مشتری",
        metaJson: JSON.stringify({
          previousCustomerReadyDueAt: previous,
          customerReadyDueAt: customerReadyDueAt.toISOString(),
        }),
        actorType: "staff",
        staffId: staff.id,
      },
    });
  });
  revalidateOrder(order.code);
  return { ok: true as const };
}

export async function updateOpsFields(formData: FormData) {
  const staff = await requireStaff();
  const orderId = String(formData.get("orderId"));
  const stopReason = String(formData.get("stopReason") || "").trim() || null;
  const nextAction = String(formData.get("nextAction") || "").trim() || null;
  const salesOwnerId = String(formData.get("salesOwnerId") || "") || null;
  const supplyOwnerId = String(formData.get("supplyOwnerId") || "") || null;
  const order = await prisma.customOrder.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false as const, error: "سفارش یافت نشد." };
  await prisma.customOrder.update({
    where: { id: orderId },
    data: { stopReason, nextAction, salesOwnerId, supplyOwnerId },
  });
  await prisma.orderStatusHistory.create({
    data: {
      orderId,
      fromStatus: order.status,
      toStatus: order.status,
      note: "به‌روزرسانی علت توقف / اقدام بعدی / مسئولان",
      actorType: "staff",
      staffId: staff.id,
    },
  });
  revalidateOrder(order.code);
  return { ok: true as const };
}

export async function createFollowUpTask(formData: FormData) {
  const staff = await requireStaff();
  const orderId = String(formData.get("orderId"));
  const dueAt = String(formData.get("dueAt") || "");
  const note = String(formData.get("note") || "").trim() || null;
  if (!dueAt) return { ok: false as const, error: "سررسید لازم است." };
  const order = await prisma.customOrder.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false as const, error: "سفارش یافت نشد." };
  await prisma.makerFollowUpTask.create({
    data: {
      orderId,
      dueAt: new Date(dueAt),
      note,
      staffId: staff.id,
    },
  });
  revalidateOrder(order.code);
  return { ok: true as const };
}

/** جستجوی مشتری برای ثبت دستی */
export async function searchCustomersForManual(query: string) {
  await requireStaff();
  const q = query.trim();
  if (q.length < 1) return [] as { id: string; name: string; phone: string }[];

  const rows = await prisma.customerAccount.findMany({
    where: {
      OR: [
        { name: { contains: q } },
        { phone: { contains: q.replace(/\D/g, "") || q } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 12,
    select: { id: true, name: true, phone: true },
  });

  return rows.map((r) => ({
    id: r.id,
    name: r.name || r.phone,
    phone: r.phone,
  }));
}

/** ثبت سفارش دستی کارکنان → مستقیم گره سفارش به تأمین */
export async function createManualOrder(formData: FormData) {
  const staff = await requireStaff();
  if (!isOrdersRole(staff.role) && !isSupplyRole(staff.role)) {
    return { ok: false as const, error: "دسترسی ثبت دستی ندارید." };
  }

  const customerId = String(formData.get("customerId") || "").trim();
  const productGroup = String(formData.get("productGroup") || "").trim();
  const productName = String(formData.get("productName") || "").trim() || null;
  const description = String(formData.get("description") || "").trim() || null;
  const sizeLines = parseSizeLines(String(formData.get("sizeLinesJson") || ""));

  if (!customerId) {
    return { ok: false as const, error: "انتخاب مشتری از لیست الزامی است." };
  }
  if (!PRODUCT_GROUPS.some((g) => g.value === productGroup)) {
    return { ok: false as const, error: "گروه محصول معتبر نیست." };
  }
  if (productGroup === ALANGO_GROUP && sizeLines.length === 0) {
    return { ok: false as const, error: "برای النگو حداقل یک سایز و تعداد لازم است." };
  }
  if (productGroup !== ALANGO_GROUP && !description) {
    return { ok: false as const, error: "برای این گروه محصول، توضیحات الزامی است." };
  }

  const customer = await prisma.customerAccount.findUnique({ where: { id: customerId } });
  if (!customer) return { ok: false as const, error: "مشتری یافت نشد." };

  const uploadFiles = formData
    .getAll("designFiles")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (!productName && uploadFiles.length === 0) {
    return {
      ok: false as const,
      error: "حداقل یکی از «نام محصول» یا «عکس طرح» باید پر شود.",
    };
  }

  const stored = [];
  if (uploadFiles.length > 0) {
    const { storePrivateFile } = await import("@/lib/orders/files");
    for (const f of uploadFiles) {
      stored.push(await storePrivateFile(f));
    }
  }

  const code = generateOrderCode();
  const now = new Date();
  const groupLabel = PRODUCT_GROUP_LABEL[productGroup] || productGroup;
  const customerName = customer.name || customer.phone;

  try {
    const order = await prisma.customOrder.create({
      data: {
        code,
        status: "awaiting_supply",
        customerName,
        customerPhone: customer.phone,
        productGroup,
        productName,
        description,
        shippingAddress: "—",
        customerId: customer.id,
        salesOwnerId: staff.id,
        ordersReviewedAt: now,
        ordersDecisionDueAt: defaultOrdersDecisionDueAt(now),
        nextAction: "سفارش به تأمین",
        files:
          stored.length > 0
            ? {
                create: stored.map((s) => ({
                  originalName: s.originalName,
                  storedName: s.storedName,
                  mimeType: s.mimeType,
                  sizeBytes: s.sizeBytes,
                })),
              }
            : undefined,
        sizeLines:
          productGroup === ALANGO_GROUP
            ? { create: sizeLines.map((l) => ({ size: l.size, quantity: l.quantity })) }
            : undefined,
        history: {
          create: [
            {
              toStatus: "pending_review",
              note: `ثبت دستی سفارش ${groupLabel}${productName ? ` «${productName}»` : ""} توسط کارکنان`,
              actorType: "staff",
              staffId: staff.id,
            },
            {
              fromStatus: "pending_review",
              toStatus: "awaiting_supply",
              note: "ثبت دستی — مستقیم به گره سفارش به تأمین",
              actorType: "staff",
              staffId: staff.id,
            },
          ],
        },
      },
    });

    revalidatePath("/admin");
    return { ok: true as const, code: order.code };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطای ثبت سفارش";
    if (message.includes("Foreign key")) {
      return {
        ok: false as const,
        error: "نشست کارکنان نامعتبر است؛ یک‌بار خارج شوید و دوباره وارد شوید.",
      };
    }
    return { ok: false as const, error: message };
  }
}

export type OrderCardUndoSnapshot = {
  orderId: string;
  code: string;
  status: string;
  ordersReviewedAt: string | null;
  salesOwnerId: string | null;
  supplyOwnerId: string | null;
  supplyReviewedAt: string | null;
  supplierName: string | null;
  supplierDueAt: string | null;
  supplierDueAtInitial: string | null;
  supplierConfirmedAt: string | null;
  arrivedFromSupplierAt: string | null;
  supplierDelayCount: number;
  supplierDelayDaysAccrued: number;
  lastDelayReason: string | null;
  readyAt: string | null;
  completedAt: string | null;
  stopReason: string | null;
  nextAction: string | null;
  cartAddError: string | null;
};

export type OrderCardUndo = {
  snapshot: OrderCardUndoSnapshot;
  historyId: string;
  noteId: string | null;
};

function toUndoSnapshot(order: {
  id: string;
  code: string;
  status: string;
  ordersReviewedAt: Date | null;
  salesOwnerId: string | null;
  supplyOwnerId: string | null;
  supplyReviewedAt: Date | null;
  supplierName: string | null;
  supplierDueAt: Date | null;
  supplierDueAtInitial: Date | null;
  supplierConfirmedAt: Date | null;
  arrivedFromSupplierAt: Date | null;
  supplierDelayCount: number;
  supplierDelayDaysAccrued: number;
  lastDelayReason: string | null;
  readyAt: Date | null;
  completedAt: Date | null;
  stopReason: string | null;
  nextAction: string | null;
  cartAddError: string | null;
}): OrderCardUndoSnapshot {
  return {
    orderId: order.id,
    code: order.code,
    status: order.status,
    ordersReviewedAt: order.ordersReviewedAt?.toISOString() ?? null,
    salesOwnerId: order.salesOwnerId,
    supplyOwnerId: order.supplyOwnerId,
    supplyReviewedAt: order.supplyReviewedAt?.toISOString() ?? null,
    supplierName: order.supplierName,
    supplierDueAt: order.supplierDueAt?.toISOString() ?? null,
    supplierDueAtInitial: order.supplierDueAtInitial?.toISOString() ?? null,
    supplierConfirmedAt: order.supplierConfirmedAt?.toISOString() ?? null,
    arrivedFromSupplierAt: order.arrivedFromSupplierAt?.toISOString() ?? null,
    supplierDelayCount: order.supplierDelayCount,
    supplierDelayDaysAccrued: order.supplierDelayDaysAccrued,
    lastDelayReason: order.lastDelayReason,
    readyAt: order.readyAt?.toISOString() ?? null,
    completedAt: order.completedAt?.toISOString() ?? null,
    stopReason: order.stopReason,
    nextAction: order.nextAction,
    cartAddError: order.cartAddError,
  };
}

async function okWithUndo(
  before: Parameters<typeof toUndoSnapshot>[0],
  extras?: { noteId?: string | null }
) {
  const history = await prisma.orderStatusHistory.findFirst({
    where: { orderId: before.id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  revalidateOrder(before.code);
  return {
    ok: true as const,
    undo: {
      snapshot: toUndoSnapshot(before),
      historyId: history?.id || "",
      noteId: extras?.noteId ?? null,
    } satisfies OrderCardUndo,
  };
}

/** بازگردانی تغییر کارت پس از لغو در پنجرهٔ ۵ ثانیه */
export async function revertOrderCardUndo(undo: OrderCardUndo) {
  await requireStaff();
  const s = undo.snapshot;
  const order = await prisma.customOrder.findUnique({ where: { id: s.orderId } });
  if (!order) return { ok: false as const, error: "سفارش یافت نشد." };

  await prisma.$transaction(async (tx) => {
    await tx.customOrder.update({
      where: { id: s.orderId },
      data: {
        status: s.status,
        ordersReviewedAt: s.ordersReviewedAt ? new Date(s.ordersReviewedAt) : null,
        salesOwnerId: s.salesOwnerId,
        supplyOwnerId: s.supplyOwnerId,
        supplyReviewedAt: s.supplyReviewedAt ? new Date(s.supplyReviewedAt) : null,
        supplierName: s.supplierName,
        supplierDueAt: s.supplierDueAt ? new Date(s.supplierDueAt) : null,
        supplierDueAtInitial: s.supplierDueAtInitial ? new Date(s.supplierDueAtInitial) : null,
        supplierConfirmedAt: s.supplierConfirmedAt ? new Date(s.supplierConfirmedAt) : null,
        arrivedFromSupplierAt: s.arrivedFromSupplierAt
          ? new Date(s.arrivedFromSupplierAt)
          : null,
        supplierDelayCount: s.supplierDelayCount,
        supplierDelayDaysAccrued: s.supplierDelayDaysAccrued,
        lastDelayReason: s.lastDelayReason,
        readyAt: s.readyAt ? new Date(s.readyAt) : null,
        completedAt: s.completedAt ? new Date(s.completedAt) : null,
        stopReason: s.stopReason,
        nextAction: s.nextAction,
        cartAddError: s.cartAddError,
      },
    });
    if (undo.noteId) {
      await tx.orderNote.deleteMany({ where: { id: undo.noteId } });
    }
    if (undo.historyId) {
      await tx.orderStatusHistory.deleteMany({ where: { id: undo.historyId } });
    }
    await tx.orderStatusHistory.create({
      data: {
        orderId: s.orderId,
        fromStatus: order.status,
        toStatus: s.status,
        note: "لغو تغییر ظرف ۵ ثانیه — وضعیت قبلی بازگردانده شد",
        actorType: "staff",
        staffId: null,
      },
    });
  });

  revalidateOrder(s.code);
  return { ok: true as const };
}

/**
 * اقدام از روی کارت سفارش — فوری اعمال می‌شود؛ با undo می‌توان لغو کرد.
 */
export async function advanceOrderFromCard(formData: FormData) {
  const staff = await requireStaff();
  const orderId = String(formData.get("orderId"));
  const choice = String(formData.get("choice") || "").trim();
  const order = await prisma.customOrder.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false as const, error: "سفارش یافت نشد." };
  const now = new Date();

  if (choice === "in_stock_complete") {
    if (!isOrdersRole(staff.role)) {
      return { ok: false as const, error: "فقط واحد سفارشات می‌تواند این گزینه را بزند." };
    }
    if (order.status !== "pending_review" && order.status !== "accepted_in_stock") {
      return { ok: false as const, error: "این سفارش در گره بررسی سفارش نیست." };
    }
    assertTransition(order.status, "completed");
    await prisma.$transaction(async (tx) => {
      await tx.customOrder.update({
        where: { id: orderId },
        data: {
          status: "completed",
          ordersReviewedAt: order.ordersReviewedAt || now,
          salesOwnerId: order.salesOwnerId || staff.id,
          readyAt: now,
          completedAt: now,
          stopReason: null,
          nextAction: null,
          cartAddError: null,
        },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: "completed",
          note: "بررسی سفارش: موجود است و تکمیل شد — ثبت در پرونده",
          metaJson: JSON.stringify({ choice, at: now.toISOString() }),
          actorType: "staff",
          staffId: staff.id,
        },
      });
    });
    return okWithUndo(order);
  }

  if (choice === "needs_order") {
    if (!isOrdersRole(staff.role)) {
      return { ok: false as const, error: "فقط واحد سفارشات می‌تواند نیازمند سفارش بزند." };
    }
    if (order.status !== "pending_review") {
      return { ok: false as const, error: "این سفارش در گره بررسی سفارش نیست." };
    }
    assertTransition("pending_review", "awaiting_supply");
    await prisma.$transaction(async (tx) => {
      await tx.customOrder.update({
        where: { id: orderId },
        data: {
          status: "awaiting_supply",
          ordersReviewedAt: now,
          salesOwnerId: order.salesOwnerId || staff.id,
          nextAction: "سفارش به تأمین",
          stopReason: null,
        },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: "awaiting_supply",
          note: "بررسی سفارش: نیازمند سفارش — ارسال به گره سفارش به تأمین",
          metaJson: JSON.stringify({ choice, at: now.toISOString() }),
          actorType: "staff",
          staffId: staff.id,
        },
      });
    });
    return okWithUndo(order);
  }

  if (choice === "cannot_fulfill") {
    if (!isSupplyRole(staff.role) && !isOrdersRole(staff.role)) {
      return { ok: false as const, error: "دسترسی کافی نیست." };
    }
    if (order.status !== "awaiting_supply") {
      return { ok: false as const, error: "این گزینه فقط در گره سفارش به تأمین است." };
    }
    const reason = String(formData.get("reason") || "").trim();
    if (!reason) return { ok: false as const, error: "دلیل توضیحی برای «قابل تأمین نیست» الزامی است." };
    assertTransition("awaiting_supply", "supply_rejected");
    await prisma.$transaction(async (tx) => {
      await tx.customOrder.update({
        where: { id: orderId },
        data: {
          status: "supply_rejected",
          supplyReviewedAt: now,
          supplyOwnerId: order.supplyOwnerId || staff.id,
          stopReason: reason,
          nextAction: "اطلاع به مشتری",
        },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: "supply_rejected",
          note: `سفارش به تأمین: قابل تأمین نیست. دلیل: ${reason}`,
          metaJson: JSON.stringify({ choice, at: now.toISOString(), reason }),
          actorType: "staff",
          staffId: staff.id,
        },
      });
    });
    return okWithUndo(order);
  }

  if (choice === "ordered_from_supplier") {
    if (!isSupplyRole(staff.role) && !isOrdersRole(staff.role)) {
      return { ok: false as const, error: "دسترسی کافی نیست." };
    }
    if (order.status !== "awaiting_supply") {
      return { ok: false as const, error: "این گزینه فقط در گره سفارش به تأمین است." };
    }
    const supplierDueAtRaw = String(formData.get("supplierDueAt") || "");
    const supplierName =
      String(formData.get("supplierName") || "").trim() || order.supplierName || "تأمین‌کننده";
    if (!supplierDueAtRaw) {
      return { ok: false as const, error: "تاریخ تحویل الزامی است." };
    }
    const supplierDueAt = new Date(supplierDueAtRaw);
    assertTransition("awaiting_supply", "awaiting_supplier");

    await prisma.$transaction(async (tx) => {
      await tx.customOrder.update({
        where: { id: orderId },
        data: {
          status: "awaiting_supplier",
          supplyReviewedAt: now,
          supplyOwnerId: order.supplyOwnerId || staff.id,
          supplierName,
          supplierDueAt,
          // موعد اول فقط یک‌بار قفل می‌شود
          supplierDueAtInitial: order.supplierDueAtInitial || supplierDueAt,
          stopReason: null,
          nextAction: "پیگیری در تاریخ تحویل (نیازمند بررسی)",
        },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: "awaiting_supplier",
          note: `سفارش به تأمین‌کننده ثبت شد («${supplierName}») — تاریخ تحویل ${supplierDueAt.toISOString().slice(0, 10)}`,
          metaJson: JSON.stringify({
            choice,
            at: now.toISOString(),
            supplierName,
            supplierDueAt: supplierDueAt.toISOString(),
          }),
          actorType: "staff",
          staffId: staff.id,
        },
      });
    });

    const updated = await prisma.customOrder.findUniqueOrThrow({ where: { id: orderId } });
    await maybeSendProgressSms(updated);
    return okWithUndo(order);
  }

  if (choice === "followup_complete") {
    if (!isSupplyRole(staff.role) && !isOrdersRole(staff.role)) {
      return { ok: false as const, error: "دسترسی تکمیل ندارید." };
    }
    if (order.status !== "awaiting_supplier" && order.status !== "supplier_confirmed") {
      return { ok: false as const, error: "این سفارش در صف نیازمند بررسی نیست." };
    }
    const note = String(formData.get("note") || "").trim();
    assertTransition(order.status, "completed");
    const wasDelayed = isDelayed(order.supplierDueAt, order.arrivedFromSupplierAt);
    const delayCount = wasDelayed ? order.supplierDelayCount + 1 : order.supplierDelayCount;

    await prisma.$transaction(async (tx) => {
      await tx.customOrder.update({
        where: { id: orderId },
        data: {
          status: "completed",
          readyAt: now,
          completedAt: now,
          arrivedFromSupplierAt: now,
          supplierConfirmedAt: order.supplierConfirmedAt || now,
          supplierDelayCount: delayCount,
          cartAddError: null,
          stopReason: null,
          nextAction: null,
        },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: "completed",
          note: [
            "نیازمند بررسی: تکمیل در پرونده ثبت شد.",
            wasDelayed ? `تأخیر تأمین‌کننده ثبت شد (دفعه ${delayCount}).` : null,
            note ? `توضیح: ${note}` : null,
          ]
            .filter(Boolean)
            .join(" "),
          metaJson: JSON.stringify({
            choice,
            at: now.toISOString(),
            note: note || null,
            supplierDelayCount: delayCount,
          }),
          actorType: "staff",
          staffId: staff.id,
        },
      });
      if (note) {
        await tx.orderNote.create({
          data: { orderId, body: `تکمیل پرونده: ${note}`, staffId: staff.id },
        });
      }
    });
    const lastNote = note
      ? await prisma.orderNote.findFirst({
          where: { orderId },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        })
      : null;
    return okWithUndo(order, { noteId: lastNote?.id ?? null });
  }

  if (choice === "followup_delay") {
    if (!isSupplyRole(staff.role) && !isOrdersRole(staff.role)) {
      return { ok: false as const, error: "دسترسی ثبت تأخیر ندارید." };
    }
    if (order.status !== "awaiting_supplier" && order.status !== "supplier_confirmed") {
      return { ok: false as const, error: "این سفارش در صف نیازمند بررسی نیست." };
    }
    const supplierDueAtRaw = String(formData.get("supplierDueAt") || "");
    const delayReason = String(formData.get("delayReason") || "").trim();
    const note = String(formData.get("note") || "").trim();
    if (!supplierDueAtRaw) return { ok: false as const, error: "تاریخ تحویل جدید الزامی است." };
    if (!SUPPLIER_DELAY_REASONS.some((r) => r.value === delayReason)) {
      return { ok: false as const, error: "دلیل تأخیر را انتخاب کنید." };
    }
    if (delayReason === "other" && !note) {
      return { ok: false as const, error: "برای گزینه «سایر» نوشتن توضیح الزامی است." };
    }
    const supplierDueAt = new Date(supplierDueAtRaw);
    const previous = order.supplierDueAt?.toISOString() || null;
    const delayCount = order.supplierDelayCount + 1;
    const segmentDays = currentSupplierOverdueDays(order);
    const accrued = (order.supplierDelayDaysAccrued || 0) + segmentDays;
    const reasonLabel = SUPPLIER_DELAY_REASON_LABEL[delayReason] || delayReason;
    const noteBody = note
      ? `دلیل: ${reasonLabel} — ${note}`
      : `دلیل: ${reasonLabel}`;

    await prisma.$transaction(async (tx) => {
      await tx.customOrder.update({
        where: { id: orderId },
        data: {
          status: "awaiting_supplier",
          supplierDueAt,
          // اگر موعد اول نبود، همان موعدی که الان جابه‌جا می‌شود قفل می‌شود
          supplierDueAtInitial: order.supplierDueAtInitial || order.supplierDueAt,
          supplierDelayCount: delayCount,
          supplierDelayDaysAccrued: accrued,
          lastDelayReason: delayReason,
          nextAction: "پیگیری در تاریخ جدید پس از تأخیر",
        },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: "awaiting_supplier",
          note: `تأخیر ثبت شد (دفعه ${delayCount}، انباشته ${accrued} روز، این بازه ${segmentDays} روز). تاریخ جدید ${supplierDueAt.toISOString().slice(0, 10)}. ${noteBody}`,
          metaJson: JSON.stringify({
            choice,
            previousSupplierDueAt: previous,
            supplierDueAt: supplierDueAt.toISOString(),
            supplierDelayCount: delayCount,
            supplierDelayDaysAccrued: accrued,
            segmentDays,
            delayReason,
            note: note || null,
          }),
          actorType: "staff",
          staffId: staff.id,
        },
      });
      await tx.orderNote.create({
        data: {
          orderId,
          body: `تأخیر تأمین‌کننده (دفعه ${delayCount}): ${noteBody}`,
          staffId: staff.id,
        },
      });
    });
    const lastNote = await prisma.orderNote.findFirst({
      where: { orderId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    return okWithUndo(order, { noteId: lastNote?.id ?? null });
  }

  if (choice === "back_to_review") {
    if (order.status !== "awaiting_supply") {
      return { ok: false as const, error: "بازگشت فقط از گره سفارش به تأمین ممکن است." };
    }
    assertTransition("awaiting_supply", "pending_review");
    await prisma.$transaction(async (tx) => {
      await tx.customOrder.update({
        where: { id: orderId },
        data: { status: "pending_review", nextAction: "بررسی مجدد سفارش", stopReason: null },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: "pending_review",
          note: "بازگشت به گره بررسی سفارش",
          actorType: "staff",
          staffId: staff.id,
        },
      });
    });
    return okWithUndo(order);
  }

  if (choice === "back_to_supply") {
    if (order.status !== "awaiting_supplier" && order.status !== "supplier_confirmed") {
      return { ok: false as const, error: "بازگشت فقط از صف تأمین‌کننده ممکن است." };
    }
    assertTransition(order.status, "awaiting_supply");
    await prisma.$transaction(async (tx) => {
      await tx.customOrder.update({
        where: { id: orderId },
        data: {
          status: "awaiting_supply",
          nextAction: "بازنگری سفارش به تأمین",
          supplierDueAt: null,
          supplierDueAtInitial: null,
          supplierDelayCount: 0,
          supplierDelayDaysAccrued: 0,
          lastDelayReason: null,
        },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: "awaiting_supply",
          note: "بازگشت به گره سفارش به تأمین",
          actorType: "staff",
          staffId: staff.id,
        },
      });
    });
    return okWithUndo(order);
  }

  if (choice === "retry_cart") {
    return retryAddToCart(orderId);
  }

  return { ok: false as const, error: "گزینه نامعتبر است." };
}
