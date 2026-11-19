import { prisma } from "../../../../../lib/prisma";
import { json, route, bad } from "../../../../../lib/api";
import { requireStaff } from "../../../../../lib/auth-helpers";
import { flushNotifications } from "../../../../../lib/notifications";

type Params = { params: Promise<{ id: string }> };

/** POST /api/admin/notifications/[id] — manually retry an unsent email. */
export const POST = route(async (_req: Request, { params }: Params) => {
  await requireStaff();
  const { id } = await params;

  const reset = await prisma.notification.updateMany({
    where: { id, status: { not: "SENT" } },
    data: { status: "PENDING", attempts: 0, scheduledFor: new Date() },
  });
  if (reset.count === 0) return bad("Email not found or already sent", 404);

  const result = await flushNotifications({ ids: [id] });
  if (result.failed > 0) return bad("Send failed again — check the email configuration", 502);
  return json({ ok: true });
});
