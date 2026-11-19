import { prisma } from "../../../lib/prisma";
import { auth } from "../../../lib/auth";
import { json, route, bad, readBody, HttpError } from "../../../lib/api";
import { getOrCreateCart, priceCart } from "../../../lib/cart";
import { enforceRateLimit } from "../../../lib/rate-limit";
import { cookies } from "next/headers";
import { rememberOrder } from "../../../lib/orders";
import { invalidateCatalog } from "../../../lib/catalog";
import { lineProblem } from "../../../lib/pricing";
import { checkoutSchema } from "../../../lib/checkout-validation";
import { newOrderEmails } from "../../../lib/order-notifications";
import { enqueue, flushAfterResponse } from "../../../lib/notifications";
import { payments } from "../../../lib/payments";
import { uniqueOrderCode } from "../../../lib/order-code";

/**
 * POST /api/checkout
 *
 * Converts the current cart into an Order, clears the cart cookie, and returns
 * the order code so the storefront can redirect to /success/[code].
 *
 * Payment is mocked: the order goes in as PENDING and the admin marks it PAID.
 */
export const POST = route(async (req: Request) => {
  // Throttle checkout to curb order flooding / card-testing-style abuse.
  await enforceRateLimit(req, "checkout", { limit: 10, windowSec: 60 });

  const data = await readBody(req, checkoutSchema);
  const session = await auth();
  const cart = await getOrCreateCart(session);
  const priced = await priceCart(cart.id, data.delivery);
  if (priced.lines.length === 0) return bad("Cart is empty", 400);

  // Products can be archived or sell out after they were added to the cart.
  const items = await prisma.cartItem.findMany({
    where: { cartId: cart.id },
    include: {
      product: { include: { images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1 } } },
      variant: true,
    },
  });
  for (const it of items) {
    const problem = lineProblem(it.product, it.variant, it.qty);
    if (problem) return bad(`"${it.product.name}" is ${problem}`, 409);
  }
  const imageByProduct = new Map(items.map((it) => [it.productId, it.product.images[0]?.url ?? null]));

  let userId = session?.user?.id || null;

  // Guest checkout: if no session but they gave an email, create a (or reuse) customer record.
  if (!userId && data.email) {
    const existing = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
    const u = existing ?? (await prisma.user.create({
      data: { email: data.email.toLowerCase(), name: data.name || null },
    }));
    userId = u.id;
  }

  const code = await uniqueOrderCode();

  // Everything below is atomic: stock is decremented, the order is created, and
  // the cart is emptied as one unit. If stock runs out mid-flight the whole
  // transaction rolls back and nothing is persisted.
  const order = await prisma.$transaction(async (tx) => {
    // ── Decrement stock with an atomic guard ──────────────────────────────
    // Stock lives on ProductVariant, so every line must carry a variant. The
    // `stockQty: { gte: qty }` filter makes the check-and-decrement a single
    // race-free statement: if another concurrent checkout already took the
    // last units, updateMany affects 0 rows and we abort.
    for (const l of priced.lines) {
      const res = !l.variantId ? { count: 0 } : await tx.productVariant.updateMany({
        where: { id: l.variantId, productId: l.productId, stockQty: { gte: l.qty } },
        data: { stockQty: { decrement: l.qty } },
      });
      if (res.count === 0) {
        throw new HttpError(`"${l.productName}" is out of stock`, 409);
      }
    }

    // Keep the per-product sales tally current so "bestseller" sorting works.
    for (const l of priced.lines) {
      if (!l.productId) continue;
      await tx.product.update({
        where: { id: l.productId },
        data: { totalSold: { increment: l.qty } },
      });
    }

    const created = await tx.order.create({
      data: {
        code,
        userId,
        subtotal: priced.subtotal,
        deliveryFee: priced.deliveryFee,
        total: priced.total,
        currency: priced.currency,
        contactEmail: data.email.toLowerCase(),
        customerName: data.name,
        recipientName: data.recipientName || data.name,
        recipientPhone: data.recipientPhone,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2,
        city: data.city,
        zip: data.zip,
        country: data.country,
        deliveryWindow: "Scheduled delivery",
        deliveryDate: new Date(`${data.deliveryDate}T00:00:00.000Z`),
        giftMessage: data.giftMessage,
        items: {
          create: priced.lines.map((l) => ({
            productId: l.productId!,
            variantId: l.variantId || null,
            productName: l.productName,
            variantLabel: l.variantLabel,
            imageUrl: imageByProduct.get(l.productId) ?? null,
            unitPrice: l.unitPrice,
            qty: l.qty,
            total: l.total,
          })),
        },
        events: {
          create: [{ kind: "PLACED", message: "Order placed via storefront." }],
        },
      },
      include: { items: true },
    });

    // Clear the cart items inside the transaction so a successful order always
    // leaves an empty cart (and a failed one leaves the cart intact for retry).
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    await enqueue(tx, created.id, newOrderEmails(created));

    return created;
  });

  // Stock and bestseller tallies changed — refresh the cached catalogue.
  invalidateCatalog();

  // Cookie mutation must happen outside the DB transaction.
  await rememberOrder(order.code);
  if (!session) {
    const store = await cookies();
    store.delete("fs_cart");
    // Anon cart record stays (debugging / re-attribution); not user-visible.
  }

  flushAfterResponse(order.id);

  const payment = await payments.createPayment(order);
  if (payment.ref) {
    await prisma.order.update({ where: { id: order.id }, data: { paymentRef: payment.ref } });
  }
  return json({ code: order.code, id: order.id, total: order.total, redirectUrl: payment.redirectUrl });
});
