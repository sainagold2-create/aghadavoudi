import Link from "next/link";
import { Card, CustomBadge } from "@/components/ui";
import { Timeline } from "@/components/timeline";
import { CustomerLoginForm } from "@/components/customer-login-form";
import { getCustomerSession } from "@/lib/customer-session";
import { ORDER_STATUS_LABEL, PRODUCT_GROUP_LABEL } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { toFaDigits } from "@/lib/utils";

export default async function MyOrdersPage() {
  const customer = await getCustomerSession();
  if (!customer) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-[#03613C]">سفارش‌های من</h1>
        <CustomerLoginForm />
      </div>
    );
  }

  const orders = await prisma.customOrder.findMany({
    where: { customerId: customer.id },
    include: {
      history: { orderBy: { createdAt: "asc" }, include: { staff: true } },
      sizeLines: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#03613C]">سفارش‌های من</h1>
        <p className="text-sm text-slate-600">
          {customer.name || "مشتری"} · {toFaDigits(customer.phone)}
        </p>
      </div>
      {orders.length === 0 && <Card>هنوز سفارشی ندارید.</Card>}
      {orders.map((o) => (
        <Card key={o.id} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CustomBadge />
              <Link href={`/orders/${o.code}`} className="font-bold text-[#03613C]">
                {toFaDigits(o.code)}
              </Link>
            </div>
            <span className="text-sm">{ORDER_STATUS_LABEL[o.status]}</span>
          </div>
          <p className="text-sm text-slate-600">
            {PRODUCT_GROUP_LABEL[o.productGroup] || o.productGroup}
            {o.productName ? ` · ${o.productName}` : ""}
          </p>
          <Timeline items={o.history} />
        </Card>
      ))}
    </div>
  );
}
