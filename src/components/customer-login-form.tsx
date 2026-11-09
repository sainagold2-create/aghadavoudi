"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { loginCustomerWithOtp } from "@/lib/actions/customer";
import { toFaDigits } from "@/lib/utils";
import { Button, Card, Input, Label } from "./ui";

export function CustomerLoginForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card className="max-w-md space-y-4">
      <p className="text-sm text-slate-600">با موبایل و OTP وارد حساب آزمایشی شوید.</p>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          start(async () => {
            setError(null);
            const res = await loginCustomerWithOtp(String(fd.get("phone")), undefined, "request");
            if (!res.ok) return setError(res.error);
            if ("previewCode" in res && res.previewCode) {
              setHint(`کد آزمایشی: ${toFaDigits(res.previewCode)}`);
            }
          });
        }}
      >
        <div>
          <Label>موبایل</Label>
          <Input name="phone" required />
        </div>
        <Button type="submit" variant="ghost" disabled={pending}>
          دریافت OTP
        </Button>
      </form>
      {hint && <p className="text-sm text-emerald-800">{hint}</p>}
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          start(async () => {
            setError(null);
            const res = await loginCustomerWithOtp(
              String(fd.get("phone")),
              String(fd.get("otp")),
              "verify"
            );
            if (!res.ok) return setError(res.error);
            router.refresh();
          });
        }}
      >
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
          ورود
        </Button>
      </form>
    </Card>
  );
}
