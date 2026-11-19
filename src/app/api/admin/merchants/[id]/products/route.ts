import { prisma } from "../../../../../../lib/prisma";
import { json, route, bad, readBody } from "../../../../../../lib/api";
import { requireStaff } from "../../../../../../lib/auth-helpers";
import { merchantProductSchema } from "../../../../../../lib/merchant-validation";

type Params = { params: Promise<{ id: string }> };

/** POST /api/admin/merchants/[id]/products — allow a product (optionally one variant) for this merchant. */
export const POST = route(async (req: Request, { params }: Params) => {
  await requireStaff();
  const { id } = await params;
  const data = await readBody(req, merchantProductSchema);

  const merchant = await prisma.merchant.findUnique({ where: { id }, select: { id: true } });
  if (!merchant) return bad("Merchant not found", 404);
  const product = await prisma.product.findUnique({ where: { id: data.productId }, select: { id: true } });
  if (!product) return bad("Product not found", 404);
  if (data.variantId) {
    const variant = await prisma.productVariant.findFirst({ where: { id: data.variantId, productId: data.productId } });
    if (!variant) return bad("Variant does not belong to this product", 422);
  }

  const duplicate = await prisma.merchantProduct.findFirst({
    where: { merchantId: id, productId: data.productId, variantId: data.variantId ?? null },
  });
  if (duplicate) return bad("This product is already assigned to the merchant", 409);

  const merchantProduct = await prisma.merchantProduct.create({
    data: { merchantId: id, productId: data.productId, variantId: data.variantId ?? null, priceOverride: data.priceOverride ?? null },
  });
  return json({ merchantProduct }, { status: 201 });
});
