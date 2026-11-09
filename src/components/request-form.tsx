"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlangoSizeTable,
  alangoQuantitiesToLines,
  emptyAlangoQuantities,
} from "@/components/alango-size-table";
import { requestSubmitOtp, submitCustomOrder } from "@/lib/actions/customer";
import { ALANGO_GROUP, CONFIRM_TEXT, PRODUCT_GROUPS } from "@/lib/constants";
import { toFaDigits } from "@/lib/utils";
import { PersianFileInput } from "./persian-file-input";
import { Button, Input, Label, Textarea, Card } from "./ui";

export function RequestForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [otpHint, setOtpHint] = useState<string | null>(null);
  const [productGroup, setProductGroup] = useState(PRODUCT_GROUPS[0].value);
  const [alangoQty, setAlangoQty] = useState(emptyAlangoQuantities);

  const isAlango = productGroup === ALANGO_GROUP;

  const sizePayload = useMemo(() => alangoQuantitiesToLines(alangoQty), [alangoQty]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("productGroup", productGroup);
    if (isAlango) {
      fd.set("sizeLinesJson", JSON.stringify(sizePayload));
    }
    start(async () => {
      setError(null);
      const res = await submitCustomOrder(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/orders/${res.code}`);
    });
  }

  return (
    <Card className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#03613C]">ثبت درخواست ساخت</h1>
        <p className="mt-1 text-sm text-slate-600">
          گروه محصول را انتخاب کنید. برای النگو جدول سایز و تعداد باز می‌شود؛ برای سایر گروه‌ها
          توضیحات وارد شود.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4" encType="multipart/form-data">
        <div>
          <Label>نام</Label>
          <Input name="name" required />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1">
            <Label>موبایل</Label>
            <Input name="phone" required placeholder="۰۹۱۲۱۲۳۴۵۶۷" />
          </div>
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={(e) => {
              const form = (e.currentTarget as HTMLButtonElement).closest("form");
              if (!form) return;
              const phone = new FormData(form).get("phone");
              start(async () => {
                setError(null);
                const res = await requestSubmitOtp(String(phone || ""));
                if (!res.ok) {
                  setError(res.error);
                  return;
                }
                setOtpHint(
                  res.previewCode ? `کد آزمایشی: ${toFaDigits(res.previewCode)}` : "کد ارسال شد."
                );
              });
            }}
          >
            دریافت OTP
          </Button>
        </div>
        {otpHint && <p className="text-sm text-emerald-800">{otpHint}</p>}
        <div>
          <Label>کد OTP</Label>
          <Input name="otp" required placeholder="۱۲۳۴۵" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>گروه محصول</Label>
            <select
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-[#03613C]"
              value={productGroup}
              onChange={(e) => {
                setProductGroup(e.target.value as typeof productGroup);
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
            <Label>نام محصول (در صورت مشخص بودن)</Label>
            <Input name="productName" placeholder="مثلاً النگو کلاسیک طرح گل" />
          </div>
        </div>

        {isAlango ? (
          <div className="space-y-3">
            <AlangoSizeTable
              quantities={alangoQty}
              onChange={(size, quantity) =>
                setAlangoQty((q) => ({ ...q, [size]: quantity }))
              }
            />
            <div>
              <Label>توضیحات تکمیلی (اختیاری)</Label>
              <Textarea name="description" rows={2} placeholder="متریال، رنگ، حکاکی و ..." />
            </div>
          </div>
        ) : (
          <div className="space-y-3 rounded-xl border border-[#7F4700]/15 bg-amber-50/40 p-4">
            <p className="text-sm text-slate-600">
              برای این گروه محصول، مشخصات و جزئیات ساخت را در توضیحات بنویسید.
            </p>
            <div>
              <Label>توضیحات</Label>
              <Textarea
                name="description"
                rows={4}
                required
                placeholder="متریال، رنگ، ابعاد، ویژگی‌ها و هر توضیح لازم"
              />
            </div>
          </div>
        )}

        <div>
          <Label>آدرس ارسال</Label>
          <Textarea name="shippingAddress" rows={2} required />
        </div>
        <PersianFileInput
          name="designFiles"
          multiple
          required
          accept="image/*,.pdf,.ai,.psd"
          label="فایل‌های طرح"
          hint="می‌توانید چند فایل یا عکس انتخاب کنید"
        />

        <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950 ring-1 ring-amber-200">
          <label className="flex items-start gap-2">
            <input type="checkbox" name="confirmed" value="true" required className="mt-1" />
            <span>{CONFIRM_TEXT}</span>
          </label>
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "در حال ثبت..." : "ثبت درخواست"}
        </Button>
      </form>
    </Card>
  );
}
