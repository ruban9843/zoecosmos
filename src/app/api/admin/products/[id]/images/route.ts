import { z } from "zod";
import { prisma } from "../../../../../../lib/prisma";
import { json, route, bad, readBody } from "../../../../../../lib/api";
import { requireStaff } from "../../../../../../lib/auth-helpers";
import { invalidateCatalog } from "../../../../../../lib/catalog";
import { isOwnedUpload } from "../../../../../../lib/upload";

type Params = { params: Promise<{ id: string }> };

const createSchema = z.object({
  url: z.string().url(),
  objectKey: z.string().min(1).max(512),
  alt: z.string().max(200).optional(),
});

/** POST /api/admin/products/[id]/images — attach an uploaded image to the product. */
export const POST = route(async (req: Request, { params }: Params) => {
  await requireStaff();
  const { id } = await params;
  const data = await readBody(req, createSchema);
  if (!isOwnedUpload(data.url, data.objectKey, `products/${id}`)) return bad("Image must be uploaded through the admin uploader", 422);

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return bad("Product not found", 404);

  const last = await prisma.productImage.findFirst({ where: { productId: id }, orderBy: { sortOrder: "desc" } });
  const count = await prisma.productImage.count({ where: { productId: id } });
  const image = await prisma.productImage.create({
    data: {
      productId: id,
      objectKey: data.objectKey,
      url: data.url,
      alt: data.alt,
      sortOrder: (last?.sortOrder ?? -1) + 1,
      isPrimary: count === 0,
    },
  });
  invalidateCatalog();
  return json({ image }, { status: 201 });
});

const reorderSchema = z.object({ order: z.array(z.string().min(1)).min(1).max(50) });

/** PUT /api/admin/products/[id]/images — set display order from an array of image ids. */
export const PUT = route(async (req: Request, { params }: Params) => {
  await requireStaff();
  const { id } = await params;
  const { order } = await readBody(req, reorderSchema);

  const existing = await prisma.productImage.findMany({ where: { productId: id }, select: { id: true } });
  const ids = new Set(existing.map((i) => i.id));
  if (order.length !== ids.size || new Set(order).size !== order.length || !order.every((imageId) => ids.has(imageId))) {
    return bad("Order must list every image of this product exactly once", 422);
  }

  await prisma.$transaction(
    order.map((imageId, sortOrder) => prisma.productImage.update({ where: { id: imageId }, data: { sortOrder } })),
  );
  invalidateCatalog();
  return json({ ok: true });
});
