import { jalaaliMonthLength, toGregorian, toJalaali } from "jalaali-js";
import { toFaDigits } from "./utils";

export function gregorianToJalaliParts(date: Date) {
  const { jy, jm, jd } = toJalaali(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate()
  );
  return { jy, jm, jd };
}

export function jalaliPartsToGregorianIso(jy: number, jm: number, jd: number): string {
  const { gy, gm, gd } = toGregorian(jy, jm, jd);
  const mm = String(gm).padStart(2, "0");
  const dd = String(gd).padStart(2, "0");
  return `${gy}-${mm}-${dd}`;
}

export function formatJalaliInputLabel(jy: number, jm: number, jd: number) {
  return toFaDigits(
    `${jy}/${String(jm).padStart(2, "0")}/${String(jd).padStart(2, "0")}`
  );
}

export function formatJalaliPretty(jy: number, jm: number, jd: number) {
  return `${toFaDigits(jd)} ${JALALI_MONTHS[jm - 1]} ${toFaDigits(jy)}`;
}

export function currentJalaliParts() {
  return gregorianToJalaliParts(new Date());
}

export function currentJalaliYear() {
  return currentJalaliParts().jy;
}

export function daysInJalaliMonth(jy: number, jm: number) {
  return jalaaliMonthLength(jy, jm);
}

/** Index 0 = شنبه … 6 = جمعه for the 1st of the Jalali month */
export function jalaliMonthStartWeekday(jy: number, jm: number) {
  const { gy, gm, gd } = toGregorian(jy, jm, 1);
  // JS: 0=Sun … 6=Sat → Iranian week start Sat
  return (new Date(gy, gm - 1, gd).getDay() + 1) % 7;
}

export const JALALI_WEEKDAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

export const JALALI_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];
