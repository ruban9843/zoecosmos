import { describe, it, expect } from "vitest";
import { deliveryFee, deliveryFees } from "../../src/lib/pricing";

const cfg = { feeCents: 60000, freeOverCents: 500000 };

describe("delivery fee", () => {
  it("charges the configured fee for same-day", () => {
    expect(deliveryFee("today", 30000, cfg)).toBe(60000);
  });

  it("charges the admin-configured fee for scheduled runs, with no hidden cap", () => {
    expect(deliveryFee("tomorrow", 30000, cfg)).toBe(60000);
    expect(deliveryFee("date", 30000, cfg)).toBe(60000);
    expect(deliveryFee("date", 30000, { feeCents: 95000, freeOverCents: null })).toBe(95000);
  });

  it("follows fee changes immediately", () => {
    expect(deliveryFee("date", 30000, { feeCents: 30000, freeOverCents: null })).toBe(30000);
  });

  it("is free for letterbox and pickup", () => {
    expect(deliveryFee("letterbox", 30000, cfg)).toBe(0);
    expect(deliveryFee("pickup", 30000, cfg)).toBe(0);
  });

  it("is free above the threshold and for an empty cart", () => {
    expect(deliveryFees(500000, cfg)).toEqual({ today: 0, tomorrow: 0, date: 0, letterbox: 0, pickup: 0 });
    expect(deliveryFee("today", 0, cfg)).toBe(0);
  });
});
