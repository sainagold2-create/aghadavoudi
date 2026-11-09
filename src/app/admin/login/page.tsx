"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Label } from "@/components/ui";

export default function AdminLoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  return (
    <Card className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-bold text-[#03613C]">ورود پنل عملیات</h1>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const res = await signIn("credentials", {
            email: String(fd.get("email")),
            password: String(fd.get("password")),
            redirect: false,
          });
          if (res?.error) {
            setError("ورود ناموفق");
            return;
          }
          router.push("/admin");
          router.refresh();
        }}
      >
        <div>
          <Label>ایمیل</Label>
          <Input name="email" type="email" defaultValue="admin@sainagold.ir" required />
        </div>
        <div>
          <Label>رمز</Label>
          <Input name="password" type="password" defaultValue="SainaGold@1404" required />
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <Button type="submit">ورود</Button>
      </form>
      <p className="text-xs leading-6 text-slate-500">
        مدیر: admin@sainagold.ir · سفارشات: orders@sainagold.ir · تأمین: supply@sainagold.ir
        <br />
        رمز همه: SainaGold@1404
      </p>
    </Card>
  );
}
