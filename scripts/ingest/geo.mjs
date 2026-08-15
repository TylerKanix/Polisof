/**
 * Geometry ingest.
 *
 * Source: `us-atlas` (npm) — TopoJSON built from the US Census Bureau's
 * cartographic boundary files, 1:10m. Public domain (Census) / ISC (us-atlas).
 *
 * Emits:
 *   geo/states-10m.json    national states + nation outline
 *   geo/counties-10m.json  all 3,143 counties (arcs shared; sliced client-side)
 *   geo/state-meta.json    per-state bbox + centroid, for labels and zoom framing
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { geoPath, geoAlbersUsa, geoCentroid, geoBounds } from 'd3-geo';
import { feature } from 'topojson-client';
import { ROOT, writeJSON, log } from '../lib/util.mjs';
import { STATES } from '../lib/states.mjs';

const ATLAS = join(ROOT, 'node_modules', 'us-atlas');

export async function run() {
  const statesTopo = JSON.parse(await readFile(join(ATLAS, 'states-10m.json'), 'utf8'));
  const countiesTopo = JSON.parse(await readFile(join(ATLAS, 'counties-10m.json'), 'utf8'));

  // Drop territories that hold no Senate seats — keeps the file lean and the
  // Albers USA projection from silently dropping them mid-render.
  const keep = new Set(Object.keys(STATES));
  statesTopo.objects.states.geometries = statesTopo.objects.states.geometries.filter((g) =>
    keep.has(String(g.id)),
  );
  countiesTopo.objects.counties.geometries = countiesTopo.objects.counties.geometries.filter((g) =>
    keep.has(String(g.id).slice(0, 2)),
  );
  delete countiesTopo.objects.states;
  delete countiesTopo.objects.nation;

  await writeJSON('geo/states-10m.json', statesTopo);
  await writeJSON('geo/counties-10m.json', countiesTopo);

  // Per-state framing metadata, computed in projected screen space so the app
  // can zoom to a state without re-deriving bounds at runtime.
  const states = feature(statesTopo, statesTopo.objects.states);
  const projection = geoAlbersUsa().scale(1300).translate([487.5, 305]);
  const path = geoPath(projection);

  const meta = {};
  for (const f of states.features) {
    const fips = String(f.id).padStart(2, '0');
    const s = STATES[fips];
    if (!s) continue;
    const [[x0, y0], [x1, y1]] = path.bounds(f);
    meta[fips] = {
      fips,
      abbr: s.abbr,
      name: s.name,
      bounds: [round4(x0), round4(y0), round4(x1), round4(y1)],
      centroid: path.centroid(f).map(round4),
      lonlat: geoCentroid(f).map(round4),
      llBounds: geoBounds(f).flat().map(round4),
      area: Math.round(path.area(f)),
    };
  }
  await writeJSON('geo/state-meta.json', meta, { pretty: true });

  const nCounties = countiesTopo.objects.counties.geometries.length;
  log('geo', `${Object.keys(meta).length} states, ${nCounties} counties`);
  return { states: Object.keys(meta).length, counties: nCounties };
}

const round4 = (v) => Number(v.toFixed(4));

if (import.meta.url === `file://${process.argv[1]}`) await run();
