import { prisma } from "../../../../lib/prisma";
import { json, route, bad } from "../../../../lib/api";
import { payments } from "../../../../lib/payments";

/** POST /api/payments/webhook — gateway callback; idempotent per paymentRef + status. */
export const POST = route(async (req: Request) => {
  const event = await payments.parseWebhook(req);
  if (!event) return bad("No payment gateway is configured or the signature is invalid", 400);

  const order = await prisma.order.findUnique({ where: { paymentRef: event.ref } });
  if (!order) return bad("Unknown payment reference", 404);

  const next = event.status === "PAID" ? "PAID" : event.status === "REFUNDED" ? "REFUNDED" : null;
  if (!next) {
    await prisma.orderEvent.create({ data: { orderId: order.id, kind: "NOTE", message: `Payment ${event.ref} failed at ${payments.name}.` } });
    return json({ ok: true });
  }

  const updated = await prisma.order.updateMany({
    where: { id: order.id, paymentStatus: { not: next } },
    data: { paymentStatus: next },
  });
  if (updated.count > 0) {
    await prisma.orderEvent.create({ data: { orderId: order.id, kind: next, message: `Confirmed by ${payments.name}.` } });
  }
  return json({ ok: true });
});
