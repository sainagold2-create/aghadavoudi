import { appBaseUrl } from "@/lib/utils";
import { toJalali } from "@/lib/utils";

export function smsSubmitted(code: string) {
  const tracking_url = `${appBaseUrl()}/track?code=${encodeURIComponent(code)}`;
  return `درخواست ساخت شما در سایناگلد تأیید و ثبت شد. کد ${code} | پیگیری ${tracking_url}`;
}

export function smsProductionStarted(code: string, readyDate?: Date | null) {
  const tracking_url = `${appBaseUrl()}/track?code=${encodeURIComponent(code)}`;
  if (readyDate) {
    return `ساخت سفارش ${code} آغاز شد. آمادگی تقریبی ${toJalali(readyDate)} | ${tracking_url}`;
  }
  return `ساخت سفارش ${code} آغاز شد. | ${tracking_url}`;
}

export function smsCompleted(code: string) {
  const cart_url = `${appBaseUrl()}/cart`;
  return `محصول سفارش ${code} آماده شد و به سبد خرید شما اضافه شد. مشاهده سبد ${cart_url}`;
}
