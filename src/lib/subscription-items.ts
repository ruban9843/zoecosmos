import { prisma } from "./prisma";
import { HttpError } from "./api";
import { cycleValue } from "./subscriptions";

/** Check every line is one of the merchant's allowed products and price one cycle. */
export async function resolveSubscriptionItems(merchantId: string, items: { merchantProductId: string; qty: number }[]) {
  const ids = [...new Set(items.map((i) => i.merchantProductId))];
  if (ids.length !== items.length) throw new HttpError("Each product can appear only once", 422);
  const allowed = await prisma.merchantProduct.findMany({
    where: { id: { in: ids }, merchantId },
    include: { product: { include: { variants: { orderBy: { sortOrder: "asc" }, take: 1 } } }, variant: true },
  });
  if (allowed.length !== ids.length) throw new HttpError("Subscriptions can only include this merchant's products", 422);
  const byId = new Map(allowed.map((mp) => [mp.id, mp]));
  const value = cycleValue(items.map((i) => ({ qty: i.qty, merchantProduct: byId.get(i.merchantProductId)! })));
  return { value, currency: allowed[0]?.product.currency ?? "INR" };
}
