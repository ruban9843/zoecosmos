import { timingSafeEqual } from "crypto";
import { json, route, bad } from "../../../../lib/api";
import { runDailyJob } from "../../../../lib/jobs/daily";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** GET /api/cron/daily — Vercel Cron entry point (sends `Authorization: Bearer $CRON_SECRET`). */
export const GET = route(async (req: Request) => {
  if (!authorized(req)) return bad("Unauthorized", 401);
  const result = await runDailyJob();
  console.info("Daily job finished", result);
  return json(result);
});
