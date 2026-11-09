export const BRAND = {
  green: "#03613C",
  gold: "#7F4700",
  name: "سایناگلد",
};

export const ORDER_STATUSES = [
  { value: "pending_review", label: "بررسی سفارش" },
  { value: "accepted_in_stock", label: "موجود (مسیر تکمیل)" },
  { value: "awaiting_supply", label: "سفارش به تأمین" },
  { value: "supply_rejected", label: "قابل تأمین نیست" },
  { value: "awaiting_supplier", label: "منتظر تأمین‌کننده" },
  { value: "supplier_confirmed", label: "تأیید تأمین‌کننده" },
  { value: "supplier_rejected", label: "رد تأمین‌کننده" },
  { value: "ready", label: "آماده تحویل" },
  { value: "completed", label: "تکمیل‌شده" },
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number]["value"];

export const ORDER_STATUS_LABEL: Record<string, string> = Object.fromEntries(
  ORDER_STATUSES.map((s) => [s.value, s.label])
);

export const STAFF_ROLES = [
  { value: "admin", label: "مدیر" },
  { value: "orders", label: "واحد سفارشات" },
  { value: "supply", label: "واحد تأمین" },
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number]["value"];

export const STAFF_ROLE_LABEL: Record<string, string> = {
  admin: "مدیر",
  orders: "واحد سفارشات",
  supply: "واحد تأمین",
  sales: "واحد سفارشات",
};

export function isOrdersRole(role?: string | null) {
  return role === "admin" || role === "orders" || role === "sales";
}

export function isSupplyRole(role?: string | null) {
  return role === "admin" || role === "supply";
}

export const ADMIN_LIST_TABS = [
  { value: "all", label: "همه" },
  { value: "review", label: "بررسی سفارش" },
  { value: "supply_order", label: "سفارش به تأمین" },
  { value: "needs_check", label: "نیازمند بررسی" },
  { value: "done", label: "آماده تکمیل" },
] as const;

export const CONFIRM_TEXT =
  "با ثبت درخواست، ساخت این محصول را تأیید می‌کنید. پس از آماده‌شدن، محصول به سبد خریدتان اضافه می‌شود.";

export const PRODUCT_GROUPS = [
  { value: "alango", label: "النگو" },
  { value: "ring", label: "انگشتر" },
  { value: "necklace", label: "گردنبند" },
  { value: "earring", label: "گوشواره" },
  { value: "bracelet", label: "دستبند" },
  { value: "pendant", label: "پلاک / آویز" },
  { value: "set", label: "سرویس" },
  { value: "other", label: "سایر" },
] as const;

export type ProductGroup = (typeof PRODUCT_GROUPS)[number]["value"];

export const PRODUCT_GROUP_LABEL: Record<string, string> = Object.fromEntries(
  PRODUCT_GROUPS.map((g) => [g.value, g.label])
);

export const ALANGO_GROUP = "alango";

export const SUPPLIER_DELAY_REASONS = [
  { value: "supplier_broke_promise", label: "بدقولی تأمین‌کننده" },
  { value: "shipping_issue", label: "مشکل در ارسال" },
  { value: "sales_work_pending", label: "کار فروش رفته" },
  { value: "other", label: "سایر" },
] as const;

export type SupplierDelayReason = (typeof SUPPLIER_DELAY_REASONS)[number]["value"];

export const SUPPLIER_DELAY_REASON_LABEL: Record<string, string> = Object.fromEntries(
  SUPPLIER_DELAY_REASONS.map((r) => [r.value, r.label])
);
