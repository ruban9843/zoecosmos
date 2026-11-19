import type { Prisma } from "@prisma/client";
import { prisma } from "../../../../lib/prisma";
import { json, route, readBody } from "../../../../lib/api";
import { requireStaff } from "../../../../lib/auth-helpers";
import { merchantSchema } from "../../../../lib/merchant-validation";

/** GET /api/admin/merchants — merchant stores with product / subscription counts. */
export const GET = route(async () => {
  await requireStaff();
  const items = await prisma.merchant.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true, subscriptions: true } } },
  });
  return json({ items });
});

/** POST /api/admin/merchants — add a merchant store. */
export const POST = route(async (req: Request) => {
  await requireStaff();
  const data = await readBody(req, merchantSchema);
  // zod's inferred type degrades under non-strict TS (all fields optional); the schema guarantees them.
  const merchant = await prisma.merchant.create({ data: data as Prisma.MerchantCreateInput });
  return json({ merchant }, { status: 201 });
});
