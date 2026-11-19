import { prisma } from "../../../../../lib/prisma";
import { json, route, bad, readBody } from "../../../../../lib/api";
import { requireStaff } from "../../../../../lib/auth-helpers";
import { subscriptionPatchSchema, type SubscriptionItemInput } from "../../../../../lib/merchant-validation";
import { resolveSubscriptionItems } from "../../../../../lib/subscription-items";
import { shopDayKey } from "../../../../../lib/delivery-date";

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/admin/subscriptions/[id] — pause / resume / cancel, or change plan, date and items. */
export const PATCH = route(async (req: Request, { params }: Params) => {
  await requireStaff();
  const { id } = await params;
  const data = await readBody(req, subscriptionPatchSchema);

  const sub = await prisma.subscription.findUnique({ where: { id } });
  if (!sub) return bad("Subscription not found", 404);
  if (sub.status === "CANCELED") return bad("Subscription is already canceled", 409);
  if (data.status === "ACTIVE" && !sub.merchantId) {
    return bad("Subscriptions are for merchant stores only — create a new one under a merchant", 409);
  }
  if (data.nextDelivery && data.nextDelivery < shopDayKey(0)) return bad("Next delivery can't be in the past", 422);

  const items = data.items as SubscriptionItemInput[] | undefined;
  const priced = items && sub.merchantId ? await resolveSubscriptionItems(sub.merchantId, items) : null;
  if (items && !sub.merchantId) return bad("This legacy subscription has no merchant", 409);

  const updated = await prisma.$transaction(async (tx) => {
    if (items) {
      await tx.subscriptionItem.deleteMany({ where: { subscriptionId: id } });
      await tx.subscriptionItem.createMany({ data: items.map((i) => ({ ...i, subscriptionId: id })) });
    }
    return tx.subscription.update({
      where: { id },
      data: {
        ...(data.status ? { status: data.status } : {}),
        ...(data.cadence ? { cadence: data.cadence } : {}),
        ...(data.nextDelivery ? { nextDelivery: new Date(`${data.nextDelivery}T00:00:00.000Z`) } : {}),
        ...(data.totalCycles !== undefined ? { totalCycles: data.totalCycles } : {}),
        ...(priced ? { value: priced.value, currency: priced.currency } : {}),
      },
    });
  });
  return json(updated);
});
