"use client";

import { toFaDigits } from "@/lib/utils";
import { Input, Label } from "./ui";

export const ALANGO_FIXED_SIZES = ["1", "2", "3", "4"] as const;

export function AlangoSizeTable({
  quantities,
  onChange,
}: {
  quantities: Record<string, string>;
  onChange: (size: string, quantity: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#03613C]/20 bg-emerald-50/40">
      <table className="w-full text-sm">
        <thead className="bg-emerald-100/60 text-right text-xs text-emerald-900">
          <tr>
            <th className="px-3 py-2 font-medium">سایز</th>
            <th className="px-3 py-2 font-medium">تعداد</th>
          </tr>
        </thead>
        <tbody>
          {ALANGO_FIXED_SIZES.map((size) => (
            <tr key={size} className="border-t border-emerald-100">
              <td className="px-3 py-2 font-medium text-slate-800">سایز {toFaDigits(size)}</td>
              <td className="px-3 py-2">
                <Input
                  type="number"
                  min={0}
                  name={`alangoQty_${size}`}
                  value={quantities[size] ?? ""}
                  onChange={(e) => onChange(size, e.target.value)}
                  placeholder="۰"
                  className="max-w-[8rem]"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-emerald-100 px-3 py-2 text-[11px] text-slate-500">
        فقط برای سایزهایی که تعداد دارند ثبت می‌شود؛ حداقل یک سایز با تعداد بیشتر از صفر لازم است.
      </p>
    </div>
  );
}

export function alangoQuantitiesToLines(quantities: Record<string, string>) {
  return ALANGO_FIXED_SIZES.map((size) => ({
    size,
    quantity: Number(quantities[size] || 0),
  })).filter((r) => r.quantity > 0);
}

export function emptyAlangoQuantities(): Record<string, string> {
  return Object.fromEntries(ALANGO_FIXED_SIZES.map((s) => [s, ""]));
}
