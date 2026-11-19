import { z } from "zod";
import { prisma } from "../../../../../../../lib/prisma";
import { json, route, bad, readBody } from "../../../../../../../lib/api";
import { requireStaff } from "../../../../../../../lib/auth-helpers";

type Params = { params: Promise<{ id: string; mpId: string }> };

const patchSchema = z.object({
  priceOverride: z.number().int().min(0).nullable().optional(),
  active: z.boolean().optional(),
});

/** PATCH /api/admin/merchants/[id]/products/[mpId] — change the agreed price or pause the line. */
export const PATCH = route(async (req: Request, { params }: Params) => {
  await requireStaff();
  const { id, mpId } = await params;
  const data = await readBody(req, patchSchema);
  const updated = await prisma.merchantProduct.updateMany({ where: { id: mpId, merchantId: id }, data });
  if (updated.count === 0) return bad("Merchant product not found", 404);
  return json({ ok: true });
});

/** DELETE /api/admin/merchants/[id]/products/[mpId] — also removes the line from the merchant's subscriptions. */
export const DELETE = route(async (_req: Request, { params }: Params) => {
  await requireStaff();
  const { id, mpId } = await params;
  const deleted = await prisma.merchantProduct.deleteMany({ where: { id: mpId, merchantId: id } });
  if (deleted.count === 0) return bad("Merchant product not found", 404);
  return json({ ok: true });
});
