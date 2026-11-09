import { getServerSession } from "next-auth";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OrderCardPhotos } from "@/components/order-card-photos";
import { Timeline } from "@/components/timeline";
import { Badge, Card, CustomBadge } from "@/components/ui";
import { authOptions } from "@/lib/auth";
import { ORDER_STATUS_LABEL, PRODUCT_GROUP_LABEL } from "@/lib/constants";
import { followUpOwner } from "@/lib/orders/follow-up-owner";
import { orderDelayLabel } from "@/lib/orders/delay-flags";
import { prisma } from "@/lib/prisma";
import { toFaDigits, toJalaliDateTime } from "@/lib/utils";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/admin/login");

  const { code } = await params;
  const order = await prisma.customOrder.findUnique({
    where: { code },
    include: {
      history: { orderBy: { createdAt: "asc" }, include: { staff: true } },
      files: true,
      salesOwner: true,
      supplyOwner: true,
      sizeLines: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) notFound();

  const owner = followUpOwner(order.status, order);
  const delay = orderDelayLabel(order);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link href="/admin" className="text-slate-600 hover:underline">
          ← بازگشت به لیست
        </Link>
        <Link
          href="/admin"
          className="rounded-full bg-[#7F4700] px-3 py-1 text-white hover:opacity-90"
        >
          تغییر وضعیت روی کارت
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* در RTL ستون اول سمت راست است: مشخصات */}
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <CustomBadge />
            <h1 className="text-xl font-bold">{toFaDigits(order.code)}</h1>
            <Badge className="bg-emerald-50 text-emerald-900">
              {ORDER_STATUS_LABEL[order.status] || order.status}
            </Badge>
            {delay && <Badge className="bg-red-600 text-white">{delay}</Badge>}
          </div>

          <p className="text-sm text-slate-700">
            پیگیری: <strong>{owner.unit}</strong> — {owner.person}
          </p>

          <dl className="grid gap-2 text-sm md:grid-cols-2">
            <div>مشتری: {order.customerName}</div>
            <div>موبایل: {toFaDigits(order.customerPhone)}</div>
            <div>گروه: {PRODUCT_GROUP_LABEL[order.productGroup] || order.productGroup}</div>
            <div>نام محصول: {order.productName || "—"}</div>
            <div>تأمین‌کننده: {order.supplierName || "—"}</div>
            <div>موعد تحویل: {order.supplierDueAt ? toJalaliDateTime(order.supplierDueAt) : "—"}</div>
            <div className="md:col-span-2">آدرس: {order.shippingAddress}</div>
            <div className="md:col-span-2">توضیحات: {order.description || "—"}</div>
            {order.sizeLines.length > 0 && (
              <div className="md:col-span-2">
                سایز/تعداد:{" "}
                {order.sizeLines
                  .map((l) => `${toFaDigits(l.size)}×${toFaDigits(l.quantity)}`)
                  .join("، ")}
              </div>
            )}
          </dl>

          {order.files.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-bold">عکس طرح</h3>
              <OrderCardPhotos
                size="md"
                photos={order.files.filter((f) => f.mimeType.startsWith("image/"))}
              />
              {order.files.some((f) => !f.mimeType.startsWith("image/")) && (
                <ul className="mt-2 space-y-1 text-sm">
                  {order.files
                    .filter((f) => !f.mimeType.startsWith("image/"))
                    .map((f) => (
                      <li key={f.id}>
                        <a className="text-[#03613C] underline" href={`/api/files/${f.id}`}>
                          {f.originalName}
                        </a>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          )}
        </Card>

        {/* ستون دوم سمت چپ: لاگ */}
        <Card>
          <h2 className="mb-1 font-bold">لاگ سفارش</h2>
          <p className="mb-3 text-xs text-slate-500">
            چه کسی، چه زمانی تأیید زده و به مرحله بعد فرستاده است.
          </p>
          <Timeline items={order.history} />
        </Card>
      </div>
    </div>
  );
}
