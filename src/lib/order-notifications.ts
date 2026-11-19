import type { NotificationKind, Order, OrderItem, OrderStatus } from "@prisma/client";
import { formatMoney } from "./currency";

type NotificationOrder = Order & { items: OrderItem[]; user?: { email: string } | null };
export type OrderEmail = { to: string; subject: string; text: string; html?: string; idempotencyKey?: string };
export type QueuedEmail = OrderEmail & { kind: NotificationKind; dedupeKey: string };
export type EmailTransport = (email: OrderEmail) => Promise<void>;

export class OpenMailError extends Error {}

export const openMailTransport: EmailTransport = async (email) => {
  const apiKey = process.env.OPENMAIL_API_KEY?.trim();
  const inboxId = process.env.OPENMAIL_INBOX_ID?.trim();
  if (!apiKey || !inboxId) throw new OpenMailError("OpenMail is not configured");
  const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
  if (email.idempotencyKey) headers["Idempotency-Key"] = email.idempotencyKey;
  const response = await fetch(`https://api.openmail.sh/v1/inboxes/${encodeURIComponent(inboxId)}/send`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      to: email.to,
      subject: email.subject,
      body: email.text,
      ...(email.html ? { bodyHtml: email.html } : {}),
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new OpenMailError(`OpenMail send failed (${response.status})`);
  const result = await response.json() as { status?: string };
  if (result.status === "failed") throw new OpenMailError("OpenMail reported a failed send");
};

export function adminRecipients() {
  return [...new Set([process.env.OWNER_EMAIL, process.env.ADMIN_EMAIL]
    .map((email) => email?.trim().toLowerCase()).filter((email): email is string => !!email))];
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const isHttpUrl = (url: string | null | undefined): url is string => !!url && /^https:\/\//i.test(url);

function address(order: NotificationOrder) {
  return [order.addressLine1, order.addressLine2, order.city, order.zip, order.country].filter(Boolean).join(", ");
}

function details(order: NotificationOrder) {
  const items = order.items.map((item) => `${item.productName}${item.variantLabel ? ` (${item.variantLabel})` : ""} x ${item.qty}: ${formatMoney(item.total)}`);
  return [
    `Order: ${order.code}`,
    ...items,
    `Subtotal: ${formatMoney(order.subtotal)}`,
    `Delivery: ${formatMoney(order.deliveryFee)}`,
    `Total: ${formatMoney(order.total)}`,
    `Delivery date: ${order.deliveryDate?.toISOString().slice(0, 10) || "Not specified"}`,
    `Recipient: ${order.recipientName || "Not specified"}`,
    `Delivery address: ${address(order)}`,
  ].join("\n");
}

function detailsHtml(intro: string, order: NotificationOrder) {
  const rows = order.items.map((item) => `
    <tr>
      <td style="padding:8px 12px 8px 0;width:72px">${isHttpUrl(item.imageUrl)
        ? `<img src="${esc(item.imageUrl)}" alt="" width="64" height="80" style="display:block;object-fit:cover;border-radius:6px">`
        : ""}</td>
      <td style="padding:8px 0">${esc(item.productName)}${item.variantLabel ? ` <span style="color:#8a7a6c">(${esc(item.variantLabel)})</span>` : ""} × ${item.qty}</td>
      <td style="padding:8px 0;text-align:right">${esc(formatMoney(item.total))}</td>
    </tr>`).join("");
  return `<div style="font-family:system-ui,sans-serif;color:#2a2018;max-width:560px">
  <p style="font-size:15px">${esc(intro)}</p>
  <p style="font-family:monospace;color:#8a7a6c">Order ${esc(order.code)}</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>
  <p style="font-size:14px">Delivery: ${esc(formatMoney(order.deliveryFee))}<br><b>Total: ${esc(formatMoney(order.total))}</b></p>
  <p style="font-size:13px;color:#5a4a3d">Delivery date: ${esc(order.deliveryDate?.toISOString().slice(0, 10) || "Not specified")}<br>
  Recipient: ${esc(order.recipientName || "Not specified")}<br>Address: ${esc(address(order))}</p>
</div>`;
}

export function customerEmail(order: NotificationOrder) {
  return (order.contactEmail || order.user?.email || "").trim().toLowerCase() || null;
}

export function newOrderEmails(order: NotificationOrder): QueuedEmail[] {
  const emails: QueuedEmail[] = [];
  const customer = customerEmail(order);
  if (customer) {
    const intro = "Thank you for your order. A member of our team will contact you shortly to confirm delivery and payment.";
    emails.push({
      kind: "ORDER_PLACED_CUSTOMER",
      dedupeKey: `placed:${order.code}:customer`,
      to: customer,
      subject: `Order ${order.code} received`,
      text: `${intro}\n\n${details(order)}`,
      html: detailsHtml(intro, order),
    });
  }
  for (const admin of adminRecipients()) {
    emails.push({
      kind: "ORDER_PLACED_ADMIN",
      dedupeKey: `placed:${order.code}:admin:${admin}`,
      to: admin,
      subject: `New order ${order.code}`,
      text: `${details(order)}\nCustomer: ${order.customerName || "Not specified"}\nEmail: ${order.contactEmail || "Not specified"}\nPhone: ${order.recipientPhone || "Not specified"}`,
    });
  }
  return emails;
}

const STATUS_MESSAGE: Partial<Record<OrderStatus, { kind: NotificationKind; text: string }>> = {
  TYING: { kind: "STATUS_TYING", text: "We have started preparing your order." },
  OUT_FOR_DELIVERY: { kind: "STATUS_OUT", text: "Your order is in the van and out for delivery." },
};

/** The customer email for a status change, or null when this move doesn't notify. */
export function statusEmail(order: NotificationOrder, previousStatus: OrderStatus): QueuedEmail | null {
  const message = STATUS_MESSAGE[order.status];
  if (order.status === previousStatus || !message) return null;
  const to = customerEmail(order);
  if (!to) {
    console.warn("Order status email skipped: no customer email", { orderCode: order.code });
    return null;
  }
  return {
    kind: message.kind,
    dedupeKey: `status:${order.code}:${order.status}`,
    to,
    subject: `Order ${order.code} update`,
    text: `${message.text}\n\n${details(order)}`,
    html: detailsHtml(message.text, order),
  };
}

/** Morning digest to the admins listing every order due for delivery on `day`. */
export function dailyDigestEmails(orders: NotificationOrder[], day: string): QueuedEmail[] {
  if (orders.length === 0) return [];
  const body = [
    `${orders.length} order(s) scheduled for delivery on ${day}:`,
    ...orders.map((order) => `\n${details(order)}\nCustomer: ${order.customerName || "Not specified"} · ${order.recipientPhone || "no phone"}`),
  ].join("\n");
  return adminRecipients().map((admin) => ({
    kind: "SCHEDULED_ADMIN_DIGEST" as const,
    dedupeKey: `digest:${day}:${admin}`,
    to: admin,
    subject: `Deliveries for ${day} (${orders.length})`,
    text: body,
  }));
}
