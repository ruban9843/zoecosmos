/**
 * Daily job (06:00 IST via Vercel Cron → /api/cron/daily). Idempotent: safe
 * to re-run on the same day.
 *  1. Turn due merchant subscriptions into orders for today.
 *  2. Queue the admin digest of today's scheduled orders.
 *  3. Send / retry queued emails.
 */
import { prisma } from "../prisma";
import { addDays, shopDay } from "../delivery-date";
import { dailyDigestEmails } from "../order-notifications";
import { enqueue, flushNotifications } from "../notifications";
import { uniqueOrderCode } from "../order-code";
import { advanceDelivery, merchantUnitPrice } from "../subscriptions";
import { invalidateCatalog } from "../catalog";

export async function generateSubscriptionOrders(today: Date) {
  const tomorrow = addDays(today, 1);
  const due = await prisma.subscription.findMany({
    where: { status: "ACTIVE", merchantId: { not: null }, nextDelivery: { lt: tomorrow } },
    include: {
      merchant: true,
      items: {
        include: {
          merchantProduct: {
            include: {
              product: { include: { images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1 }, variants: { orderBy: { sortOrder: "asc" }, take: 1 } } },
              variant: true,
            },
          },
        },
      },
    },
  });

  let created = 0;
  for (const sub of due) {
    const merchant = sub.merchant;
    const lines = sub.items.filter((it) => it.merchantProduct.active && it.merchantProduct.product.status === "ACTIVE");
    if (!merchant?.active || lines.length === 0) continue;

    // One order per subscription per day, even if the job runs twice.
    const existing = await prisma.order.findFirst({
      where: { subscriptionId: sub.id, deliveryDate: { gte: today, lt: tomorrow } },
      select: { id: true },
    });
    const code = existing ? null : await uniqueOrderCode();

    await prisma.$transaction(async (tx) => {
      if (code) {
        const shortages: string[] = [];
        const items = [];
        for (const it of lines) {
          const mp = it.merchantProduct;
          const variant = mp.variant ?? mp.product.variants[0] ?? null;
          const unit = merchantUnitPrice(mp, mp.product, variant);
          if (variant) {
            const res = await tx.productVariant.updateMany({
              where: { id: variant.id, stockQty: { gte: it.qty } },
              data: { stockQty: { decrement: it.qty } },
            });
            if (res.count === 0) shortages.push(`${mp.product.name}${variant.label ? ` (${variant.label})` : ""}`);
          }
          items.push({
            productId: mp.productId,
            variantId: variant?.id ?? null,
            productName: mp.product.name,
            variantLabel: variant?.label ?? null,
            imageUrl: mp.product.images[0]?.url ?? null,
            unitPrice: unit,
            qty: it.qty,
            total: unit * it.qty,
          });
        }
        const subtotal = items.reduce((s, i) => s + i.total, 0);
        await tx.order.create({
          data: {
            code,
            merchantId: merchant.id,
            subscriptionId: sub.id,
            subtotal,
            deliveryFee: 0,
            total: subtotal,
            currency: sub.currency,
            contactEmail: merchant.email.toLowerCase(),
            customerName: merchant.contactName || merchant.name,
            recipientName: merchant.name,
            recipientPhone: merchant.phone,
            addressLine1: merchant.addressLine1,
            addressLine2: merchant.addressLine2,
            city: merchant.city,
            zip: merchant.zip,
            deliveryWindow: "Subscription",
            deliveryDate: today,
            items: { create: items },
            events: {
              create: [
                { kind: "PLACED", message: `Generated from ${sub.cadence.toLowerCase()} subscription.` },
                ...(shortages.length ? [{ kind: "NOTE" as const, message: `Not enough stock for: ${shortages.join(", ")}. Stock was not reserved for these lines.` }] : []),
              ],
            },
          },
        });
        created++;
      }

      const deliveredCount = sub.deliveredCount + (code ? 1 : 0);
      const finished = sub.totalCycles != null && deliveredCount >= sub.totalCycles;
      let next = advanceDelivery(sub.nextDelivery && sub.nextDelivery >= today ? sub.nextDelivery : today, sub.cadence);
      while (next < tomorrow) next = advanceDelivery(next, sub.cadence);
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          deliveredCount,
          nextDelivery: finished ? null : next,
          ...(finished ? { status: "CANCELED" as const } : {}),
        },
      });
    });
  }
  if (created) invalidateCatalog();
  return created;
}

export async function queueDailyDigest(today: Date) {
  const orders = await prisma.order.findMany({
    where: { deliveryDate: { gte: today, lt: addDays(today, 1) }, status: { notIn: ["CANCELED", "DELIVERED"] } },
    orderBy: { createdAt: "asc" },
    include: { items: true },
  });
  const emails = dailyDigestEmails(orders, today.toISOString().slice(0, 10));
  await enqueue(prisma, null, emails);
  return orders.length;
}

export async function runDailyJob(now = new Date()) {
  const today = shopDay(0, now);
  const subscriptionOrders = await generateSubscriptionOrders(today);
  const scheduledOrders = await queueDailyDigest(today);
  const emails = await flushNotifications({ limit: 200 });
  return { day: today.toISOString().slice(0, 10), subscriptionOrders, scheduledOrders, emails };
}
