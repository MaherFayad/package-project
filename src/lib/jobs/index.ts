import { runFollowUps, type FollowUpReport } from "./followUp";
import { runRetention, type RetentionReport } from "./retention";

export { runFollowUps } from "./followUp";
export { runRetention } from "./retention";
export { checkCronAuth } from "./cronAuth";

/**
 * The daily job (schedule it once a day, e.g. 09:00 Africa/Cairo, via the platform cron calling
 * POST /api/jobs/follow-up with the CRON_SECRET bearer, or `npm run jobs:daily`):
 * retention purges first, then the B-23 WhatsApp follow-ups.
 */
export async function runDailyJobs(now: Date = new Date()): Promise<{ retention: RetentionReport; followUp: FollowUpReport }> {
  const retention = await runRetention(now);
  const followUp = await runFollowUps({ now });
  return { retention, followUp };
}
