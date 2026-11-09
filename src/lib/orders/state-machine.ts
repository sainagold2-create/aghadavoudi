import type { OrderStatus } from "../constants";

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_review: ["ready", "completed", "awaiting_supply"],
  accepted_in_stock: ["ready", "completed"],
  awaiting_supply: ["awaiting_supplier", "supply_rejected", "pending_review"],
  supply_rejected: ["awaiting_supply", "pending_review"],
  awaiting_supplier: ["ready", "completed", "awaiting_supplier", "awaiting_supply"],
  supplier_confirmed: ["ready", "completed", "awaiting_supplier", "awaiting_supply"],
  supplier_rejected: ["awaiting_supply"],
  ready: ["completed", "awaiting_supplier", "awaiting_supply"],
  completed: [],
};

export function canTransition(from: string, to: string): boolean {
  const allowed = TRANSITIONS[from as OrderStatus];
  if (!allowed) return false;
  return allowed.includes(to as OrderStatus);
}

export function assertTransition(from: string, to: string) {
  if (!canTransition(from, to)) {
    throw new Error(`انتقال وضعیت از «${from}» به «${to}» مجاز نیست.`);
  }
}
