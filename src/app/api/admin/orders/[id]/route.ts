import { z } from "zod";
import { OrderStatus, PaymentStatus, OrderEventKind } from "@prisma/client";
import { prisma } from "../../../../../lib/prisma";
import { json, route, bad, readBody, HttpError } from "../../../../../lib/api";
import { requireStaff } from "../../../../../lib/auth-helpers";
import { statusEmail } from "../../../../../lib/order-notifications";
import { enqueue, flushAfterResponse } from "../../../../../lib/notifications";
import { canTransition, STATUS_EVENT, STATUS_LABEL } from "../../../../../lib/order-status";

type Params = { params: Promise<{ id: string }> };

const orderInclude = {
  items: { include: { product: { select: { slug: true } } } },
  events: {
    orderBy: { createdAt: "desc" as const },
    include: { actor: { select: { name: true, email: true } } },
  },
  user: { select: { id: true, name: true, email: true, phone: true } },
};

/** Accepts either the cuid or the public "FS-XXXXX" code. */
async function findOrder(idOrCode: string) {
  return prisma.order.findFirst({
    where: { OR: [{ id: idOrCode }, { code: idOrCode }] },
    include: orderInclude,
  });
}

/** GET /api/admin/orders/[id] — full order with items, events, customer. */
export const GET = route(async (_req: Request, { params }: Params) => {
  await requireStaff();
  const { id } = await params;
  const order = await findOrder(id);
  if (!order) return bad("Order not found", 404);
  return json(order);
});

const patchSchema = z
  .object({
    status: z.nativeEnum(OrderStatus).optional(),
    paymentStatus: z.nativeEnum(PaymentStatus).optional(),
    note: z.string().min(1).max(500).optional(),
  })
  .refine((d) => d.status || d.paymentStatus || d.note, {
    message: "Nothing to update",
  });

/** PATCH /api/admin/orders/[id] — change status / payment, append a note. */
export const PATCH = route(async (req: Request, { params }: Params) => {
  const staff = await requireStaff();
  const { id } = await params;
  const data = await readBody(req, patchSchema);

  const order = await findOrder(id);
  if (!order) return bad("Order not found", 404);

  const statusChange = data.status && data.status !== order.status ? data.status : null;
  if (statusChange && !canTransition(order.status, statusChange)) {
    return bad(`Can't move an order from ${STATUS_LABEL[order.status]} to ${STATUS_LABEL[statusChange]}`, 409);
  }

  await prisma.$transaction(async (tx) => {
    const events: { kind: OrderEventKind; message?: string; fromStatus?: OrderStatus; toStatus?: OrderStatus }[] = [];

    if (statusChange) {
      // Guard against a concurrent move: only apply if the status is still what we validated.
      const moved = await tx.order.updateMany({
        where: { id: order.id, status: order.status },
        data: { status: statusChange },
      });
      if (moved.count === 0) throw new HttpError("The order changed meanwhile — refresh and try again", 409);
      // Canceling returns tracked stock to the shelf.
      if (statusChange === "CANCELED") {
        for (const it of order.items) {
          if (!it.variantId) continue;
          await tx.productVariant.updateMany({
            where: { id: it.variantId },
            data: { stockQty: { increment: it.qty } },
          });
        }
      }
      events.push({ kind: STATUS_EVENT[statusChange], fromStatus: order.status, toStatus: statusChange });
      const email = statusEmail({ ...order, status: statusChange }, order.status);
      if (email) await enqueue(tx, order.id, [email]);
    }

    if (data.paymentStatus && data.paymentStatus !== order.paymentStatus) {
      if (data.paymentStatus === "PAID") events.push({ kind: "PAID" });
      else if (data.paymentStatus === "REFUNDED") events.push({ kind: "REFUNDED" });
      else events.push({ kind: "NOTE", message: "Payment set back to pending." });
    }

    if (data.note) events.push({ kind: "NOTE", message: data.note });

    await tx.order.update({
      where: { id: order.id },
      data: {
        ...(data.paymentStatus ? { paymentStatus: data.paymentStatus } : {}),
        events: {
          create: events.map((e) => ({ ...e, actorId: staff.id })),
        },
      },
    });
  });

  if (statusChange) flushAfterResponse(order.id);
  return json(await findOrder(order.id));
});
