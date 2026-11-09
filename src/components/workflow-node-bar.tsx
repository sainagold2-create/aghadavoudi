"use client";

import { WORKFLOW_NODES, type WorkflowNodeId } from "@/lib/orders/workflow-nodes";

type Props = {
  activeIndex: number;
  dueReached: boolean;
  status: string;
  /** سررسید رسیده — روی گره تأمین تأکید بصری، بدون گره جدا */
  dueHighlight?: boolean;
  disabled?: boolean;
  onJump?: (nodeId: WorkflowNodeId) => void;
};

/** کدام گره‌ها از وضعیت فعلی قابل بازگشت/پرش هستند */
export function jumpTargetForStatus(
  status: string,
  _dueReached: boolean
): Partial<Record<WorkflowNodeId, string>> {
  if (status === "awaiting_supply") {
    return { review: "back_to_review" };
  }
  if (status === "awaiting_supplier" || status === "supplier_confirmed") {
    return { supply_order: "back_to_supply" };
  }
  return {};
}

export function WorkflowNodeBar({
  activeIndex,
  dueReached,
  status,
  dueHighlight,
  disabled,
  onJump,
}: Props) {
  const jumps = jumpTargetForStatus(status, dueReached);

  return (
    <ol className="inline-flex flex-wrap items-center gap-0.5 text-[9px] leading-none text-slate-400">
      {WORKFLOW_NODES.map((n, i) => {
        const canJump = !!jumps[n.id] && i < activeIndex && !!onJump;
        const isActive = i === activeIndex;
        const isPast = i < activeIndex;
        const emphasizeDue = dueHighlight && n.id === "supply_order" && isActive;

        let style = "text-slate-300";
        if (emphasizeDue) style = "font-medium text-red-500/80";
        else if (isActive) style = "font-medium text-slate-600";
        else if (isPast && canJump) style = "text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-700";
        else if (isPast) style = "text-slate-400";

        return (
          <li key={n.id} className="inline-flex items-center gap-0.5">
            <button
              type="button"
              disabled={disabled || !canJump}
              title={
                emphasizeDue
                  ? "سررسید رسیده — نیازمند پیگیری"
                  : canJump
                    ? `انتقال به «${n.label}»`
                    : n.label
              }
              onClick={() => {
                if (canJump && onJump) onJump(n.id);
              }}
              className={`px-0.5 transition disabled:cursor-default ${style}`}
            >
              {n.label}
            </button>
            {i < WORKFLOW_NODES.length - 1 && (
              <span className="text-slate-200" aria-hidden>
                ←
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
