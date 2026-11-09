import { needsFollowUpReview } from "./delay-flags";

type SortableOrder = {
  status: string;
  createdAt: Date;
  supplierDueAt: Date | null;
  arrivedFromSupplierAt: Date | null;
  ordersDecisionDueAt: Date | null;
  ordersReviewedAt: Date | null;
};

/** سفارش نزد تأمین با تاریخ تحویل هنوز نرسیده → باید پایین‌تر از کارهای جاری باشد */
export function isWaitingOnFutureSupplier(order: SortableOrder, now = new Date()): boolean {
  if (order.status !== "awaiting_supplier" && order.status !== "supplier_confirmed") {
    return false;
  }
  if (order.arrivedFromSupplierAt) return false;
  if (!order.supplierDueAt) return false;
  return order.supplierDueAt.getTime() > now.getTime() && !needsFollowUpReview(order, now);
}

/**
 * اولویت نمایش کارت‌ها:
 * 0 = نیازمند بررسی / سررسید گذشته
 * 1 = کارهای جاری (بررسی، ثبت تأمین، …)
 * 2 = منتظر تاریخ آینده تأمین‌کننده (پایین لیست)
 */
function bucket(order: SortableOrder, now: Date): number {
  if (needsFollowUpReview(order, now)) return 0;
  if (isWaitingOnFutureSupplier(order, now)) return 2;
  return 1;
}

export function compareOrdersForAdminList(a: SortableOrder, b: SortableOrder, now = new Date()) {
  const ba = bucket(a, now);
  const bb = bucket(b, now);
  if (ba !== bb) return ba - bb;

  if (ba === 0) {
    const da = a.supplierDueAt?.getTime() ?? 0;
    const db = b.supplierDueAt?.getTime() ?? 0;
    if (da !== db) return da - db;
  }

  if (ba === 2) {
    const da = a.supplierDueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const db = b.supplierDueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (da !== db) return da - db; // نزدیک‌تر بالاتر؛ دورتر پایین‌تر
  }

  return b.createdAt.getTime() - a.createdAt.getTime();
}
