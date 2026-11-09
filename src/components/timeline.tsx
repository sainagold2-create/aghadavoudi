import { ORDER_STATUS_LABEL, STAFF_ROLE_LABEL } from "@/lib/constants";
import { toFaDigits, toJalaliDateTime } from "@/lib/utils";

type Item = {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  createdAt: Date;
  actorType: string;
  staff?: { name: string; role: string } | null;
};

function actorLabel(h: Item) {
  if (h.actorType === "customer") return "مشتری";
  if (h.actorType === "system") return "سیستم";
  if (h.staff) {
    const role = STAFF_ROLE_LABEL[h.staff.role] || h.staff.role;
    return `${h.staff.name} · ${role}`;
  }
  return "کارشناس";
}

export function Timeline({ items }: { items: Item[] }) {
  return (
    <ol className="space-y-4 border-r-2 border-[#03613C]/20 pr-4">
      {items.map((h) => {
        const moved =
          h.fromStatus && h.fromStatus !== h.toStatus
            ? `${ORDER_STATUS_LABEL[h.fromStatus] || h.fromStatus} → ${ORDER_STATUS_LABEL[h.toStatus] || h.toStatus}`
            : ORDER_STATUS_LABEL[h.toStatus] || h.toStatus;
        return (
          <li key={h.id} className="relative">
            <span className="absolute -right-[1.35rem] top-1 h-3 w-3 rounded-full bg-[#03613C]" />
            <div className="text-sm font-medium">{moved}</div>
            {h.note && <p className="mt-0.5 text-sm text-slate-700">{h.note}</p>}
            <p className="mt-1 text-xs text-slate-500">
              {toJalaliDateTime(h.createdAt)} · {actorLabel(h)}
            </p>
          </li>
        );
      })}
      {items.length === 0 && <p className="text-sm text-slate-500">رویدادی ثبت نشده است.</p>}
    </ol>
  );
}

export function Fa({ children }: { children: string | number }) {
  return <>{toFaDigits(children)}</>;
}
