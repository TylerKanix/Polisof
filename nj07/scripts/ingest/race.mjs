/** Writes the hand-authored 2026 race and the provenance manifest. */
import { writeJSON, log } from '../lib/util.mjs';
import { RACE, VERIFIED_THROUGH } from '../lib/roster.mjs';
import { MANIFEST_SOURCES } from '../lib/sources.mjs';

export async function run() {
  await writeJSON(
    'race.json',
    {
      meta: {
        verifiedThrough: VERIFIED_THROUGH,
        generatedAt: new Date().toISOString().slice(0, 10),
        warning:
          'Hand-authored from public reporting. Every claim carries a citation, ' +
          'and nothing here is transcribed from a certification — unlike every ' +
          'other number in this app.',
      },
      race: RACE,
    },
    { pretty: true },
  );

  await writeJSON(
    'manifest.json',
    {
      generatedAt: new Date().toISOString(),
      sources: MANIFEST_SOURCES,
    },
    { pretty: true },
  );

  log('race', `${RACE.candidates.length} candidates, verified through ${VERIFIED_THROUGH}`);
  return { candidates: RACE.candidates.length };
}

if (import.meta.url === `file://${process.argv[1]}`) await run();
