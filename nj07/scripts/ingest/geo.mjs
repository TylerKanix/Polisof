/**
 * Geometry for the municipalities that make up NJ-07.
 *
 * Source: Municipal Boundaries of NJ, published by the NJ Office of GIS.
 * The statewide file is 23 MB, which is not a thing to hand a browser, so it
 * is cut to the district and simplified — but simplified *through a topology*.
 * Simplifying each town's polygon on its own drops different points from the
 * two sides of a shared border and opens hairline gaps between towns that
 * look like rendering bugs; shared arcs are simplified once and both towns
 * keep the same edge.
 *
 * Runs after elections.mjs, because which municipalities to keep is decided
 * by the returns, not by this file.
 *
 * Emits geo/munis.json (TopoJSON) and geo/frame.json (projection framing).
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { geoBounds, geoCentroid, geoArea } from 'd3-geo';
import { topology } from 'topojson-server';
import { presimplify, simplify, quantile } from 'topojson-simplify';
import { feature, merge, quantize } from 'topojson-client';
import { fetchCached, writeJSON, log, ROOT, round } from '../lib/util.mjs';
import { BOUNDARIES } from '../lib/sources.mjs';

/**
 * Simplification is tuned by measurement, not by eye: at these settings no
 * municipality's area moves by more than a percent, the smallest town in the
 * district (Winfield, a fifth of a square mile) survives with its shape, and
 * the file lands around 150 KB. Quantising *after* simplifying matters —
 * presimplify writes a weight into every coordinate, and quantising last is
 * what strips them back out.
 */
const SIMPLIFY_QUANTILE = 0.35;
const QUANTIZATION = 1e4;
/** No town may lose more of its area than this to simplification. */
const MAX_AREA_ERROR = 0.02;

export async function run() {
  const raw = await fetchCached(BOUNDARIES.url, BOUNDARIES.cache);
  const all = JSON.parse(raw);

  const district = JSON.parse(await readFile(join(ROOT, 'public', 'data', 'district.json'), 'utf8'));
  const wanted = new Map(district.municipalities.map((m) => [m.geoid, m]));

  const features = [];
  for (const f of all.features) {
    const m = wanted.get(f.properties.census2010);
    if (!m) continue;
    features.push({
      type: 'Feature',
      id: m.geoid,
      properties: { geoid: m.geoid, name: m.name, county: m.county },
      geometry: f.geometry,
    });
  }

  const missing = [...wanted.keys()].filter((g) => !features.some((f) => f.id === g));
  if (missing.length) {
    throw new Error(
      `${missing.length} municipalities in the returns have no boundary: ${missing.join(', ')}`,
    );
  }
  log('geo', `${features.length} municipal polygons kept`);

  const collection = { type: 'FeatureCollection', features };

  // Frame from the full-resolution geometry, before simplification moves edges.
  const [[west, south], [east, north]] = geoBounds(collection);
  const centroid = geoCentroid(collection);

  let topo = topology({ munis: collection });
  const before = countPoints(topo);
  topo = presimplify(topo);
  topo = simplify(topo, quantile(topo, SIMPLIFY_QUANTILE));
  topo = quantize(topo, QUANTIZATION);
  const after = countPoints(topo);
  log('geo', `${before} → ${after} vertices (${Math.round((100 * after) / before)}%)`);

  // A town that simplifies away, or deforms past recognition, must stop the
  // build — a missing polygon on this map reads as "no data for that town".
  const simplified = feature(topo, topo.objects.munis);
  const errors = [];
  for (const f of simplified.features) {
    const original = collection.features.find((x) => x.id === f.id);
    if (!f.geometry || !f.geometry.coordinates.length) {
      errors.push(`${original.properties.name} lost its geometry`);
      continue;
    }
    const err = Math.abs(geoArea(f) - geoArea(original)) / geoArea(original);
    if (err > MAX_AREA_ERROR) {
      errors.push(`${original.properties.name} area moved ${(100 * err).toFixed(1)}%`);
    }
  }
  if (errors.length) {
    throw new Error(`Simplification damaged ${errors.length} municipalities:\n  ${errors.join('\n  ')}`);
  }

  await writeJSON('geo/munis.json', topo);

  const outline = merge(topo, topo.objects.munis.geometries);
  const areaLoss = 1 - geoArea({ type: 'Feature', geometry: outline }) / geoArea(collection);

  await writeJSON(
    'geo/frame.json',
    {
      bounds: [round(west, 5), round(south, 5), round(east, 5), round(north, 5)],
      centroid: [round(centroid[0], 5), round(centroid[1], 5)],
      municipalities: simplified.features.length,
      simplification: {
        quantile: SIMPLIFY_QUANTILE,
        quantization: QUANTIZATION,
        verticesBefore: before,
        verticesAfter: after,
        areaLoss: round(areaLoss, 6),
      },
      source: BOUNDARIES.url,
    },
    { pretty: true },
  );

  log('geo', `bbox ${round(west, 3)},${round(south, 3)} → ${round(east, 3)},${round(north, 3)}`);
  log('geo', `area preserved to ${(100 * (1 - Math.abs(areaLoss))).toFixed(3)}%`);
  return { municipalities: features.length };
}

function countPoints(topo) {
  return topo.arcs.reduce((n, arc) => n + arc.length, 0);
}

if (import.meta.url === `file://${process.argv[1]}`) await run();
