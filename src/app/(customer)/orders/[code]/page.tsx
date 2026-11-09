import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CustomBadge } from "@/components/ui";
import { Timeline } from "@/components/timeline";
import { prisma } from "@/lib/prisma";
import { appBaseUrl, toFaDigits } from "@/lib/utils";
import { getCustomerSession } from "@/lib/customer-session";
import { ORDER_STATUS_LABEL, PRODUCT_GROUP_LABEL } from "@/lib/constants";

export default async function OrderSuccessPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const order = await prisma.customOrder.findUnique({
    where: { code },
    include: {
      history: { orderBy: { createdAt: "asc" }, include: { staff: true } },
      sizeLines: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) notFound();

  const customer = await getCustomerSession();
  const isOwner = customer?.id === order.customerId;
  const trackingUrl = `${appBaseUrl()}/track?code=${encodeURIComponent(order.code)}`;

  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <CustomBadge />
          <h1 className="text-2xl font-bold text-[#03613C]">درخواست ثبت شد</h1>
        </div>
        <p className="text-slate-700">
          ساخت این محصول توسط شما تأیید شد. وضعیت فعلی:{" "}
          <strong>{ORDER_STATUS_LABEL[order.status]}</strong>
        </p>
        <p className="text-sm text-slate-600">
          گروه: {PRODUCT_GROUP_LABEL[order.productGroup] || order.productGroup}
          {order.productName ? ` · نام: ${order.productName}` : ""}
        </p>
        {order.sizeLines.length > 0 && (
          <ul className="text-sm text-slate-700">
            {order.sizeLines.map((l) => (
              <li key={l.id}>
                سایز {toFaDigits(l.size)} — تعداد {toFaDigits(l.quantity)}
              </li>
            ))}
          </ul>
        )}
        <p className="text-lg">
          کد یکتا: <span className="font-mono font-bold">{toFaDigits(order.code)}</span>
        </p>
        <p className="text-sm">
          لینک پیگیری:{" "}
          <Link className="text-[#03613C] underline" href={trackingUrl}>
            {trackingUrl}
          </Link>
        </p>
        {!isOwner && (
          <p className="text-sm text-amber-800">
            برای مشاهده جزئیات کامل از مسیر پیگیری با موبایل و OTP استفاده کنید.
          </p>
        )}
      </Card>

      {isOwner && (
        <Card>
          <h2 className="mb-3 font-bold">تایم‌لاین</h2>
          <Timeline items={order.history} />
        </Card>
      )}
    </div>
  );
}
