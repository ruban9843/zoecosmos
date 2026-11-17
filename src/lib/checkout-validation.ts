import { z } from "zod";
import { validDeliveryDate } from "./delivery-date";

const required = z.string().trim().min(1, "Required");

export const checkoutDetailsSchema = z.object({
  email: required.email("Enter a valid email address"),
  name: required,
  recipientPhone: required.min(4, "Enter a valid phone number"),
  addressLine1: required,
  city: required,
  zip: required,
});

export const checkoutSchema = checkoutDetailsSchema.extend({
  recipientName: z.string().trim().optional(),
  addressLine2: z.string().trim().optional(),
  country: z.string().default("IL"),
  delivery: z.literal("date"),
  deliveryDate: z.string().refine((value) => validDeliveryDate(value), "Choose a date between tomorrow and 30 days from now"),
  giftMessage: z.string().max(160).optional(),
});