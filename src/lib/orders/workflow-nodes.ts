/** گره‌های اصلی جریان سفارش — «نیازمند بررسی» گره جدا نیست؛ فقط منطق سررسید است */

export const WORKFLOW_NODES = [
  { id: "review", label: "بررسی سفارش" },
  { id: "supply_order", label: "سفارش به تأمین" },
  { id: "done", label: "تکمیل" },
] as const;

export type WorkflowNodeId = (typeof WORKFLOW_NODES)[number]["id"];

export function currentWorkflowNode(status: string): WorkflowNodeId {
  switch (status) {
    case "pending_review":
      return "review";
    case "awaiting_supply":
    case "awaiting_supplier":
    case "supplier_confirmed":
      return "supply_order";
    case "accepted_in_stock":
    case "ready":
    case "completed":
    case "supply_rejected":
    case "supplier_rejected":
      return "done";
    default:
      return "review";
  }
}

export function nodeIndex(status: string): number {
  return WORKFLOW_NODES.findIndex((n) => n.id === currentWorkflowNode(status));
}
