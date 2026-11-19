import { describe, it, expect } from "vitest";
import { shopDay, shopDayKey, addMonths, deliveryDateBounds } from "../../src/lib/delivery-date";
import { advanceDelivery, cycleValue, merchantUnitPrice } from "../../src/lib/subscriptions";

describe("shop day (IST)", () => {
  it("rolls over at IST midnight, not UTC midnight", () => {
    // 19:00 UTC on 19 Nov is 00:30 IST on 20 Nov.
    const now = new Date("2026-11-19T19:00:00Z");
    expect(shopDayKey(0, now)).toBe("2026-11-20");
    expect(shopDayKey(-1, now)).toBe("2026-11-19");
    expect(shopDay(0, now).toISOString()).toBe("2026-11-20T00:00:00.000Z");
  });

  it("keeps checkout bounds as tomorrow to +30 days", () => {
    expect(deliveryDateBounds(new Date("2026-11-19T06:00:00Z"))).toEqual({ min: "2026-11-20", max: "2026-12-19" });
  });
});

describe("subscription schedule", () => {
  const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

  it("advances by cadence", () => {
    expect(advanceDelivery(d("2026-11-19"), "WEEKLY").toISOString().slice(0, 10)).toBe("2026-11-26");
    expect(advanceDelivery(d("2026-11-19"), "FORTNIGHTLY").toISOString().slice(0, 10)).toBe("2026-12-03");
    expect(advanceDelivery(d("2026-11-19"), "MONTHLY").toISOString().slice(0, 10)).toBe("2026-12-19");
  });

  it("clamps monthly deliveries to the end of shorter months", () => {
    expect(addMonths(d("2027-01-31"), 1).toISOString().slice(0, 10)).toBe("2027-02-28");
  });

  it("prices merchant lines with the agreed price, else the catalogue", () => {
    expect(merchantUnitPrice({ priceOverride: 5000 }, { basePrice: 9000 }, { priceDelta: 100 })).toBe(5000);
    expect(merchantUnitPrice({ priceOverride: null }, { basePrice: 9000 }, { priceDelta: 100 })).toBe(9100);
    expect(cycleValue([
      { qty: 2, merchantProduct: { priceOverride: 5000, product: { basePrice: 9000 }, variant: null } },
      { qty: 1, merchantProduct: { priceOverride: null, product: { basePrice: 9000, variants: [{ priceDelta: -1000 }] }, variant: null } },
    ])).toBe(18000);
  });
});
