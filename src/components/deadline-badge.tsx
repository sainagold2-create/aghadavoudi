import { DEADLINE_TONE_CLASS, deadlineTone, isDelayed } from "@/lib/orders/deadlines";
import { toFaDigits, toJalali } from "@/lib/utils";
import { Badge } from "./ui";

export function DeadlineBadge({
  label,
  due,
  doneAt,
}: {
  label: string;
  due: Date | null | undefined;
  doneAt?: Date | null;
}) {
  const tone = deadlineTone(due, doneAt);
  const delayed = isDelayed(due, doneAt);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-slate-500">{label}</span>
      <Badge className={DEADLINE_TONE_CLASS[tone]}>
        {due ? toJalali(due) : "ثبت‌نشده"}
      </Badge>
      {delayed && <Badge className="bg-red-600 text-white">تأخیر</Badge>}
      {doneAt && (
        <span className="text-xs text-slate-500">انجام: {toFaDigits(toJalali(doneAt))}</span>
      )}
    </div>
  );
}
