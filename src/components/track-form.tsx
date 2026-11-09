"use client";

import { useState, useTransition } from "react";
import { requestTrackOtp, verifyTrackAccess } from "@/lib/actions/customer";
import { ORDER_STATUS_LABEL } from "@/lib/constants";
import { toFaDigits, toJalaliDateTime } from "@/lib/utils";
import { Timeline } from "./timeline";
import { Button, Card, Input, Label } from "./ui";

type TrackOrder = {
  code: string;
  status: string;
  customerName: string;
  history: {
    id: string;
    fromStatus: string | null;
    toStatus: string;
    note: string | null;
    createdAt: Date;
    actorType: string;
  }[];
  files: { id: string; originalName: string; createdAt: Date }[];
};

export function TrackForm({ initialCode }: { initialCode?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [order, setOrder] = useState<TrackOrder | null>(null);

  function onOtp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      setError(null);
      const res = await requestTrackOtp(String(fd.get("code")), String(fd.get("phone")));
      if (!res.ok) return setError(res.error);
      setHint(res.previewCode ? `کد آزمایشی: ${toFaDigits(res.previewCode)}` : "کد ارسال شد.");
    });
  }

  function onVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      setError(null);
      const res = await verifyTrackAccess(
        String(fd.get("code")),
        String(fd.get("phone")),
        String(fd.get("otp"))
      );
      if (!res.ok) return setError(res.error);
      setOrder(res.order as TrackOrder);
    });
  }

  if (order) {
    return (
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold">سفارش {toFaDigits(order.code)}</h2>
          <span className="text-sm text-[#03613C]">
            {ORDER_STATUS_LABEL[order.status] || order.status}
          </span>
        </div>
        <Timeline items={order.history} />
        <div>
          <h3 className="mb-2 font-medium">فایل‌های طرح (خصوصی)</h3>
          <ul className="space-y-1 text-sm">
            {order.files.map((f) => (
              <li key={f.id}>
                <a className="text-[#03613C] underline" href={`/api/files/${f.id}`}>
                  {f.originalName}
                </a>{" "}
                <span className="text-slate-400">{toJalaliDateTime(f.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      </Card>
    );
  }

  return (
    <Card className="max-w-lg space-y-4">
      <h1 className="text-2xl font-bold text-[#03613C]">پیگیری سفارش</h1>
      <form onSubmit={onOtp} className="space-y-3">
        <div>
          <Label>کد رهگیری</Label>
          <Input name="code" defaultValue={initialCode} required />
        </div>
        <div>
          <Label>موبایل</Label>
          <Input name="phone" required />
        </div>
        <Button type="submit" variant="ghost" disabled={pending}>
          دریافت OTP
        </Button>
      </form>
      {hint && <p className="text-sm text-emerald-800">{hint}</p>}
      <form onSubmit={onVerify} className="space-y-3">
        <div>
          <Label>کد رهگیری</Label>
          <Input name="code" defaultValue={initialCode} required />
        </div>
        <div>
          <Label>موبایل</Label>
          <Input name="phone" required />
        </div>
        <div>
          <Label>OTP</Label>
          <Input name="otp" required />
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <Button type="submit" disabled={pending}>
          مشاهده تایم‌لاین
        </Button>
      </form>
    </Card>
  );
}
