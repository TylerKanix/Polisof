/** Writes the hand-authored 2026 race and the provenance manifest. */
import { writeJSON, log } from '../lib/util.mjs';
import { RACE, VERIFIED_THROUGH } from '../lib/roster.mjs';
import { MANIFEST_SOURCES } from '../lib/sources.mjs';
import { COUNTY_RETURNS, PRIMARY_2026, WANTED, VERIFICATIONS } from '../lib/county-returns.mjs';

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

  // Certified figures read from county-clerk PDFs. Kept in their own file
  // because they are county-resolution and must never be summed into a
  // district figure that is a sum of municipalities.
  await writeJSON(
    'county-returns.json',
    {
      meta: {
        generatedAt: new Date().toISOString().slice(0, 10),
        note:
          'Transcribed from official county-clerk PDFs. County-level unless stated. ' +
          'Ballot-mode figures are carried as a checksum and verified by npm run audit.',
      },
      returns: COUNTY_RETURNS,
      verifications: VERIFICATIONS,
      primary2026: PRIMARY_2026,
      wanted: WANTED,
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

  log(
    'race',
    `${RACE.candidates.length} candidates, verified through ${VERIFIED_THROUGH}; ` +
      `${COUNTY_RETURNS.length} county returns transcribed`,
  );
  return { candidates: RACE.candidates.length };
}

if (import.meta.url === `file://${process.argv[1]}`) await run();
