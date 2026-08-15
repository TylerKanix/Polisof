/**
 * Build every static dataset the app reads, in dependency order.
 *
 * Geometry first (results and places validate their FIPS against it), then
 * results, census, places, the candidate roster, and finally portraits — which
 * need the resolved Bioguide IDs from the roster step.
 *
 * Network fetches are cached under scripts/.cache, so re-runs are offline and
 * fast. Delete that directory to force a refresh from source.
 */
import { writeJSON, log } from './lib/util.mjs';

const STEPS = [
  ['geo', () => import('./ingest/geo.mjs')],
  ['elections', () => import('./ingest/elections.mjs')],
  ['census', () => import('./ingest/census.mjs')],
  ['places', () => import('./ingest/places.mjs')],
  ['candidates', () => import('./ingest/candidates.mjs')],
  ['photos', () => import('./ingest/photos.mjs')],
];

const started = Date.now();
const results = {};
let failed = 0;

for (const [name, load] of STEPS) {
  const t0 = Date.now();
  try {
    const mod = await load();
    results[name] = { ok: true, ...(await mod.run()), ms: Date.now() - t0 };
    log('build', `\x1b[32m✓\x1b[0m ${name} (${Date.now() - t0}ms)`);
  } catch (err) {
    failed++;
    results[name] = { ok: false, error: String(err?.message ?? err) };
    log('build', `\x1b[31m✗\x1b[0m ${name}: ${err?.message ?? err}`);
  }
}

// A manifest the app loads on boot: it drives the provenance panel, so what
// the UI claims about its own data always comes from the build that made it.
await writeJSON(
  'manifest.json',
  {
    generatedAt: new Date().toISOString(),
    buildMs: Date.now() - started,
    steps: results,
    sources: [
      {
        id: 'geometry',
        label: 'State & county boundaries',
        source: 'US Census Bureau cartographic boundaries via us-atlas',
        license: 'Public domain (Census) / ISC (us-atlas)',
        vintage: '1:10m',
      },
      {
        id: 'results',
        label: 'County presidential results',
        source: 'State election authorities / AP, compiled by tonmcg',
        license: 'Open data',
        vintage: '2016, 2020, 2024',
      },
      {
        id: 'census',
        label: 'County demographics & economy',
        source: 'US Census Bureau ACS & PEP, USDA ERS, BLS LAUS, FBI UCR',
        license: 'Public domain',
        vintage: 'ACS 2014-2018; population 2018',
      },
      {
        id: 'places',
        label: 'Towns & cities',
        source: 'USGS GNIS / Census place files',
        license: 'Public domain',
        vintage: 'Names, county and coordinates only',
      },
      {
        id: 'identity',
        label: 'Candidate identity & office history',
        source: 'unitedstates/congress-legislators',
        license: 'CC0',
        vintage: 'Current',
      },
      {
        id: 'portraits',
        label: 'Candidate portraits',
        source: 'unitedstates/images',
        license: 'Public domain (US government works)',
        vintage: 'Current members only',
      },
      {
        id: 'roster',
        label: 'Challenger fields',
        source: 'Hand-authored from public reporting (scripts/lib/roster.mjs)',
        license: 'n/a',
        vintage: 'Verified through 2026-05',
      },
    ],
  },
  { pretty: true },
);

log('build', failed ? `\x1b[31m${failed} step(s) failed\x1b[0m` : '\x1b[32mall steps ok\x1b[0m');
process.exit(failed ? 1 : 0);
