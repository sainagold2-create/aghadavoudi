"use client";

import { useState } from "react";
import { JalaliDateField } from "@/components/jalali-date-field";
import { useUndoAction } from "@/components/undo-toast";
import { WorkflowNodeBar, jumpTargetForStatus } from "@/components/workflow-node-bar";
import { SUPPLIER_DELAY_REASONS } from "@/lib/constants";
import { needsFollowUpReview } from "@/lib/orders/delay-flags";
import { nodeIndex, type WorkflowNodeId } from "@/lib/orders/workflow-nodes";
import { Button, Textarea } from "./ui";

function OptionChip({
  active,
  disabled,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md border px-2 py-0.5 text-[11px] transition disabled:opacity-50 ${
        active
          ? "border-[#03613C] bg-emerald-50 text-emerald-900"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
      }`}
    >
      {children}
    </button>
  );
}

function BackChip({
  disabled,
  onClick,
  children,
}: {
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100 disabled:opacity-50"
    >
      ↩ {children}
    </button>
  );
}

export function OrderCardWorkflow({
  orderId,
  status,
  supplierDueAt,
  arrivedFromSupplierAt,
}: {
  orderId: string;
  status: string;
  cartAddError?: string | null;
  supplierDueAt: string | null;
  arrivedFromSupplierAt: string | null;
}) {
  const { schedule, busy } = useUndoAction();
  const [choice, setChoice] = useState<string>("");
  const [supplierName, setSupplierName] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [delayReason, setDelayReason] = useState("");

  const dueReached = needsFollowUpReview({
    status,
    ordersDecisionDueAt: null,
    ordersReviewedAt: null,
    supplierDueAt: supplierDueAt ? new Date(supplierDueAt) : null,
    arrivedFromSupplierAt: arrivedFromSupplierAt ? new Date(arrivedFromSupplierAt) : null,
  });

  const active = nodeIndex(status);
  const reviewNode = status === "pending_review";
  const supplyOrderNode = status === "awaiting_supply";
  // سررسید رسیده → همان مرحله تأمین، ولی باید بالا بیاید و پیگیری شود (گره جدا نیست)
  const needsCheckNode =
    (status === "awaiting_supplier" || status === "supplier_confirmed") && dueReached;
  const waitingSupplier =
    (status === "awaiting_supplier" || status === "supplier_confirmed") && !dueReached;
  const readyNode = status === "ready";
  const done =
    status === "completed" || status === "supply_rejected" || status === "supplier_rejected";

  const jumps = jumpTargetForStatus(status, dueReached);
  const backChoice = jumps.supply_order
    ? ("back_to_supply" as const)
    : jumps.review
      ? ("back_to_review" as const)
      : null;
  const backLabel =
    backChoice === "back_to_supply"
      ? "بازگشت به سفارش به تأمین"
      : backChoice === "back_to_review"
        ? "بازگشت به بررسی سفارش"
        : null;

  function voidImmediate(nextChoice: string, label: string) {
    setChoice("");
    schedule(label, { orderId, choice: nextChoice });
  }

  function onNodeJump(nodeId: WorkflowNodeId) {
    const choiceKey = jumps[nodeId];
    if (!choiceKey) return;
    const labels: Record<string, string> = {
      back_to_review: "بازگشت به بررسی سفارش",
      back_to_supply: "بازگشت به سفارش به تأمین",
    };
    voidImmediate(choiceKey, labels[choiceKey] || "بازگشت گره");
  }

  function submitForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!choice) return;
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, string> = { orderId, choice };
    fd.forEach((v, k) => {
      if (typeof v === "string") payload[k] = v;
    });
    if (choice === "cannot_fulfill" && !payload.reason?.trim()) return;
    if (choice === "ordered_from_supplier" && !payload.supplierDueAt) return;
    if (choice === "followup_delay") {
      if (!payload.supplierDueAt || !payload.delayReason) return;
      if (payload.delayReason === "other" && !payload.note?.trim()) return;
    }

    const labels: Record<string, string> = {
      cannot_fulfill: "قابل تأمین نیست",
      ordered_from_supplier: "ثبت سفارش نزد تأمین‌کننده",
      followup_delay: "ثبت تأخیر و تاریخ جدید",
    };
    schedule(labels[choice] || "اعمال تغییر", payload);
    setChoice("");
    setReason("");
    setNote("");
    setDelayReason("");
    setSupplierName("");
  }

  const hasActions = reviewNode || supplyOrderNode || needsCheckNode || readyNode;

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {reviewNode && (
            <>
              <OptionChip
                disabled={busy}
                onClick={() => voidImmediate("in_stock_complete", "موجود است و تکمیل شد")}
              >
                موجود و تکمیل
              </OptionChip>
              <OptionChip
                disabled={busy}
                onClick={() => voidImmediate("needs_order", "نیازمند سفارش")}
              >
                نیازمند سفارش
              </OptionChip>
            </>
          )}

          {supplyOrderNode && (
            <>
              <OptionChip
                active={choice === "cannot_fulfill"}
                onClick={() => setChoice(choice === "cannot_fulfill" ? "" : "cannot_fulfill")}
              >
                قابل تأمین نیست
              </OptionChip>
              <OptionChip
                active={choice === "ordered_from_supplier"}
                onClick={() =>
                  setChoice(choice === "ordered_from_supplier" ? "" : "ordered_from_supplier")
                }
              >
                ثبت نزد تأمین‌کننده
              </OptionChip>
            </>
          )}

          {needsCheckNode && (
            <>
              <OptionChip
                disabled={busy}
                onClick={() => voidImmediate("followup_complete", "تکمیل شد — ثبت در پرونده")}
              >
                تکمیل شد
              </OptionChip>
              <OptionChip
                active={choice === "followup_delay"}
                onClick={() => setChoice(choice === "followup_delay" ? "" : "followup_delay")}
              >
                تأخیر + تاریخ جدید
              </OptionChip>
            </>
          )}

          {readyNode && (
            <OptionChip
              disabled={busy}
              onClick={() => voidImmediate("retry_cart", "تکمیل پرونده")}
            >
              تکمیل پرونده
            </OptionChip>
          )}

          {waitingSupplier && (
            <span className="text-[10px] text-slate-400">منتظر سررسید</span>
          )}
          {done && (
            <span className="text-[10px] text-slate-400">
              {status === "completed" ? "ثبت در پرونده" : "مسیر بسته"}
            </span>
          )}
          {!hasActions && !waitingSupplier && !done && (
            <span className="text-[10px] text-slate-400">—</span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <WorkflowNodeBar
            activeIndex={active}
            dueReached={dueReached}
            status={status}
            dueHighlight={needsCheckNode}
            disabled={busy}
            onJump={onNodeJump}
          />
          {backChoice && backLabel && (
            <BackChip disabled={busy} onClick={() => voidImmediate(backChoice, backLabel)}>
              {backLabel.replace("بازگشت به ", "")}
            </BackChip>
          )}
        </div>
      </div>

      {supplyOrderNode && (choice === "cannot_fulfill" || choice === "ordered_from_supplier") && (
        <form className="space-y-1.5 rounded-md bg-white/70 p-1.5" onSubmit={submitForm}>
          {choice === "cannot_fulfill" && (
            <Textarea
              name="reason"
              rows={2}
              required
              placeholder="دلیل توضیحی (الزامی)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="!min-h-0"
            />
          )}
          {choice === "ordered_from_supplier" && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[9rem] flex-1">
                <label className="mb-0.5 block text-[10px] text-slate-500">نام تأمین‌کننده</label>
                <input
                  name="supplierName"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="اختیاری"
                  className="w-full rounded-md border border-black/10 px-2 py-1.5 text-xs"
                />
              </div>
              <div className="min-w-[11rem] flex-1">
                <JalaliDateField name="supplierDueAt" required label="تاریخ تحویل" />
              </div>
              <Button type="submit" disabled={busy} className="!rounded-md !px-2.5 !py-1.5 !text-[11px]">
                ثبت
              </Button>
            </div>
          )}
          {choice === "cannot_fulfill" && (
            <Button type="submit" disabled={busy} className="!rounded-md !px-2.5 !py-1 !text-[11px]">
              ثبت
            </Button>
          )}
        </form>
      )}

      {needsCheckNode && choice === "followup_delay" && (
        <form className="space-y-1.5 rounded-md bg-white/70 p-1.5" onSubmit={submitForm}>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[11rem] flex-1">
              <JalaliDateField name="supplierDueAt" required label="تاریخ تحویل جدید" />
            </div>
            <div className="min-w-[10rem] flex-1">
              <label className="mb-0.5 block text-[10px] text-slate-500">دلیل تأخیر</label>
              <select
                name="delayReason"
                required
                value={delayReason}
                onChange={(e) => setDelayReason(e.target.value)}
                className="w-full rounded-md border border-black/10 bg-white px-2 py-1.5 text-xs"
              >
                <option value="">انتخاب کنید...</option>
                {SUPPLIER_DELAY_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={busy} className="!rounded-md !px-2.5 !py-1.5 !text-[11px]">
              ثبت
            </Button>
          </div>
          {delayReason === "other" && (
            <Textarea
              name="note"
              rows={2}
              required
              placeholder="توضیح الزامی برای «سایر»"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="!min-h-0"
            />
          )}
          {delayReason && delayReason !== "other" && (
            <input type="hidden" name="note" value="" />
          )}
        </form>
      )}
    </div>
  );
}
