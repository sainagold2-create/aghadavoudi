import { daysUntilDue } from "./tehran-day";

type OrderLike = {
  status: string;
  arrivedFromSupplierAt: Date | null;
  supplierDueAt: Date | null;
  followUps?: { dueAt: Date; doneAt: Date | null }[];
};

/** سفارش‌های در مسیر تأمین‌کننده که موعد نزدیک/گذشته یا تسک باز دارند. */
export function matchesSupplierFollowUp(order: OrderLike, now = new Date()): boolean {
  const open = order.status === "awaiting_supplier" || order.status === "supplier_confirmed";
  if (!open) return false;
  if (order.arrivedFromSupplierAt) return false;

  if (!order.supplierDueAt) return true;
  const days = daysUntilDue(order.supplierDueAt, now);
  if (days <= 2) return true;

  const hasOpenFollowUp = (order.followUps || []).some(
    (t) => !t.doneAt && t.dueAt.getTime() <= now.getTime()
  );
  return hasOpenFollowUp;
}

/** @deprecated use matchesSupplierFollowUp */
export const matchesMakerFollowUp = matchesSupplierFollowUp;
