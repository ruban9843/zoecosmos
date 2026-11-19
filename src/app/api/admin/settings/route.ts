import { z } from "zod";
import { prisma } from "../../../../lib/prisma";
import { json, route, readBody } from "../../../../lib/api";
import { requireOwner } from "../../../../lib/auth-helpers";
import { deliverySettingsSchema, invalidateSettings } from "../../../../lib/delivery-config";

const daySchema = z.object({
  open: z.string().max(5).optional(),
  close: z.string().max(5).optional(),
  on: z.boolean(),
});

const hoursSchema = z.object({
  mon: daySchema, tue: daySchema, wed: daySchema, thu: daySchema,
  fri: daySchema, sat: daySchema, sun: daySchema,
});

const deliverySchema = deliverySettingsSchema;

const patchSchema = z
  .object({
    hours: hoursSchema.optional(),
    delivery: deliverySchema.optional(),
  })
  .refine((d) => d.hours || d.delivery, { message: "Nothing to update" });

/** GET /api/admin/settings — all shop settings as a key→value map. */
export const GET = route(async () => {
  await requireOwner();
  const rows = await prisma.setting.findMany();
  return json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
});

/** PATCH /api/admin/settings — owner-only. Upserts shop hours / delivery windows. */
export const PATCH = route(async (req: Request) => {
  await requireOwner();
  const data = await readBody(req, patchSchema);

  const writes = [];
  if (data.hours) {
    writes.push(
      prisma.setting.upsert({
        where: { key: "shop.hours" },
        update: { value: data.hours },
        create: { key: "shop.hours", value: data.hours },
      })
    );
  }
  if (data.delivery) {
    writes.push(
      prisma.setting.upsert({
        where: { key: "shop.delivery" },
        update: { value: data.delivery },
        create: { key: "shop.delivery", value: data.delivery },
      })
    );
  }
  await prisma.$transaction(writes);
  invalidateSettings();

  const rows = await prisma.setting.findMany();
  return json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
});
