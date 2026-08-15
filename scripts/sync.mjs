/**
 * Run every live connector.
 *
 *   npm run sync
 *
 * Each connector is independent: one failing (no key, rate limit, an API
 * moving) must not stop the others, and none of them can leave the app in a
 * worse state than before — a connector that cannot verify a value writes
 * null, never a guess.
 *
 * Keys, all optional, all free:
 *   FEC_API_KEY     https://api.data.gov/signup/   campaign finance + outside spending
 *   CENSUS_API_KEY  https://api.census.gov/data/key_signup.html
 *   META_AD_TOKEN   https://developers.facebook.com/  creative-level political ads
 */
import { log } from './lib/util.mjs';

const CONNECTORS = [
  ['census', () => import('./connectors/census-acs.mjs'), 'county + place demographics'],
  ['fec', () => import('./connectors/fec.mjs'), 'cash on hand'],
  ['kalshi', () => import('./connectors/kalshi.mjs'), 'market odds'],
  ['ads', () => import('./connectors/ads.mjs'), 'ad spending'],
];

const only = process.argv[2];
const results = {};

for (const [name, load, what] of CONNECTORS) {
  if (only && only !== name) continue;
  const t0 = Date.now();
  try {
    const mod = await load();
    results[name] = { ok: true, ...(await mod.run()) };
    log('sync', `\x1b[32m✓\x1b[0m ${name} — ${what} (${Date.now() - t0}ms)`);
  } catch (err) {
    results[name] = { ok: false, error: String(err?.message ?? err) };
    log('sync', `\x1b[33m○\x1b[0m ${name} skipped — ${err?.message ?? err}`);
  }
}

const ok = Object.values(results).filter((r) => r.ok).length;
log('sync', `${ok}/${Object.keys(results).length} connectors succeeded`);
log('sync', 'Fields a connector could not verify remain null and render as an em dash.');
