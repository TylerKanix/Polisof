/**
 * Census ACS connector — county AND place demographics at the current vintage.
 *
 *   npm run sync:census                 # keyless, fine for this volume
 *   CENSUS_API_KEY=... npm run sync:census
 *
 * Two jobs:
 *   1. Re-derive county-census.json from api.census.gov, replacing the seeded
 *      2014-2018 vintage with the newest published ACS 5-year release.
 *   2. Fill the town layer, which ships EMPTY on purpose. Place population and
 *      demographics have no trustworthy offline mirror, so they are fetched
 *      here or not shown at all.
 *
 * Keyless requests are capped around 500/day, which covers a full 51-state
 * run comfortably since each state is one request per geography level.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { OUT, writeJSON, log, round } from '../lib/util.mjs';
import { STATES } from '../lib/states.mjs';

const KEY = process.env.CENSUS_API_KEY || '';
const YEAR = Number(process.env.ACS_YEAR || 2023);
const BASE = `https://api.census.gov/data/${YEAR}/acs/acs5`;

/** ACS variable -> our field. Profile tables would be terser but move between
 *  vintages; detail tables are stable, which matters for a yearly re-run. */
const VARS = {
  B01003_001E: 'pop',
  B01002_001E: 'medianAge',
  B19013_001E: 'medianHHIncome',
  B17001_002E: '_povertyCount',
  B17001_001E: '_povertyBase',
  B15003_022E: '_ba',
  B15003_023E: '_ma',
  B15003_024E: '_prof',
  B15003_025E: '_phd',
  B15003_001E: '_eduBase',
  B03002_003E: '_whiteNH',
  B03002_004E: '_blackNH',
  B03002_006E: '_asianNH',
  B03002_005E: '_nativeNH',
  B03002_012E: '_hispanic',
  B03002_001E: '_raceBase',
  B01001_020E: '_m65a',
  B01001_021E: '_m65b',
  B01001_022E: '_m65c',
  B01001_023E: '_m65d',
  B01001_024E: '_m65e',
  B01001_025E: '_m65f',
  B01001_044E: '_f65a',
  B01001_045E: '_f65b',
  B01001_046E: '_f65c',
  B01001_047E: '_f65d',
  B01001_048E: '_f65e',
  B01001_049E: '_f65f',
  B25077_001E: 'medianHomeValue',
  B23025_005E: '_unemployed',
  B23025_003E: '_laborForce',
  B11001_001E: 'households',
};

const CODES = Object.keys(VARS);

