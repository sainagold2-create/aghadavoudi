import { isOrdersDecisionDelayed, needsFollowUpReview } from "./delay-flags";
import { tehranDayKey } from "./tehran-day";

export type DashboardOrder = {
  status: string;
  createdAt: Date;
  completedAt: Date | null;
  ordersDecisionDueAt: Date | null;
  ordersReviewedAt: Date | null;
  supplierDueAt: Date | null;
  arrivedFromSupplierAt: Date | null;
  supplierName: string | null;
  supplierDelayCount?: number;
  supplierDelayDaysAccrued?: number | null;
};

export function buildOpsDashboard(orders: DashboardOrder[], now = new Date()) {
  const todayKey = tehranDayKey(now);

  let review = 0;
  let supplyAction = 0;
  let waitingFuture = 0;
  let needsCheck = 0;
  let ready = 0;
  let delayed = 0;
  let createdToday = 0;
  let completedToday = 0;

  // عملکرد واحدها
  let ordersQueue = 0; // در اختیار سفارشات
  let ordersDelayed = 0;
  let supplyQueue = 0; // در اختیار تأمین
  let supplyDelayed = 0;
  let supplyDelayEvents = 0; // جمع تأخیرهای ثبت‌شده تأمین

  for (const o of orders) {
    if (tehranDayKey(o.createdAt) === todayKey) createdToday += 1;
    if (o.status === "completed" && o.completedAt && tehranDayKey(o.completedAt) === todayKey) {
      completedToday += 1;
    }

    const isClosed =
      o.status === "completed" ||
      o.status === "supply_rejected" ||
      o.status === "supplier_rejected";

    if (isClosed) continue;

    const orderDelay = isOrdersDecisionDelayed(o);
    const supplyDue = needsFollowUpReview(o, now);
    if (orderDelay || supplyDue) delayed += 1;

    if (o.status === "pending_review") {
      review += 1;
      ordersQueue += 1;
      if (orderDelay) ordersDelayed += 1;
      continue;
    }
    if (o.status === "awaiting_supply") {
      supplyAction += 1;
      supplyQueue += 1;
      continue;
    }
    if (o.status === "awaiting_supplier" || o.status === "supplier_confirmed") {
      supplyQueue += 1;
      supplyDelayEvents += o.supplierDelayCount || 0;
      if (supplyDue) {
        needsCheck += 1;
        supplyDelayed += 1;
      } else {
        waitingFuture += 1;
      }
      continue;
    }
    if (o.status === "ready" || o.status === "accepted_in_stock") {
      ready += 1;
      ordersQueue += 1;
    }
  }

  const ordersOnTimeRate =
    ordersQueue === 0 ? 100 : Math.round(((ordersQueue - ordersDelayed) / ordersQueue) * 100);
  const supplyOnTimeRate =
    supplyQueue === 0 ? 100 : Math.round(((supplyQueue - supplyDelayed) / supplyQueue) * 100);

  return {
    review,
    supplyAction,
    waitingFuture,
    needsCheck,
    ready,
    delayed,
    createdToday,
    completedToday,
    units: {
      orders: {
        label: "واحد سفارشات",
        queue: ordersQueue,
        delayed: ordersDelayed,
        onTimeRate: ordersOnTimeRate,
      },
      supply: {
        label: "واحد تأمین",
        queue: supplyQueue,
        delayed: supplyDelayed,
        delayEvents: supplyDelayEvents,
        onTimeRate: supplyOnTimeRate,
      },
    },
  };
}
