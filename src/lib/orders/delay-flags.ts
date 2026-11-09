import { daysUntilDue } from "./tehran-day";
import { isDelayed } from "./deadlines";

type OrderLike = {
  status: string;
  ordersDecisionDueAt: Date | null;
  ordersReviewedAt: Date | null;
  supplierDueAt: Date | null;
  supplierDueAtInitial?: Date | null;
  arrivedFromSupplierAt: Date | null;
  supplierDelayCount?: number;
  supplierDelayDaysAccrued?: number | null;
};

/** سفارش نزد تأمین‌کننده که تاریخش رسیده/گذشته و هنوز نرسیده → نیازمند بررسی */
export function needsFollowUpReview(order: OrderLike, now = new Date()): boolean {
  if (order.status !== "awaiting_supplier" && order.status !== "supplier_confirmed") {
    return false;
  }
  if (order.arrivedFromSupplierAt) return false;
  if (!order.supplierDueAt) return false;
  return daysUntilDue(order.supplierDueAt, now) <= 0;
}

export function isOrdersDecisionDelayed(order: OrderLike): boolean {
  if (order.status !== "pending_review") return false;
  return isDelayed(order.ordersDecisionDueAt, order.ordersReviewedAt);
}

export function isSupplierDeliveryDelayed(order: OrderLike): boolean {
  return needsFollowUpReview(order);
}

/** تعداد دفعات تغییر تاریخ پس از تأخیر */
export function supplierRescheduleCount(order: OrderLike): number {
  return order.supplierDelayCount || 0;
}

/**
 * روزهای تأخیر نسبت به اولین موعد اعلام‌شده.
 * اگر هنوز به موعد اول نرسیده: null
 * اگر سررسید اول امروز است: 0
 */
export function delayDaysFromInitialDue(order: OrderLike, now = new Date()): number | null {
  const initial = order.supplierDueAtInitial || null;
  if (!initial) {
    // سفارش‌های قدیمی بدون موعد اول: انباشته یا سررسید فعلی
    const accrued = order.supplierDelayDaysAccrued || 0;
    const current = currentSupplierOverdueDays(order, now);
    if (accrued > 0 || current > 0 || needsFollowUpReview(order, now)) {
      return accrued + current;
    }
    return null;
  }
  if (order.arrivedFromSupplierAt) {
    return Math.max(0, -daysUntilDue(initial, order.arrivedFromSupplierAt));
  }
  if (
    order.status === "completed" ||
    order.status === "supply_rejected" ||
    order.status === "supplier_rejected"
  ) {
    return null;
  }
  if (order.status !== "awaiting_supplier" && order.status !== "supplier_confirmed") {
    return null;
  }
  const until = daysUntilDue(initial, now);
  if (until > 0) return null;
  return Math.max(0, -until);
}

export function orderDelayLabel(order: OrderLike): string | null {
  if (needsFollowUpReview(order)) return "تأخیر تأمین‌کننده — نیازمند بررسی";
  if (isOrdersDecisionDelayed(order)) return "تأخیر بررسی سفارش";
  if ((order.supplierDelayCount || 0) > 0 && !order.arrivedFromSupplierAt) {
    return `تغییر تاریخ ×${order.supplierDelayCount}`;
  }
  return null;
}

/** روزهای تأخیر بازهٔ جاری نسبت به موعد فعلی (بدون انباشته) */
export function currentSupplierOverdueDays(order: OrderLike, now = new Date()): number {
  if (order.arrivedFromSupplierAt || !order.supplierDueAt) return 0;
  if (order.status !== "awaiting_supplier" && order.status !== "supplier_confirmed") {
    return 0;
  }
  const until = daysUntilDue(order.supplierDueAt, now);
  return until <= 0 ? Math.max(0, -until) : 0;
}

/**
 * نمایش روی کارت: اولویت با تأخیر نسبت به موعد اول؛
 * اگر موعد اول نباشد، از انباشته + بازهٔ جاری استفاده می‌شود.
 */
export function orderOverdueDays(order: OrderLike, now = new Date()): number | null {
  const fromInitial = delayDaysFromInitialDue(order, now);
  if (fromInitial != null) return fromInitial;

  const accrued = order.supplierDelayDaysAccrued || 0;
  const current = currentSupplierOverdueDays(order, now);
  if (needsFollowUpReview(order, now) || accrued > 0) {
    return accrued + current;
  }

  if (
    isOrdersDecisionDelayed(order) &&
    order.ordersDecisionDueAt &&
    !order.ordersReviewedAt
  ) {
    return Math.max(0, -daysUntilDue(order.ordersDecisionDueAt, now));
  }
  return null;
}
