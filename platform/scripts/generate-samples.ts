/**
 * Generates synthetic government exports in samples/: the initial files of the demo company and a
 * later export (renewals, a leaver, a joiner, one row older than stored) to try the smart update.
 *   npm run samples
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildDataset, buildNextExport } from '../src/db/seed-data';
import { todayRiyadh } from '../src/lib/dates';
import { buildSampleWorkbook, SAMPLE_FILE_NAMES } from '../src/lib/imports/samples';
import { TEMPLATE_KEYS } from '../src/lib/imports/types';

async function main() {
  const today = todayRiyadh();
  const base = buildDataset(today);
  const next = buildNextExport(base, today);
  for (const [folder, data] of [['initial', base], ['next-export', next]] as const) {
    const dir = path.resolve(import.meta.dirname, '..', 'samples', folder);
    mkdirSync(dir, { recursive: true });
    for (const k of TEMPLATE_KEYS) {
      writeFileSync(path.join(dir, SAMPLE_FILE_NAMES[k]), await buildSampleWorkbook(k, data));
    }
    console.log(`samples/${folder}: ${TEMPLATE_KEYS.length} files`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
