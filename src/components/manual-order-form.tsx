"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ALANGO_FIXED_SIZES,
  alangoQuantitiesToLines,
  emptyAlangoQuantities,
} from "@/components/alango-size-table";
import { createManualOrder, searchCustomersForManual } from "@/lib/actions/admin";
import { ALANGO_GROUP, PRODUCT_GROUPS } from "@/lib/constants";
import { toFaDigits } from "@/lib/utils";
import { PersianFileInput } from "./persian-file-input";
import { Button, Input } from "./ui";

type CustomerOption = { id: string; name: string; phone: string };

const field =
  "w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[#03613C]";

export function ManualOrderForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerOption[]>([]);
  const [selected, setSelected] = useState<CustomerOption | null>(null);
  const [searching, setSearching] = useState(false);
  const [productGroup, setProductGroup] = useState(PRODUCT_GROUPS[0].value);
  const [alangoQty, setAlangoQty] = useState(emptyAlangoQuantities);

  const isAlango = productGroup === ALANGO_GROUP;
  const sizePayload = useMemo(() => alangoQuantitiesToLines(alangoQty), [alangoQty]);

  function close() {
    setOpen(false);
    setSelected(null);
    setQuery("");
    setMsg(null);
    setResults([]);
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open || selected) {
      setResults([]);
      return;
    }
    if (query.trim().length < 1) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const rows = await searchCustomersForManual(query);
        if (!cancelled) setResults(rows);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, open, selected]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-[#7F4700] px-3 py-1 text-sm text-[#7F4700] hover:bg-[#7F4700]/10"
      >
        + ثبت سفارش دستی
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="manual-order-title"
            className="w-full max-w-md rounded-2xl border border-[#7F4700]/20 bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 id="manual-order-title" className="text-sm font-bold text-[#7F4700]">
                ثبت سفارش دستی → تأمین
              </h2>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
                onClick={close}
              >
                بستن
              </button>
            </div>

            <form
              className="flex flex-col gap-2.5"
              onSubmit={(e) => {
                e.preventDefault();
                if (!selected) {
                  setMsg("مشتری را از لیست انتخاب کنید.");
                  return;
                }
                if (isAlango && sizePayload.length === 0) {
                  setMsg("برای النگو حداقل یک سایز با تعداد وارد کنید.");
                  return;
                }
                const fd = new FormData(e.currentTarget);
                const productName = String(fd.get("productName") || "").trim();
                const hasPhoto = fd
                  .getAll("designFiles")
                  .some((f) => f instanceof File && f.size > 0);
                if (!productName && !hasPhoto) {
                  setMsg("حداقل یکی از «نام محصول» یا «عکس طرح» باید پر شود.");
                  return;
                }
                fd.set("customerId", selected.id);
                fd.set("productGroup", productGroup);
                if (isAlango) fd.set("sizeLinesJson", JSON.stringify(sizePayload));
                start(async () => {
                  setMsg(null);
                  try {
                    const res = await createManualOrder(fd);
                    if (!res.ok) {
                      setMsg(res.error || "خطا");
                      return;
                    }
                    close();
                    setAlangoQty(emptyAlangoQuantities());
                    router.refresh();
                  } catch (err: unknown) {
                    setMsg(err instanceof Error ? err.message : "خطای ثبت");
                  }
                });
              }}
            >
              <div className="relative">
                <label className="mb-1 block text-xs text-slate-600">مشتری</label>
                {selected ? (
                  <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-sm">
                    <span>{selected.name}</span>
                    <button
                      type="button"
                      className="text-xs text-slate-600 underline"
                      onClick={() => {
                        setSelected(null);
                        setQuery("");
                      }}
                    >
                      تغییر
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      className={field}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="جستجوی نام مشتری..."
                      autoComplete="off"
                      autoFocus
                    />
                    {(searching || results.length > 0 || query.trim()) && (
                      <ul className="absolute z-20 mt-1 max-h-36 w-full overflow-auto rounded-lg border bg-white text-sm shadow-md">
                        {searching && (
                          <li className="px-3 py-2 text-xs text-slate-500">در حال جستجو...</li>
                        )}
                        {!searching &&
                          results.map((c) => (
                            <li key={c.id}>
                              <button
                                type="button"
                                className="block w-full px-3 py-2 text-right hover:bg-emerald-50"
                                onClick={() => {
                                  setSelected(c);
                                  setResults([]);
                                }}
                              >
                                {c.name}
                                <span className="mr-2 text-xs text-slate-400">
                                  {toFaDigits(c.phone)}
                                </span>
                              </button>
                            </li>
                          ))}
                        {!searching && results.length === 0 && query.trim() && (
                          <li className="px-3 py-2 text-xs text-slate-500">موردی یافت نشد</li>
                        )}
                      </ul>
                    )}
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs text-slate-600">گروه محصول</label>
                  <select
                    className={field}
                    value={productGroup}
                    onChange={(e) => {
                      setProductGroup(e.target.value);
                      setAlangoQty(emptyAlangoQuantities());
                    }}
                    required
                  >
                    {PRODUCT_GROUPS.map((g) => (
                      <option key={g.value} value={g.value}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-600">نام محصول</label>
                  <Input
                    name="productName"
                    placeholder="یا عکس طرح"
                    className="!rounded-lg !px-2.5 !py-1.5 !text-sm"
                  />
                </div>
              </div>

              {isAlango && (
                <div>
                  <label className="mb-1 block text-xs text-slate-600">سایز و تعداد</label>
                  <div className="grid grid-cols-4 gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/50 p-2">
                    {ALANGO_FIXED_SIZES.map((size) => (
                      <label key={size} className="flex flex-col gap-0.5 text-[11px]">
                        <span className="text-slate-600">سایز {toFaDigits(size)}</span>
                        <input
                          type="number"
                          min={0}
                          className="w-full rounded border border-black/10 px-1.5 py-1 text-sm"
                          value={alangoQty[size] ?? ""}
                          onChange={(e) =>
                            setAlangoQty((q) => ({ ...q, [size]: e.target.value }))
                          }
                          placeholder="۰"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <PersianFileInput
                name="designFiles"
                accept="image/*"
                multiple
                label="عکس طرح"
                hint="یا نام محصول — می‌توانید چند عکس انتخاب کنید"
              />

              <div>
                <label className="mb-1 block text-xs text-slate-600">
                  توضیحات{isAlango ? " (اختیاری)" : ""}
                </label>
                <textarea
                  name="description"
                  rows={2}
                  required={!isAlango}
                  placeholder="توضیحات سفارش..."
                  className={`${field} resize-y`}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                {msg && <p className="me-auto text-xs text-red-700">{msg}</p>}
                <button
                  type="button"
                  onClick={close}
                  className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                >
                  انصراف
                </button>
                <Button type="submit" disabled={pending || !selected} className="!rounded-lg !px-4 !py-1.5 !text-sm">
                  {pending ? "در حال ثبت..." : "ثبت سفارش"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
