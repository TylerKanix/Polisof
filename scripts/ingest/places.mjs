/**
 * Places — the towns and cities layer drawn inside a zoomed state.
 *
 * Source: kelvins/US-Cities-Database — ~29.9k incorporated places with parent
 * county and coordinates (derived from USGS GNIS / Census place files).
 *
 * Population and place-level demographics are deliberately NOT seeded offline
 * (see the note at the join site) and stay null until `npm run sync:census`
 * fills them from api.census.gov. The UI renders unsized dots for null
 * population rather than inventing a size.
 *
 * Emitted per state (places/{stateFips}.json) so a zoom loads one small file.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fetchCached, csvToObjects, writeJSON, num, log, ROOT } from '../lib/util.mjs';
import { STATES, ABBR_TO_FIPS } from '../lib/states.mjs';

const CITIES = 'https://raw.githubusercontent.com/kelvins/US-Cities-Database/main/csv/us_cities.csv';

const normalize = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/\b(county|parish|borough|census area|city and borough|municipality)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();

export async function run() {
  const topo = JSON.parse(
    await readFile(join(ROOT, 'public', 'data', 'geo', 'counties-10m.json'), 'utf8'),
  );

  // county name (normalized) + state fips -> county fips, straight off the
  // geometry so a place can only ever attach to a shape that renders.
  const countyIndex = new Map();
  for (const g of topo.objects.counties.geometries) {
    const fips = String(g.id).padStart(5, '0');
    countyIndex.set(`${fips.slice(0, 2)}|${normalize(g.properties.name)}`, fips);
  }

  const cities = csvToObjects(await fetchCached(CITIES, 'us-cities.csv'));

  // Build the place records first, then attach population by inverting the
  // join. Matching city -> population by "first candidate within a radius"
  // silently pulls Concord CA's population into Concord NH; going the other
  // way, each population record claims exactly one nearest same-name place,
  // so a name can never be spent twice or land in the wrong state.
  const records = [];
  const byName = new Map();
  const byState = {};
  let noCounty = 0;

  for (const c of cities) {
    const stateFips = ABBR_TO_FIPS[c.STATE_CODE];
    if (!stateFips) continue; // territories hold no Senate seats
    const lat = num(c.LATITUDE);
    const lon = num(c.LONGITUDE);
    if (lat === null || lon === null) continue;

    const countyFips = countyIndex.get(`${stateFips}|${normalize(c.COUNTY)}`) ?? null;
    if (!countyFips) noCounty++;

    const rec = {
      n: c.CITY,
      c: countyFips,
      y: Number(lat.toFixed(4)),
      x: Number(lon.toFixed(4)),
      p: null,
      _state: stateFips,
    };
    records.push(rec);
    const key = normalize(c.CITY);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(rec);
  }

  // NOTE: no offline population join. The obvious candidate (plotly's
  // 2014_us_cities) geocodes by *name*, not per row — every "Portland" in it
  // carries Portland OR's coordinates, so Portland ME, IN and CT are
  // indistinguishable by location. Any join against it silently assigns
  // Concord CA's 123,764 residents to Concord NH. Town population and
  // demographics therefore come from the Census place-level connector
  // (`npm run sync:census`), and stay null until it runs.
  const joined = 0;

  for (const rec of records) {
    const stateFips = rec._state;
    delete rec._state;
    (byState[stateFips] ??= []).push(rec);
  }

  let total = 0;
  for (const [fips, places] of Object.entries(byState)) {
    // Biggest first: the renderer draws labels until the viewport is full, so
    // ordering decides which towns earn a label at low zoom.
    places.sort((a, b) => (b.p ?? 0) - (a.p ?? 0) || a.n.localeCompare(b.n));
    total += places.length;
    await writeJSON(`places/${fips}.json`, {
      state: STATES[fips].abbr,
      count: places.length,
      withPopulation: places.filter((p) => p.p !== null).length,
      places,
    });
  }

  await writeJSON(
    'places/index.json',
    {
      meta: {
        sources: ['kelvins/US-Cities-Database (USGS GNIS / Census place files)'],
        note:
          'Names, parent county and coordinates only. Population is null offline by ' +
          'design — no verifiable place-level population source was available to the ' +
          'ingest, and a wrong town population is worse than none.',
        refresh: 'npm run sync:census fills place-level population and ACS demographics',
        generatedAt: new Date().toISOString().slice(0, 10),
        total,
        withPopulation: joined,
      },
      states: Object.fromEntries(
        Object.entries(byState).map(([f, p]) => [f, p.length]),
      ),
    },
    { pretty: true },
  );

  log('places', `${total} places, ${joined} with population, ${noCounty} unattached to a county`);
  return { places: total };
}

if (import.meta.url === `file://${process.argv[1]}`) await run();
