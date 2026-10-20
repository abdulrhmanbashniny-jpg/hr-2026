/**
 * Runs the daily compliance job once (rules, notifications, weekly reports, subscription states).
 * Schedule it with cron on self-hosted servers, e.g. `0 5 * * * cd /srv/mutabaa && npm run job:daily`
 * (05:00 UTC = 08:00 Riyadh).
 */
import { closeDb } from '../src/db';
import { runDailyJob } from '../src/lib/notifications/dispatch';

runDailyJob()
  .then((r) => console.log(JSON.stringify(r, null, 2)))
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
