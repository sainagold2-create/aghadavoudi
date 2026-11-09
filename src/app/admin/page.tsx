import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { ScrollText } from "lucide-react";
import { AdminOpsDashboard } from "@/components/admin-ops-dashboard";
import { ManualOrderForm } from "@/components/manual-order-form";
import { OrderCardWorkflow } from "@/components/order-card-workflow";
import { Badge, Card, CustomBadge } from "@/components/ui";
import { authOptions } from "@/lib/auth";
import {
  ADMIN_LIST_TABS,
  ORDER_STATUS_LABEL,
  PRODUCT_GROUP_LABEL,
  STAFF_ROLE_LABEL,
} from "@/lib/constants";
import { buildOpsDashboard } from "@/lib/orders/dashboard-stats";
import {
  delayDaysFromInitialDue,
  needsFollowUpReview,
  orderDelayLabel,
  orderOverdueDays,
  supplierRescheduleCount,
} from "@/lib/orders/delay-flags";
import { followUpOwner } from "@/lib/orders/follow-up-owner";
import { compareOrdersForAdminList } from "@/lib/orders/list-sort";
import { prisma } from "@/lib/prisma";
import { toFaDigits, toJalali } from "@/lib/utils";

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/admin/login");

  const sp = await searchParams;
  const tab = sp.tab || "all";

  const allOrders = await prisma.customOrder.findMany({
    include: {
      salesOwner: true,
      supplyOwner: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const dashboard = buildOpsDashboard(allOrders);

  const orders = allOrders.filter(
    (o) =>
      o.status !== "completed" &&
      o.status !== "supply_rejected" &&
      o.status !== "supplier_rejected"
  );

  let filtered = orders;
  if (tab === "review") {
    filtered = filtered.filter((o) => o.status === "pending_review");
  } else if (tab === "supply_order") {
    filtered = filtered.filter(
      (o) =>
        o.status === "awaiting_supply" ||
        ((o.status === "awaiting_supplier" || o.status === "supplier_confirmed") &&
          !needsFollowUpReview(o))
    );
  } else if (tab === "needs_check") {
    filtered = filtered.filter((o) => needsFollowUpReview(o));
  } else if (tab === "done") {
    filtered = filtered.filter((o) => o.status === "ready");
  }

  filtered = [...filtered].sort(compareOrdersForAdminList);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#03613C]">کارت سفارش‌ها</h1>
          <p className="text-xs text-slate-600">
            {session.user.name} · {STAFF_ROLE_LABEL[session.user.role || ""] || session.user.role}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {ADMIN_LIST_TABS.map((t) => (
            <Link
              key={t.value}
              href={t.value === "all" ? "/admin" : `/admin?tab=${t.value}`}
              className={`rounded-full px-2.5 py-1 ${
                tab === t.value
                  ? "bg-[#03613C] text-white"
                  : "border border-slate-300 text-slate-700"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>

      <AdminOpsDashboard stats={dashboard} />

      <ManualOrderForm />

      <div className="space-y-1.5">
        {filtered.map((o) => {
          const owner = followUpOwner(o.status, o);
          const delay = orderDelayLabel(o);
          const delayed = !!delay || needsFollowUpReview(o);
          // موعد اول؛ اگر نبود از تأخیر جاری/انباشته
          const delayDays =
            delayDaysFromInitialDue(o) ?? orderOverdueDays(o);
          const reschedules = supplierRescheduleCount(o);
          const title =
            o.productName ||
            PRODUCT_GROUP_LABEL[o.productGroup] ||
            o.productGroup;
          return (
            <Card
              key={o.id}
              className={`!space-y-1 !rounded-xl !p-2 ${
                delayed ? "!border-red-300 !bg-red-50" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  <CustomBadge />
                  <Link
                    href={`/admin/orders/${o.code}`}
                    title="باز کردن کارت سفارش"
                    className="text-sm font-bold text-[#03613C] underline decoration-[#03613C]/25 underline-offset-2 hover:decoration-[#03613C]"
                  >
                    {title}
                  </Link>
                  {delayDays != null && (
                    <span className="text-[11px] font-semibold text-red-600">
                      {delayDays === 0
                        ? "سررسید امروز"
                        : `${toFaDigits(delayDays)} روز تأخیر از موعد اول`}
                    </span>
                  )}
                  {reschedules > 0 && (
                    <span className="text-[11px] font-semibold text-red-600">
                      تغییر تاریخ ×{toFaDigits(reschedules)}
                    </span>
                  )}
                  {delayed && delayDays == null && reschedules === 0 && (
                    <Badge className="!px-1.5 !py-0 text-[10px] bg-red-600 text-white">
                      {delay || "تأخیر"}
                    </Badge>
                  )}
                  <span className="text-[10px] text-slate-500">
                    {PRODUCT_GROUP_LABEL[o.productGroup] || o.productGroup}
                    <span className="text-slate-400"> · {o.customerName}</span>
                    <span className="text-slate-400"> · ثبت: {toJalali(o.createdAt)}</span>
                  </span>
                  {(o.supplierDueAt || o.supplierName) && (
                    <span className="w-full text-[10px] text-slate-500">
                      {o.supplierName && (
                        <span>تأمین‌کننده: {o.supplierName}</span>
                      )}
                      {o.supplierName && o.supplierDueAt && (
                        <span className="text-slate-300"> · </span>
                      )}
                      {o.supplierDueAt && (
                        <span>موعد فعلی: {toJalali(o.supplierDueAt)}</span>
                      )}
                      {o.supplierDueAtInitial && (
                        <span className="text-slate-400">
                          {" "}
                          · موعد اول: {toJalali(o.supplierDueAtInitial)}
                        </span>
                      )}
                    </span>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <p className="hidden max-w-[9rem] text-left text-[10px] leading-tight text-slate-400 sm:block">
                    {owner.unit} — {owner.person}
                  </p>
                  <Link
                    href={`/admin/orders/${o.code}`}
                    title="جزئیات و لاگ"
                    aria-label="جزئیات و لاگ"
                    className="inline-flex rounded p-0.5 text-[#7F4700] hover:bg-[#7F4700]/10"
                  >
                    <ScrollText className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </Link>
                  <Badge className="!px-1.5 !py-0 text-[10px] bg-emerald-50 text-emerald-900">
                    {ORDER_STATUS_LABEL[o.status] || o.status}
                  </Badge>
                </div>
              </div>

              <OrderCardWorkflow
                orderId={o.id}
                status={o.status}
                supplierDueAt={o.supplierDueAt?.toISOString() || null}
                arrivedFromSupplierAt={o.arrivedFromSupplierAt?.toISOString() || null}
              />
            </Card>
          );
        })}
        {filtered.length === 0 && <Card className="!p-2">موردی نیست.</Card>}
      </div>
    </div>
  );
}
