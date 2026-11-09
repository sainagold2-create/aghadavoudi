import { Card } from "@/components/ui";
import { CustomerLoginForm } from "@/components/customer-login-form";
import { RemoveCartButton } from "@/components/remove-cart-button";
import { cartService } from "@/integrations";
import { getCustomerSession } from "@/lib/customer-session";
import { prisma } from "@/lib/prisma";
import { toFaDigits, toJalaliDateTime } from "@/lib/utils";
import Link from "next/link";

export default async function CartPage() {
  const customer = await getCustomerSession();
  if (!customer) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-[#03613C]">سبد خرید آزمایشی</h1>
        <CustomerLoginForm />
      </div>
    );
  }

  const items = await cartService.listByCustomer(customer.id);
  const withOrders = await Promise.all(
    items.map(async (item) => {
      const order = await prisma.customOrder.findUnique({
        where: { id: item.customOrderId },
        select: { code: true, status: true },
      });
      return { item, order };
    })
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#03613C]">سبد خرید آزمایشی</h1>
        <p className="text-sm text-slate-600">
          خرید و پرداخت در جریان عادی فروشگاه انجام می‌شود. حذف از سبد، وضعیت سفارش ساختنی را باز
          نمی‌کند.
        </p>
      </div>
      {withOrders.length === 0 && <Card>سبد خالی است.</Card>}
      {withOrders.map(({ item, order }) => (
        <Card key={item.id} className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-medium">{item.title}</div>
            <div className="text-sm text-slate-600">
              SKU: {toFaDigits(item.productSku)} · سفارش{" "}
              {order ? (
                <Link className="text-[#03613C] underline" href={`/orders/${order.code}`}>
                  {toFaDigits(order.code)}
                </Link>
              ) : (
                "—"
              )}
            </div>
            <div className="text-xs text-slate-400">{toJalaliDateTime(item.createdAt)}</div>
          </div>
          <RemoveCartButton id={item.id} />
        </Card>
      ))}
    </div>
  );
}
