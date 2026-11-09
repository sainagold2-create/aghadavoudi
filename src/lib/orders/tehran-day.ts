/** Calendar-day helpers anchored to Asia/Tehran end-of-day. */

function tehranParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

export function tehranDayKey(date: Date): string {
  const { year, month, day } = tehranParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Approximate UTC instant for end of Tehran calendar day of `date`. */
export function endOfTehranDay(date: Date): Date {
  const { year, month, day } = tehranParts(date);
  // Tehran is UTC+3:30 without DST; end of day 23:59:59.999 local ≈ 20:29:59.999 UTC
  return new Date(Date.UTC(year, month - 1, day, 20, 29, 59, 999));
}

/** Whole calendar days from Tehran "today" until due day (can be negative). */
export function daysUntilDue(due: Date, now = new Date()): number {
  const today = tehranDayKey(now);
  const dueKey = tehranDayKey(due);
  const [ty, tm, td] = today.split("-").map(Number);
  const [dy, dm, dd] = dueKey.split("-").map(Number);
  const t = Date.UTC(ty, tm - 1, td);
  const d = Date.UTC(dy, dm - 1, dd);
  return Math.round((d - t) / 86_400_000);
}

/** End of Tehran calendar day that is `days` after `from` (default: tomorrow). */
export function endOfTehranDayPlus(days: number, from = new Date()): Date {
  const { year, month, day } = tehranParts(from);
  const base = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return endOfTehranDay(base);
}

/** سفارش تازه ثبت‌شده باید حداکثر تا پایان فردا تعیین‌تکلیف شود. */
export function defaultOrdersDecisionDueAt(from = new Date()): Date {
  return endOfTehranDayPlus(1, from);
}
