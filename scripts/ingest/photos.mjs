/**
 * Candidate portraits.
 *
 * Source: unitedstates/images — official congressional portraits, public
 * domain as works of the US government. Keyed by the Bioguide ID that
 * candidates.mjs already resolved, so no ID is ever guessed here.
 *
 * Candidates who have never served in Congress have no equivalent
 * public-domain portrait. They fall back to a generated monogram in the UI.
 * Nothing here scrapes campaign or news sites — those images are copyrighted
 * and are not ours to redistribute.
 */
import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, OUT, writeJSON, log } from '../lib/util.mjs';

const SIZE = '450x550';
const url = (id) =>
  `https://raw.githubusercontent.com/unitedstates/images/gh-pages/congress/${SIZE}/${id}.jpg`;

export async function run({ force = false } = {}) {
  const races = JSON.parse(await readFile(join(OUT, 'races.json'), 'utf8'));
  const ids = new Set();
  for (const race of races.races) {
    if (race.seatHolder?.bioguide) ids.add(race.seatHolder.bioguide);
    for (const c of race.candidates) if (c.record?.bioguide) ids.add(c.record.bioguide);
  }

  const dir = join(ROOT, 'public', 'photos');
  await mkdir(dir, { recursive: true });

  let fetched = 0;
  let cached = 0;
  const available = [];
  const missing = [];

  for (const id of ids) {
    const dest = join(dir, `${id}.jpg`);
    if (!force) {
      try {
        await stat(dest);
        cached++;
        available.push(id);
        continue;
      } catch {
        /* not on disk yet */
      }
    }
    const res = await fetch(url(id));
    if (!res.ok) {
      missing.push(id);
      continue;
    }
    await writeFile(dest, Buffer.from(await res.arrayBuffer()));
    available.push(id);
    fetched++;
  }

  // The app checks this manifest instead of probing for 404s at render time.
  await writeJSON(
    'photo-manifest.json',
    {
      meta: {
        source: 'unitedstates/images (congressional portraits)',
        license: 'public domain — works of the US government',
        size: SIZE,
        generatedAt: new Date().toISOString().slice(0, 10),
        note: 'Candidates who never served in Congress have no portrait here and render a monogram.',
      },
      available: available.sort(),
      unavailable: missing.sort(),
    },
    { pretty: true },
  );

  log('photos', `${fetched} fetched, ${cached} cached, ${missing.length} unavailable`);
  if (missing.length) log('photos', `no portrait for: ${missing.join(', ')}`);
  return { fetched, cached, missing: missing.length };
}

if (import.meta.url === `file://${process.argv[1]}`) await run();
