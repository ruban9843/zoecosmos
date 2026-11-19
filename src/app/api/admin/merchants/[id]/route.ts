import { prisma } from "../../../../../lib/prisma";
import { json, route, bad, readBody } from "../../../../../lib/api";
import { requireStaff } from "../../../../../lib/auth-helpers";
import { merchantSchema } from "../../../../../lib/merchant-validation";

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/admin/merchants/[id] — edit details or activate / deactivate. */
export const PATCH = route(async (req: Request, { params }: Params) => {
  await requireStaff();
  const { id } = await params;
  const data = await readBody(req, merchantSchema.partial());
  const exists = await prisma.merchant.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return bad("Merchant not found", 404);
  const merchant = await prisma.merchant.update({ where: { id }, data });
  return json({ merchant });
});

/** DELETE /api/admin/merchants/[id] — removes the merchant and its subscriptions; past orders stay. */
export const DELETE = route(async (_req: Request, { params }: Params) => {
  await requireStaff();
  const { id } = await params;
  const deleted = await prisma.merchant.deleteMany({ where: { id } });
  if (deleted.count === 0) return bad("Merchant not found", 404);
  return json({ ok: true });
});
