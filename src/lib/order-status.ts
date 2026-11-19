import type { OrderEventKind, OrderStatus } from "@prisma/client";

/** Allowed admin moves. Backward steps exist so a mis-drag can be undone. */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ["TYING", "CANCELED"],
  TYING: ["READY", "NEW", "CANCELED"],
  READY: ["OUT_FOR_DELIVERY", "TYING", "CANCELED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "READY"],
  DELIVERED: [],
  CANCELED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus) {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

export const STATUS_EVENT: Record<OrderStatus, OrderEventKind> = {
  NEW: "ACCEPTED",
  TYING: "TYING",
  READY: "READY",
  OUT_FOR_DELIVERY: "OUT",
  DELIVERED: "DELIVERED",
  CANCELED: "CANCELED",
};

export const STATUS_LABEL: Record<OrderStatus, string> = {
  NEW: "New",
  TYING: "Tying",
  READY: "Ready · awaiting van",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELED: "Canceled",
};
