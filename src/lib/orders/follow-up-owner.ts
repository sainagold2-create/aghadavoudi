type OwnerLike = { name: string } | null | undefined;

/** واحد و فردی که الان باید پیگیر این مرحله باشد */
export function followUpOwner(
  status: string,
  order: { salesOwner?: OwnerLike; supplyOwner?: OwnerLike }
): { unit: string; person: string } {
  switch (status) {
    case "pending_review":
    case "accepted_in_stock":
      return {
        unit: "واحد سفارشات",
        person: order.salesOwner?.name || "کارشناس سفارشات",
      };
    case "awaiting_supply":
      return {
        unit: "واحد تأمین",
        person: order.supplyOwner?.name || "کارشناس تأمین",
      };
    case "awaiting_supplier":
    case "supplier_confirmed":
      return {
        unit: "واحد تأمین — پیگیری سررسید",
        person: order.supplyOwner?.name || "کارشناس تأمین",
      };
    case "ready":
      return {
        unit: "عملیات / سفارشات",
        person: order.salesOwner?.name || "کارشناس سفارشات",
      };
    case "supply_rejected":
    case "supplier_rejected":
      return {
        unit: "واحد سفارشات",
        person: order.salesOwner?.name || "کارشناس سفارشات",
      };
    case "completed":
      return { unit: "—", person: "پیگیری فعال لازم نیست" };
    default:
      return { unit: "عملیات", person: "—" };
  }
}
