import { redirect } from "next/navigation";

/** تغییر وضعیت روی خود کارت سفارش است. */
export default function AdminStatusRedirectPage() {
  redirect("/admin");
}
