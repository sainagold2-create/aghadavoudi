import { daysUntilDue } from "./tehran-day";

export type DeadlineTone = "none" | "green" | "yellow" | "orange" | "red";

export function deadlineTone(
  due: Date | null | undefined,
  doneAt: Date | null | undefined
): DeadlineTone {
  if (!due) return "none";
  if (doneAt) {
    // completed against due — still show based on remaining if done early, but not red
    const days = daysUntilDue(due, doneAt);
    if (days < 0) return "red"; // done late relative to due calendar day
    if (days <= 2) return "orange";
    if (days <= 5) return "yellow";
    return "green";
  }
  const days = daysUntilDue(due);
  if (days < 0) return "red";
  if (days <= 2) return "orange";
  if (days <= 5) return "yellow";
  return "green";
}

export function isDelayed(
  due: Date | null | undefined,
  doneAt: Date | null | undefined
): boolean {
  if (!due || doneAt) return false;
  return daysUntilDue(due) < 0;
}

export const DEADLINE_TONE_CLASS: Record<DeadlineTone, string> = {
  none: "bg-slate-200 text-slate-600",
  green: "bg-emerald-100 text-emerald-800",
  yellow: "bg-amber-100 text-amber-900",
  orange: "bg-orange-100 text-orange-900",
  red: "bg-red-100 text-red-800",
};
