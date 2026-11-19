import { z } from "zod";
import { unstable_cache, revalidateTag } from "next/cache";
import { prisma } from "./prisma";
import type { DeliveryConfig } from "./pricing";

export const SETTINGS_TAG = "settings";
export const DEFAULT_FEE_CENTS = 60000;

export const deliverySettingsSchema = z.object({
  sameDayCutoff: z.string().max(5),
  lastSlot: z.string().max(5),
  windows: z.array(z.string().min(1).max(40)).max(12),
  feeCents: z.number().int().min(0).max(1_000_000).optional(),
  freeOverCents: z.number().int().min(0).max(10_000_000).nullable().optional(),
});

export function toDeliveryConfig(value: unknown): DeliveryConfig {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    feeCents: typeof v.feeCents === "number" ? v.feeCents : DEFAULT_FEE_CENTS,
    freeOverCents: typeof v.freeOverCents === "number" ? v.freeOverCents : null,
  };
}

export const getDeliveryConfig = unstable_cache(
  async () => {
    const row = await prisma.setting.findUnique({ where: { key: "shop.delivery" } });
    return toDeliveryConfig(row?.value);
  },
  ["settings:delivery"],
  { tags: [SETTINGS_TAG], revalidate: 300 },
);

export function invalidateSettings() {
  revalidateTag(SETTINGS_TAG);
}
