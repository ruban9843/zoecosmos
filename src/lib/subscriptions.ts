import type { SubscriptionCadence } from "@prisma/client";
import { addDays, addMonths } from "./delivery-date";

export function advanceDelivery(date: Date, cadence: SubscriptionCadence) {
  if (cadence === "WEEKLY") return addDays(date, 7);
  if (cadence === "FORTNIGHTLY") return addDays(date, 14);
  return addMonths(date, 1);
}

/** Per-unit price for a merchant line: the agreed override, else catalogue price. */
export function merchantUnitPrice(
  line: { priceOverride: number | null },
  product: { basePrice: number },
  variant: { priceDelta: number } | null | undefined,
) {
  return line.priceOverride ?? product.basePrice + (variant?.priceDelta ?? 0);
}

/** Value of one delivery cycle; lines without a pinned variant price at the product's first variant. */
export function cycleValue(
  items: {
    qty: number;
    merchantProduct: {
      priceOverride: number | null;
      product: { basePrice: number; variants?: { priceDelta: number }[] };
      variant: { priceDelta: number } | null;
    };
  }[],
) {
  return items.reduce((sum, { qty, merchantProduct: mp }) => {
    const variant = mp.variant ?? mp.product.variants?.[0] ?? null;
    return sum + qty * merchantUnitPrice(mp, mp.product, variant);
  }, 0);
}
