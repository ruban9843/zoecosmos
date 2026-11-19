/**
 * Email outbox. Request handlers write `Notification` rows (inside their DB
 * transaction when possible) and flush them after the response is sent, so a
 * slow mail API never blocks a click. The daily cron retries failures.
 */
import { after } from "next/server";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";
import { openMailTransport, type EmailTransport, type QueuedEmail } from "./order-notifications";

export const MAX_ATTEMPTS = 3;

type Db = PrismaClient | Prisma.TransactionClient;

export async function enqueue(db: Db, orderId: string | null, emails: QueuedEmail[], scheduledFor?: Date) {
  if (emails.length === 0) return;
  await db.notification.createMany({
    data: emails.map((e) => ({
      orderId,
      kind: e.kind,
      to: e.to,
      subject: e.subject,
      text: e.text,
      html: e.html ?? null,
      dedupeKey: e.dedupeKey,
      ...(scheduledFor ? { scheduledFor } : {}),
    })),
    skipDuplicates: true,
  });
}

export async function flushNotifications(
  opts: { orderId?: string; ids?: string[]; limit?: number } = {},
  transport: EmailTransport = openMailTransport,
) {
  const due = await prisma.notification.findMany({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      attempts: { lt: MAX_ATTEMPTS },
      scheduledFor: { lte: new Date() },
      ...(opts.orderId ? { orderId: opts.orderId } : {}),
      ...(opts.ids ? { id: { in: opts.ids } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: opts.limit ?? 50,
  });

  let sent = 0;
  let failed = 0;
  for (const n of due) {
    // Claim the row so a concurrent flush (cron vs after()) can't double-send it.
    const claim = await prisma.notification.updateMany({
      where: { id: n.id, attempts: n.attempts, status: { not: "SENT" } },
      data: { attempts: { increment: 1 } },
    });
    if (claim.count === 0) continue;
    try {
      await transport({ to: n.to, subject: n.subject, text: n.text, html: n.html ?? undefined, idempotencyKey: n.dedupeKey });
      await prisma.notification.update({
        where: { id: n.id },
        data: { status: "SENT", sentAt: new Date(), lastError: null },
      });
      sent++;
    } catch (error) {
      const reason = error instanceof Error ? error.message.slice(0, 200) : "Transport error";
      await prisma.notification.update({ where: { id: n.id }, data: { status: "FAILED", lastError: reason } });
      console.error("Notification could not be sent", { id: n.id, kind: n.kind, reason });
      failed++;
    }
  }
  return { sent, failed };
}

/** Send queued emails for an order once the HTTP response has gone out. */
export function flushAfterResponse(orderId?: string) {
  after(async () => {
    try {
      await flushNotifications({ orderId });
    } catch (error) {
      console.error("Notification flush failed", error);
    }
  });
}
