import { afterEach, describe, expect, it, vi } from "vitest";
import { checkoutDetailsSchema, checkoutSchema } from "../../src/lib/checkout-validation";

const details = {
  email: "customer@example.com", name: "Customer", recipientPhone: "1234567890",
  addressLine1: "1 Flower Street", city: "Chennai", zip: "600001",
};

afterEach(() => vi.useRealTimers());

describe("checkout validation", () => {
  it("requires each essential contact and address field", () => {
    for (const field of Object.keys(details)) {
      expect(checkoutDetailsSchema.safeParse({ ...details, [field]: "  " }).success).toBe(false);
    }
    expect(checkoutDetailsSchema.safeParse({ ...details, email: "invalid" }).success).toBe(false);
    expect(checkoutDetailsSchema.safeParse(details).success).toBe(true);
  });

  it("accepts only scheduled deliveries within the shop's date window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-17T19:00:00Z"));
    const order = { ...details, delivery: "date", deliveryDate: "2026-11-19" };
    expect(checkoutSchema.safeParse(order).success).toBe(true);
    expect(checkoutSchema.safeParse({ ...order, delivery: "today" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...order, deliveryDate: "2026-11-18" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...order, deliveryDate: "2026-11-31" }).success).toBe(false);
  });
});