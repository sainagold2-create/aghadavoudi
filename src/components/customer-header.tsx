import Link from "next/link";
import { BRAND } from "@/lib/constants";

export function CustomerHeader() {
  return (
    <header className="border-b border-black/5 bg-white/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="text-xl font-extrabold tracking-tight text-[#03613C]">
          {BRAND.name}
          <span className="mr-2 text-sm font-medium text-[#7F4700]">پنل مشتری</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-3 text-sm">
          <Link href="/request" className="hover:text-[#03613C]">
            ثبت درخواست
          </Link>
          <Link href="/track" className="hover:text-[#03613C]">
            پیگیری
          </Link>
          <Link href="/me/orders" className="hover:text-[#03613C]">
            سفارش‌های من
          </Link>
          <Link href="/cart" className="hover:text-[#03613C]">
            سبد آزمایشی
          </Link>
        </nav>
      </div>
    </header>
  );
}