async function fetchACS(forClause, inClause) {
  const url = new URL(BASE);
  url.searchParams.set('get', `NAME,${CODES.join(',')}`);
  url.searchParams.set('for', forClause);
  if (inClause) url.searchParams.set('in', inClause);
  if (KEY) url.searchParams.set('key', KEY);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Census ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const rows = await res.json();
  const header = rows.shift();
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

const n = (v) => {
  const x = Number(v);
  // The ACS uses large negative sentinels for suppressed cells.
  return Number.isFinite(x) && x > -1e6 ? x : null;
};
const share = (part, base) => (part === null || !base ? null : round((100 * part) / base, 1));

function derive(row) {
  const g = (k) => n(row[k]);
  const raceBase = g('B03002_001E');
  const eduBase = g('B15003_001E');
  const pop = g('B01003_001E');
  const over65 =
    ['_m65a', '_m65b', '_m65c', '_m65d', '_m65e', '_m65f', '_f65a', '_f65b', '_f65c', '_f65d', '_f65e', '_f65f']
      .map((key) => Object.keys(VARS).find((v) => VARS[v] === key))
      .reduce((a, code) => a + (g(code) ?? 0), 0);
  const ba = ['_ba', '_ma', '_prof', '_phd']
    .map((key) => Object.keys(VARS).find((v) => VARS[v] === key))
    .reduce((a, code) => a + (g(code) ?? 0), 0);

  return {
    pop,
    medianAge: g('B01002_001E'),
    medianHHIncome: g('B19013_001E'),
    medianHomeValue: g('B25077_001E'),
    households: g('B11001_001E'),
    pctPoverty: share(g('B17001_002E'), g('B17001_001E')),
    pctBAplus: share(ba, eduBase),
    pctWhiteNH: share(g('B03002_003E'), raceBase),
    pctBlackNH: share(g('B03002_004E'), raceBase),
    pctAsianNH: share(g('B03002_006E'), raceBase),
    pctNativeNH: share(g('B03002_005E'), raceBase),
    pctHispanic: share(g('B03002_012E'), raceBase),
    pct65plus: share(over65, pop),
    unemployment: share(g('B23025_005E'), g('B23025_003E')),
  };
}

export async function run() {
  // ── Counties ──
  const counties = await fetchACS('county:*', 'state:*');
  const countyOut = {};
  for (const row of counties) {
    const fips = `${row.state}${row.county}`;
    countyOut[fips] = { ...derive(row), name: row.NAME };
  }
  log('census-acs', `${Object.keys(countyOut).length} counties at ACS ${YEAR} 5-year`);

  const existingPath = join(OUT, 'county-census.json');
  let merged = { meta: {}, counties: {} };
  try {
    merged = JSON.parse(await readFile(existingPath, 'utf8'));
  } catch {
    /* first run */
  }
  // Overlay the fresh values, keeping seeded fields the ACS detail tables do
  // not carry (migration, veterans, crime) so nothing silently disappears.
  for (const [fips, fresh] of Object.entries(countyOut)) {
    merged.counties[fips] = { ...(merged.counties[fips] ?? {}), ...strip(fresh) };
  }
  merged.meta = {
    ...merged.meta,
    source: 'US Census Bureau ACS 5-year via api.census.gov',
    vintage: { ...(merged.meta.vintage ?? {}), acs: `${YEAR - 4}-${YEAR} (ACS 5-year)` },
    syncedAt: new Date().toISOString(),
    note: 'Fields not carried by ACS detail tables (migration, veterans, crime) retain their seeded vintage.',
  };
  await writeJSON('county-census.json', merged);

  // ── Places: the layer that ships empty ──
  let placesFilled = 0;
  for (const [fips, meta] of Object.entries(STATES)) {
    let rows;
    try {
      rows = await fetchACS('place:*', `state:${fips}`);
    } catch (err) {
      log('census-acs', `WARN ${meta.abbr} places: ${err.message}`);
      continue;
    }
    const byName = new Map();
    for (const row of rows) {
      // "Concord city, New Hampshire" -> "concord"
      const bare = row.NAME.split(',')[0]
        .replace(/ (city|town|village|borough|CDP|municipality|township)$/i, '')
        .trim()
        .toLowerCase();
      byName.set(bare, derive(row));
    }

    const filePath = `places/${fips}.json`;
    let file;
    try {
      file = JSON.parse(await readFile(join(OUT, filePath), 'utf8'));
    } catch {
      continue;
    }
    for (const p of file.places) {
      const hit = byName.get(p.n.toLowerCase());
      if (!hit) continue;
      p.p = hit.pop;
      p.demo = hit;
      placesFilled++;
    }
    file.withPopulation = file.places.filter((p) => p.p !== null).length;
    file.places.sort((a, b) => (b.p ?? 0) - (a.p ?? 0) || a.n.localeCompare(b.n));
    file.syncedAt = new Date().toISOString();
    await writeJSON(filePath, file);
  }

  log('census-acs', `${placesFilled} places filled with population + demographics`);
  return { counties: Object.keys(countyOut).length, places: placesFilled };
}

/** Drop the derivation scratch fields before persisting. */
const strip = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith('_')));

if (import.meta.url === `file://${process.argv[1]}`) await run();
