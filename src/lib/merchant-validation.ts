import { z } from "zod";

const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().optional().transform((v) => (v ? v : null));

export const merchantSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{1,60}$/, "Use lowercase letters, numbers and dashes"),
  contactName: optionalText(120),
  email: z.string().trim().toLowerCase().email(),
  phone: optionalText(40),
  addressLine1: z.string().trim().min(1).max(200),
  addressLine2: optionalText(200),
  city: z.string().trim().min(1).max(80),
  zip: optionalText(20),
  active: z.boolean().optional(),
});

export const merchantProductSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1).nullable().optional(),
  priceOverride: z.number().int().min(0).nullable().optional(),
});

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export type SubscriptionItemInput = { merchantProductId: string; qty: number };

export const subscriptionItemsSchema = z
  .array(z.object({ merchantProductId: z.string().min(1), qty: z.number().int().min(1).max(500) }))
  .min(1, "Add at least one product")
  .max(30);

export const subscriptionCreateSchema = z.object({
  merchantId: z.string().min(1),
  cadence: z.enum(["WEEKLY", "FORTNIGHTLY", "MONTHLY"]),
  nextDelivery: dateKey,
  totalCycles: z.number().int().min(1).max(520).nullable().optional(),
  items: subscriptionItemsSchema,
});

export const subscriptionPatchSchema = z
  .object({
    status: z.enum(["ACTIVE", "PAUSED", "CANCELED"]).optional(),
    cadence: z.enum(["WEEKLY", "FORTNIGHTLY", "MONTHLY"]).optional(),
    nextDelivery: dateKey.optional(),
    totalCycles: z.number().int().min(1).max(520).nullable().optional(),
    items: subscriptionItemsSchema.optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: "Nothing to update" });
