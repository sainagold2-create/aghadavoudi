import Link from "next/link";
import { BRAND } from "@/lib/constants";

export function AdminHeader() {
  return (
    <header className="border-b border-[#7F4700]/20 bg-[#7F4700]/5 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
        <Link href="/admin" className="text-xl font-extrabold tracking-tight text-[#7F4700]">
          {BRAND.name}
          <span className="mr-2 text-sm font-medium text-[#03613C]">پنل عملیات</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-3 text-sm">
          <Link href="/admin" className="hover:text-[#7F4700]">
            همه کارت‌ها
          </Link>
          <Link href="/admin?tab=review" className="hover:text-[#7F4700]">
            بررسی سفارش
          </Link>
          <Link href="/admin?tab=supply_order" className="hover:text-[#7F4700]">
            سفارش به تأمین
          </Link>
          <Link href="/admin?tab=needs_check" className="hover:text-[#7F4700]">
            نیازمند بررسی
          </Link>
          <Link href="/admin/login" className="text-slate-600 hover:underline">
            ورود کارکنان
          </Link>
        </nav>
      </div>
    </header>
  );
}
