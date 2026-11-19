import { prisma } from "../../../../lib/prisma";
import { json, route, bad, readBody } from "../../../../lib/api";
import { requireStaff } from "../../../../lib/auth-helpers";
import { subscriptionCreateSchema, type SubscriptionItemInput } from "../../../../lib/merchant-validation";
import { resolveSubscriptionItems } from "../../../../lib/subscription-items";
import { shopDayKey } from "../../../../lib/delivery-date";

/** POST /api/admin/subscriptions — create a recurring delivery for a merchant store. */
export const POST = route(async (req: Request) => {
  await requireStaff();
  const data = await readBody(req, subscriptionCreateSchema);
  const items = data.items as SubscriptionItemInput[];

  const merchant = await prisma.merchant.findUnique({ where: { id: data.merchantId } });
  if (!merchant) return bad("Merchant not found", 404);
  if (!merchant.active) return bad("Activate the merchant before adding a subscription", 409);
  if (data.nextDelivery < shopDayKey(0)) return bad("First delivery can't be in the past", 422);

  const { value, currency } = await resolveSubscriptionItems(merchant.id, items);
  const subscription = await prisma.subscription.create({
    data: {
      merchantId: merchant.id,
      cadence: data.cadence,
      nextDelivery: new Date(`${data.nextDelivery}T00:00:00.000Z`),
      totalCycles: data.totalCycles ?? null,
      value,
      currency,
      items: { create: items },
    },
  });
  return json({ subscription }, { status: 201 });
});
