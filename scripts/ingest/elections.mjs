/**
 * County-level presidential results, 2016 / 2020 / 2024.
 *
 * Source: tonmcg/US_County_Level_Election_Results_08-24, compiled from state
 * election authorities and the AP. Alaska reports by state house district
 * rather than borough; those rows are aggregated to the statewide row and
 * flagged so the UI never draws a borough choropleth it cannot support.
 *
 * Emits county-results.json: the partisan baseline every other layer leans on.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fetchCached, csvToObjects, writeJSON, num, log, ROOT } from '../lib/util.mjs';
import { STATES } from '../lib/states.mjs';

const YEARS = [2016, 2020, 2024];
const url = (y) =>
  `https://raw.githubusercontent.com/tonmcg/US_County_Level_Election_Results_08-24/master/${y}_US_County_Level_Presidential_Results.csv`;

export async function run() {
  // Valid county FIPS come from the geometry, so results can never reference a
  // shape that will not render.
  const topo = JSON.parse(
    await readFile(join(ROOT, 'public', 'data', 'geo', 'counties-10m.json'), 'utf8'),
  );
  const geoFips = new Map(
    topo.objects.counties.geometries.map((g) => [String(g.id).padStart(5, '0'), g.properties.name]),
  );

  const counties = {};
  const unmatched = new Set();
  // Rows that are real results but not county-shaped (Alaska house districts,
  // and Alaska's single statewide row in 2016). Rolled up to the state instead
  // of being thrown away.
  const stateOnly = {};

  for (const [yi, year] of YEARS.entries()) {
    const rows = csvToObjects(await fetchCached(url(year), `pres-${year}.csv`));
    let matched = 0;
    const alaska = [];
    for (const row of rows) {
      // 2016 ships `combined_fips` (unpadded); 2020/2024 ship `county_fips`.
      const rawFips = row.county_fips ?? row.combined_fips ?? '';
      const fips = String(rawFips).trim().padStart(5, '0');
      const rep = num(row.votes_gop);
      const dem = num(row.votes_dem);
      const tot = num(row.total_votes);
      if (rep === null || dem === null || tot === null) continue;

      // Alaska never certifies presidential results by borough, and the source
      // encodes that differently every cycle: 2016 replicates one statewide
      // total across every borough FIPS; 2020 uses 02901-02940; 2024 uses
      // 02001-02040, which *collide* with real borough FIPS. Take every Alaska
      // row out of the county stream and reconcile them below.
      const isAlaska = (row.state_abbr ?? row.state_name ?? '').trim() === 'AK' ||
        (row.state_name ?? '').trim() === 'Alaska';
      if (isAlaska) {
        alaska.push({ rep, dem, tot });
        continue;
      }

      if (!geoFips.has(fips)) {
        unmatched.add(`${year}:${fips}:${row.county_name}`);
        continue;
      }
      const c = (counties[fips] ??= {
        n: geoFips.get(fips),
        s: fips.slice(0, 2),
        r: [null, null, null],
        d: [null, null, null],
        t: [null, null, null],
      });
      c.r[yi] = rep;
      c.d[yi] = dem;
      c.t[yi] = tot;
      matched++;
    }
    // Replicated statewide rows (all identical) collapse to one; genuine
    // district partitions sum. Distinguishing them by value beats hard-coding
    // whichever FIPS scheme the source happened to use that cycle.
    if (alaska.length) {
      const allSame = alaska.every(
        (a) => a.rep === alaska[0].rep && a.dem === alaska[0].dem && a.tot === alaska[0].tot,
      );
      const agg = allSame
        ? alaska[0]
        : alaska.reduce(
            (acc, a) => ({ rep: acc.rep + a.rep, dem: acc.dem + a.dem, tot: acc.tot + a.tot }),
            { rep: 0, dem: 0, tot: 0 },
          );
      const s = (stateOnly['02'] ??= { r: [0, 0, 0], d: [0, 0, 0], t: [0, 0, 0] });
      s.r[yi] = agg.rep;
      s.d[yi] = agg.dem;
      s.t[yi] = agg.tot;
      log(
        'elections',
        `${year}: AK ${alaska.length} rows ${allSame ? 'deduped (replicated statewide)' : 'summed (districts)'}`,
      );
    }
    log('elections', `${year}: ${matched}/${rows.length} rows to counties`);
  }

  // Statewide rollups, plus the two-party margins the map colors by.
  const states = {};
  for (const c of Object.values(counties)) {
    const s = (states[c.s] ??= { r: [0, 0, 0], d: [0, 0, 0], t: [0, 0, 0], counties: 0 });
    s.counties++;
    YEARS.forEach((_, i) => {
      s.r[i] += c.r[i] ?? 0;
      s.d[i] += c.d[i] ?? 0;
      s.t[i] += c.t[i] ?? 0;
    });
  }
  for (const [fips, totals] of Object.entries(stateOnly)) {
    const s = (states[fips] ??= { r: [0, 0, 0], d: [0, 0, 0], t: [0, 0, 0], counties: 0 });
    YEARS.forEach((_, i) => {
      s.r[i] += totals.r[i];
      s.d[i] += totals.d[i];
      s.t[i] += totals.t[i];
    });
    s.countySubdivided = false;
  }

  const missingGeo = [...geoFips.keys()].filter((f) => !counties[f]);
  if (missingGeo.length) {
    log('elections', `WARN ${missingGeo.length} county shapes have no results (rendered "no data")`);
  }

  await writeJSON('county-results.json', {
    meta: {
      years: YEARS,
      source: 'tonmcg/US_County_Level_Election_Results_08-24',
      sourceUrl:
        'https://github.com/tonmcg/US_County_Level_Election_Results_08-24',
      derivedFrom: 'state election authorities via AP tabulation',
      office: 'US President',
      generatedAt: new Date().toISOString().slice(0, 10),
      note:
        'Alaska certifies presidential results by state house district, not borough; ' +
        'borough-level shapes therefore carry no presidential margin.',
      countiesWithResults: Object.keys(counties).length,
      countyShapesWithoutResults: missingGeo.length,
      unmatchedRows: [...unmatched].slice(0, 40),
    },
    counties,
    states,
  });

  log(
    'elections',
    `${Object.keys(counties).length} counties across ${Object.keys(states).length} states`,
  );
  void STATES;
  return { counties: Object.keys(counties).length };
}

if (import.meta.url === `file://${process.argv[1]}`) await run();
