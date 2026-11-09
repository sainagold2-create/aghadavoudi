import Link from "next/link";
import { Card } from "@/components/ui";

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-4xl font-extrabold text-[#03613C]">سایناگلد</h1>
        <p className="max-w-2xl text-lg text-slate-700">
          پنل مشتری برای ثبت و پیگیری سفارش ساختنی.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/request"
            className="rounded-xl bg-[#03613C] px-5 py-3 text-white hover:bg-[#024d30]"
          >
            ثبت درخواست ساخت
          </Link>
          <Link
            href="/track"
            className="rounded-xl border border-[#03613C]/30 px-5 py-3 text-[#03613C]"
          >
            پیگیری با کد
          </Link>
          <Link
            href="/me/orders"
            className="rounded-xl border border-[#03613C]/30 px-5 py-3 text-[#03613C]"
          >
            سفارش‌های من
          </Link>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="font-bold text-[#7F4700]">ثبت سفارش</h2>
          <p className="mt-2 text-sm text-slate-600">
            انتخاب گروه محصول، نام (در صورت مشخص بودن)، سایز/تعداد برای النگو یا توضیحات برای سایر
            گروه‌ها.
          </p>
        </Card>
        <Card>
          <h2 className="font-bold text-[#7F4700]">پیگیری و سبد</h2>
          <p className="mt-2 text-sm text-slate-600">
            تایم‌لاین سفارش و سبد آزمایشی پس از آماده‌شدن محصول.
          </p>
        </Card>
      </div>
    </div>
  );
}
