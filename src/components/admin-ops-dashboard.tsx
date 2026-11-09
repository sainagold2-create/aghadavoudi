"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { toFaDigits } from "@/lib/utils";
import type { buildOpsDashboard } from "@/lib/orders/dashboard-stats";

type Stats = ReturnType<typeof buildOpsDashboard>;

function StatLink({
  href,
  label,
  value,
  hint,
  alert,
}: {
  href: string;
  label: string;
  value: number;
  hint?: string;
  alert?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex min-w-[5.25rem] flex-1 flex-col rounded-lg border px-2.5 py-2 transition hover:border-[#03613C]/30 ${
        alert ? "border-red-200 bg-red-50/60" : "border-black/5 bg-white/80"
      }`}
    >
      <span className="text-[10px] text-slate-500">{label}</span>
      <span
        className={`text-lg font-semibold tabular-nums ${
          alert ? "text-red-700" : "text-slate-800"
        }`}
      >
        {toFaDigits(value)}
      </span>
      {hint && <span className="text-[9px] text-slate-400">{hint}</span>}
    </Link>
  );
}

function UnitBar({
  label,
  onTimeRate,
  delayed,
  queue,
  extra,
  color,
}: {
  label: string;
  onTimeRate: number;
  delayed: number;
  queue: number;
  extra?: string;
  color: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-[11px]">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="text-slate-500">
          به‌موقع {toFaDigits(onTimeRate)}٪
          <span className="text-slate-400">
            {" "}
            · تأخیر {toFaDigits(delayed)} از {toFaDigits(queue)}
          </span>
        </span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100" title={`به‌موقع ${onTimeRate}٪`}>
        <div className={`h-full ${color}`} style={{ width: `${onTimeRate}%` }} />
      </div>
      {extra && <p className="text-[9px] text-slate-400">{extra}</p>}
    </div>
  );
}

export function AdminOpsDashboard({ stats }: { stats: Stats }) {
  const [open, setOpen] = useState(false);
  const { units } = stats;

  return (
    <section className="overflow-hidden rounded-xl border border-[#03613C]/10 bg-white/90">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-right hover:bg-slate-50/80"
        aria-expanded={open}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-sm font-semibold text-[#03613C]">داشبورد عملیات</span>
          <span className="text-[11px] text-slate-500">
            تأخیری:{" "}
            <span className={stats.delayed > 0 ? "font-semibold text-red-600" : ""}>
              {toFaDigits(stats.delayed)}
            </span>
            <span className="text-slate-300"> · </span>
            سفارش امروز: {toFaDigits(stats.createdToday)}
            <span className="text-slate-300"> · </span>
            نیازمند پیگیری:{" "}
            <span className={stats.needsCheck > 0 ? "font-semibold text-red-600" : ""}>
              {toFaDigits(stats.needsCheck)}
            </span>
          </span>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="space-y-2.5 border-t border-black/5 p-3">
            <div className="flex flex-wrap gap-1.5">
              <StatLink href="/admin?tab=review" label="بررسی سفارش" value={stats.review} />
              <StatLink
                href="/admin?tab=supply_order"
                label="اقدام تأمین"
                value={stats.supplyAction}
              />
              <StatLink
                href="/admin?tab=supply_order"
                label="منتظر موعد"
                value={stats.waitingFuture}
              />
              <StatLink
                href="/admin?tab=needs_check"
                label="نیازمند پیگیری"
                value={stats.needsCheck}
                alert={stats.needsCheck > 0}
              />
              <div
                className={`flex min-w-[5.25rem] flex-1 flex-col rounded-lg border px-2.5 py-2 ${
                  stats.delayed > 0
                    ? "border-red-200 bg-red-50/60"
                    : "border-black/5 bg-white/80"
                }`}
              >
                <span className="text-[10px] text-slate-500">تأخیری</span>
                <span
                  className={`text-lg font-semibold tabular-nums ${
                    stats.delayed > 0 ? "text-red-700" : "text-slate-800"
                  }`}
                >
                  {toFaDigits(stats.delayed)}
                </span>
              </div>
              <div className="flex min-w-[5.25rem] flex-1 flex-col rounded-lg border border-black/5 bg-white/80 px-2.5 py-2">
                <span className="text-[10px] text-slate-500">سفارش امروز</span>
                <span className="text-lg font-semibold tabular-nums text-slate-800">
                  {toFaDigits(stats.createdToday)}
                </span>
                <span className="text-[9px] text-slate-400">
                  تکمیل امروز: {toFaDigits(stats.completedToday)}
                </span>
              </div>
            </div>

            <div className="grid gap-3 border-t border-black/5 pt-2.5 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-[10px] text-slate-400">عملکرد پیگیری — مقایسه واحدها</p>
                <div className="space-y-3">
                  <UnitBar
                    label={units.orders.label}
                    onTimeRate={units.orders.onTimeRate}
                    delayed={units.orders.delayed}
                    queue={units.orders.queue}
                    color="bg-[#03613C]"
                    extra="تأخیر بررسی سفارشات باز"
                  />
                  <UnitBar
                    label={units.supply.label}
                    onTimeRate={units.supply.onTimeRate}
                    delayed={units.supply.delayed}
                    queue={units.supply.queue}
                    color="bg-[#7F4700]"
                    extra={`تأخیر سررسید تأمین · رویداد تأخیر ثبت‌شده: ${toFaDigits(units.supply.delayEvents)}`}
                  />
                </div>
              </div>

              <div className="flex items-end gap-3 sm:justify-end">
                <div className="flex h-24 items-end gap-2" aria-label="نمودار تأخیر واحدها">
                  <div className="flex w-12 flex-col items-center gap-1">
                    <span className="text-[10px] tabular-nums text-slate-600">
                      {toFaDigits(units.orders.delayed)}
                    </span>
                    <div
                      className="w-8 rounded-t bg-[#03613C]/80"
                      style={{
                        height: `${Math.max(4, units.orders.delayed * 14)}px`,
                        maxHeight: "72px",
                      }}
                      title="تأخیر سفارشات"
                    />
                    <span className="text-[9px] text-slate-400">سفارشات</span>
                  </div>
                  <div className="flex w-12 flex-col items-center gap-1">
                    <span className="text-[10px] tabular-nums text-slate-600">
                      {toFaDigits(units.supply.delayed)}
                    </span>
                    <div
                      className="w-8 rounded-t bg-[#7F4700]/80"
                      style={{
                        height: `${Math.max(4, units.supply.delayed * 14)}px`,
                        maxHeight: "72px",
                      }}
                      title="تأخیر تأمین"
                    />
                    <span className="text-[9px] text-slate-400">تأمین</span>
                  </div>
                </div>
                <p className="max-w-[9rem] pb-5 text-[10px] leading-relaxed text-slate-400">
                  ستون‌ها تعداد تأخیر باز هر واحد را نشان می‌دهند.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
