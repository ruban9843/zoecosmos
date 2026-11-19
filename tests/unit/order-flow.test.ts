import { describe, it, expect } from "vitest";
import type { OrderStatus } from "@prisma/client";
import { canTransition, ORDER_TRANSITIONS } from "../../src/lib/order-status";

describe("order status flow", () => {
  it("advances through every step", () => {
    expect(canTransition("NEW", "TYING")).toBe(true);
    expect(canTransition("TYING", "READY")).toBe(true);
    expect(canTransition("READY", "OUT_FOR_DELIVERY")).toBe(true);
    expect(canTransition("OUT_FOR_DELIVERY", "DELIVERED")).toBe(true);
  });

  it("allows one step back to undo a mis-drag", () => {
    expect(canTransition("TYING", "NEW")).toBe(true);
    expect(canTransition("READY", "TYING")).toBe(true);
    expect(canTransition("OUT_FOR_DELIVERY", "READY")).toBe(true);
  });

  it("rejects skipping steps and leaving terminal states", () => {
    expect(canTransition("NEW", "OUT_FOR_DELIVERY")).toBe(false);
    expect(canTransition("NEW", "DELIVERED")).toBe(false);
    expect(canTransition("DELIVERED", "NEW")).toBe(false);
    expect(canTransition("CANCELED", "TYING")).toBe(false);
  });

  it("can cancel until the van leaves", () => {
    for (const s of ["NEW", "TYING", "READY"] as OrderStatus[]) expect(canTransition(s, "CANCELED")).toBe(true);
    expect(canTransition("OUT_FOR_DELIVERY", "CANCELED")).toBe(false);
  });

  it("never lists a self-transition", () => {
    for (const [from, tos] of Object.entries(ORDER_TRANSITIONS)) expect(tos).not.toContain(from);
  });
});
