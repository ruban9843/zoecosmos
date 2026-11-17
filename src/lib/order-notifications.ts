import type { Order, OrderItem, OrderStatus } from "@prisma/client";
import { formatMoney } from "./currency";

type NotificationOrder = Order & { items: OrderItem[]; user?: { email: string } | null };
export type OrderEmail = { to: string; subject: string; text: string };
export type EmailTransport = (email: OrderEmail) => Promise<void>;

class OpenMailError extends Error {}

export const openMailTransport: EmailTransport = async (email) => {
  const apiKey = process.env.OPENMAIL_API_KEY?.trim();
  const inboxId = process.env.OPENMAIL_INBOX_ID?.trim();
  if (!apiKey || !inboxId) throw new OpenMailError("OpenMail is not configured");
  const response = await fetch(`https://api.openmail.sh/v1/inboxes/${encodeURIComponent(inboxId)}/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ to: email.to, subject: email.subject, body: email.text }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new OpenMailError(`OpenMail send failed (${response.status})`);
  const result = await response.json() as { status?: string };
  if (result.status === "failed") throw new OpenMailError("OpenMail reported a failed send");
};

async function deliver(email: OrderEmail, transport: EmailTransport) {
  try {
    await transport(email);
  } catch (error) {
    console.error("Order email could not be sent", {
      orderCode: email.subject.match(/FS-\d+/)?.[0],
      reason: error instanceof OpenMailError ? error.message : "Transport error",
    });
  }
}

function details(order: NotificationOrder) {
  const items = order.items.map((item) => `${item.productName}${item.variantLabel ? ` (${item.variantLabel})` : ""} x ${item.qty}: ${formatMoney(item.total)}`);
  const address = [order.addressLine1, order.addressLine2, order.city, order.zip, order.country].filter(Boolean).join(", ");
  return [
    `Order: ${order.code}`,
    ...items,
    `Subtotal: ${formatMoney(order.subtotal)}`,
    `Delivery: ${formatMoney(order.deliveryFee)}`,
    `Total: ${formatMoney(order.total)}`,
    `Delivery date: ${order.deliveryDate?.toISOString().slice(0, 10) || "Not specified"}`,
    `Recipient: ${order.recipientName || "Not specified"}`,
    `Delivery address: ${address}`,
  ].join("\n");
}

export async function notifyNewOrder(order: NotificationOrder, transport: EmailTransport = openMailTransport) {
  if (order.contactEmail) {
    await deliver({
      to: order.contactEmail,
      subject: `Order ${order.code} received`,
      text: `Thank you for your order. We will contact you soon to confirm delivery and payment.\n\n${details(order)}`,
    }, transport);
  }

  const admins = [...new Set([process.env.OWNER_EMAIL, process.env.ADMIN_EMAIL]
    .map((email) => email?.trim().toLowerCase()).filter((email): email is string => !!email))];
  for (const admin of admins) {
    await deliver({
      to: admin,
      subject: `New order ${order.code}`,
      text: `${details(order)}\nCustomer: ${order.customerName || "Not specified"}\nEmail: ${order.contactEmail || "Not specified"}\nPhone: ${order.recipientPhone || "Not specified"}`,
    }, transport);
  }
}

export async function notifyOrderStatus(order: NotificationOrder, previousStatus: OrderStatus, transport: EmailTransport = openMailTransport) {
  if (order.status === previousStatus || (order.status !== "TYING" && order.status !== "OUT_FOR_DELIVERY")) return;
  const email = order.contactEmail || order.user?.email;
  if (!email) {
    console.warn("Order status email skipped: no customer email", { orderCode: order.code });
    return;
  }
  const message = order.status === "TYING" ? "We have started tying your flowers." : "Your order is out for delivery.";
  await deliver({ to: email, subject: `Order ${order.code} update`, text: `${message}\n\n${details(order)}` }, transport);
}