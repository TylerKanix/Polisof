/**
 * Build every static dataset, in dependency order.
 *
 * Elections runs first and geometry second, because which municipalities the
 * map draws is decided by the returns — the district is defined by who voted
 * on a CD-7 ballot, not by a shapefile this repo happens to carry.
 */
import { log } from './lib/util.mjs';
import { run as elections } from './ingest/elections.mjs';
import { run as geo } from './ingest/geo.mjs';
import { run as race } from './ingest/race.mjs';
import { run as audit } from './audit.mjs';

const steps = [
  ['elections', elections],
  ['geo', geo],
  ['race', race],
  // Last, and part of the build rather than a separate chore: a dataset that
  // does not reproduce the certified results is not a dataset worth shipping.
  ['audit', audit],
];

const started = Date.now();
for (const [name, step] of steps) {
  const t = Date.now();
  const result = await step();
  log('build', `${name} ok in ${((Date.now() - t) / 1000).toFixed(1)}s — ${JSON.stringify(result)}`);
}
log('build', `done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
