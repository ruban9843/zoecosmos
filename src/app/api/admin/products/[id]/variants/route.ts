import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../../../../../lib/prisma";
import { json, route, bad, readBody } from "../../../../../../lib/api";
import { requireStaff } from "../../../../../../lib/auth-helpers";
import { invalidateCatalog } from "../../../../../../lib/catalog";

type Params = { params: Promise<{ id: string }> };

const createSchema = z.object({
  label:      z.string().trim().min(1).max(60),
  sku:        z.string().trim().min(1).max(60),
  stems:      z.number().int().min(0).nullable().optional(),
  priceDelta: z.number().int().default(0),
  stockQty:   z.number().int().min(0).default(0),
});

/** POST /api/admin/products/[id]/variants — add a variant (size / option) to a product. */
export const POST = route(async (req: Request, { params }: Params) => {
  await requireStaff();
  const { id } = await params;
  const data = await readBody(req, createSchema);

  const product = await prisma.product.findUnique({ where: { id }, select: { id: true, basePrice: true } });
  if (!product) return bad("Product not found", 404);
  if (product.basePrice + data.priceDelta < 0) return bad("Price difference makes the variant cost less than zero", 422);

  const last = await prisma.productVariant.findFirst({ where: { productId: id }, orderBy: { sortOrder: "desc" } });
  const variant = await prisma.productVariant.create({
    // zod's inferred type degrades under non-strict TS (all fields optional).
    data: { ...data, productId: id, sortOrder: (last?.sortOrder ?? -1) + 1 } as Prisma.ProductVariantUncheckedCreateInput,
  });
  invalidateCatalog();
  return json({ variant }, { status: 201 });
});
