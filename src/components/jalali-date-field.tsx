"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  JALALI_MONTHS,
  JALALI_WEEKDAYS,
  currentJalaliParts,
  daysInJalaliMonth,
  formatJalaliPretty,
  jalaliMonthStartWeekday,
  jalaliPartsToGregorianIso,
} from "@/lib/jalali";
import { toFaDigits } from "@/lib/utils";

export function JalaliDateField({
  name,
  required,
  label,
}: {
  name: string;
  required?: boolean;
  label?: string;
}) {
  const today = useMemo(() => currentJalaliParts(), []);
  const [selected, setSelected] = useState<{ jy: number; jm: number; jd: number } | null>(
    null
  );
  const [view, setView] = useState({ jy: today.jy, jm: today.jm });
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const iso = selected
    ? jalaliPartsToGregorianIso(selected.jy, selected.jm, selected.jd)
    : "";

  const days = daysInJalaliMonth(view.jy, view.jm);
  const startPad = jalaliMonthStartWeekday(view.jy, view.jm);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function shiftMonth(delta: number) {
    setView((v) => {
      let jm = v.jm + delta;
      let jy = v.jy;
      if (jm < 1) {
        jm = 12;
        jy -= 1;
      } else if (jm > 12) {
        jm = 1;
        jy += 1;
      }
      return { jy, jm };
    });
  }

  function pick(jd: number) {
    setSelected({ jy: view.jy, jm: view.jm, jd });
    setOpen(false);
  }

  const cells: (number | null)[] = [
    ...Array.from({ length: startPad }, () => null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div ref={rootRef} className="relative space-y-1">
      {label && <p className="text-xs text-slate-500">{label}</p>}
      <input type="hidden" name={name} value={iso} required={required} />

      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          if (selected) setView({ jy: selected.jy, jm: selected.jm });
          else setView({ jy: today.jy, jm: today.jm });
        }}
        className="flex w-full items-center justify-between rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-right hover:border-slate-300"
      >
        <span className={selected ? "text-slate-800" : "text-slate-400"}>
          {selected
            ? formatJalaliPretty(selected.jy, selected.jm, selected.jd)
            : "انتخاب تاریخ"}
        </span>
        <span className="text-slate-400" aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div className="absolute z-40 mt-1 w-[17.5rem] rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-50"
              aria-label="ماه بعد"
            >
              ‹
            </button>
            <p className="text-sm font-medium text-slate-800">
              {JALALI_MONTHS[view.jm - 1]} {toFaDigits(view.jy)}
            </p>
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-50"
              aria-label="ماه قبل"
            >
              ›
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 text-center text-[11px] text-slate-400">
            {JALALI_WEEKDAYS.map((d) => (
              <span key={d} className="py-1">
                {d}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center">
            {cells.map((day, i) => {
              if (day == null) {
                return <span key={`e-${i}`} className="h-8" />;
              }
              const isSelected =
                selected?.jy === view.jy &&
                selected?.jm === view.jm &&
                selected?.jd === day;
              const isToday =
                today.jy === view.jy && today.jm === view.jm && today.jd === day;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => pick(day)}
                  className={`h-8 rounded-md text-sm transition ${
                    isSelected
                      ? "bg-[#03613C] text-white"
                      : isToday
                        ? "bg-emerald-50 text-emerald-900"
                        : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {toFaDigits(day)}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="mt-2 w-full rounded-md py-1.5 text-xs text-slate-500 hover:bg-slate-50"
            onClick={() => {
              setSelected({ jy: today.jy, jm: today.jm, jd: today.jd });
              setView({ jy: today.jy, jm: today.jm });
              setOpen(false);
            }}
          >
            امروز
          </button>
        </div>
      )}
    </div>
  );
}
