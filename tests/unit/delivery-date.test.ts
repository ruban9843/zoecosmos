import { describe, expect, it } from "vitest";
import { deliveryDateBounds, validDeliveryDate } from "../../src/lib/delivery-date";

describe("delivery dates", () => {
  const now = new Date("2026-11-17T19:00:00Z");

  it("uses the shop's date in India for the delivery window", () => {
    expect(deliveryDateBounds(now)).toEqual({ min: "2026-11-19", max: "2026-12-18" });
    expect(validDeliveryDate("2026-11-19", now)).toBe(true);
    expect(validDeliveryDate("2026-12-18", now)).toBe(true);
    expect(validDeliveryDate("2026-11-18", now)).toBe(false);
    expect(validDeliveryDate("2026-12-19", now)).toBe(false);
  });

  it("rejects malformed or impossible dates", () => {
    expect(validDeliveryDate("", now)).toBe(false);
    expect(validDeliveryDate("2026-11-31", now)).toBe(false);
    expect(validDeliveryDate("2026-11-19T00:00:00Z", now)).toBe(false);
  });
});