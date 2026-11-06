/**
 * Run the daily job locally (retention purges + B-23 WhatsApp follow-ups, mocked sender):
 *
 *   npm run jobs:daily                       # now
 *   npm run jobs:daily -- 2026-11-07T09:00Z  # as if it were that time
 *
 * Uses the dev SQLite database (ELBA_DATABASE_URL, default file:./dev.db). The WhatsApp transport
 * is the console mock from src/lib/notify (masked number, no network).
 */
import { runDailyJobs } from "../src/lib/jobs";
import { db } from "../src/lib/db";

async function main() {
  process.env.ELBA_DATABASE_URL ??= "file:./dev.db";
  const arg = process.argv[2];
  const now = arg ? new Date(arg) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error(`Invalid date: ${arg}`);
  const report = await runDailyJobs(now);
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
