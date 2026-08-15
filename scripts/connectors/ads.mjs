/**
 * Advertising connector — the money actually behind the messaging.
 *
 *   npm run sync:ads
 *   META_AD_TOKEN=... npm run sync:ads     # adds Meta creative-level detail
 *
 * Three sources, in descending order of how much they can be trusted:
 *
 *   FEC independent expenditures  — legally required, itemised, names the
 *     buyer, the amount, the date and whether the spend supports or opposes
 *     each candidate. Public, keyless-ish, and pulled in full here.
 *   Meta Ad Library API           — creative-level political ads with spend
 *     and impression BANDS (never exact figures). Needs an app token tied to
 *     an ID-verified account, so it is opt-in via META_AD_TOKEN.
 *   Google Ads Transparency       — no public API. The UI links out instead;
 *     pretending otherwise would mean scraping a page that forbids it.
 *
 * Broadcast buys live in the FCC political file, which is per-station and not
 * queryable in bulk — the dossier links straight into it.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { OUT, writeJSON, log } from '../lib/util.mjs';

const FEC_KEY = process.env.FEC_API_KEY || 'DEMO_KEY';
const META_TOKEN = process.env.META_AD_TOKEN || '';
const CYCLE = 2026;

async function fecIndependentExpenditures(state) {
  const url = new URL('https://api.open.fec.gov/v1/schedules/schedule_e/');
  url.searchParams.set('api_key', FEC_KEY);
  url.searchParams.set('candidate_office', 'S');
  url.searchParams.set('candidate_office_state', state);
  url.searchParams.set('cycle', String(CYCLE));
  url.searchParams.set('per_page', '100');
  url.searchParams.set('sort', '-expenditure_amount');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FEC ${res.status}`);
  const json = await res.json();
  return (json.results ?? []).map((r) => ({
    spender: r.committee?.name ?? r.committee_name ?? null,
    amount: r.expenditure_amount ?? null,
    date: r.expenditure_date ? String(r.expenditure_date).slice(0, 10) : null,
    purpose: r.expenditure_description ?? null,
    supportOppose: r.support_oppose_indicator ?? null,
    candidate: r.candidate_name ?? null,
    payee: r.payee_name ?? null,
  }));
}

async function metaAds(candidateName, state) {
  if (!META_TOKEN) return null;
  const url = new URL('https://graph.facebook.com/v21.0/ads_archive');
  url.searchParams.set('access_token', META_TOKEN);
  url.searchParams.set('ad_type', 'POLITICAL_AND_ISSUE_ADS');
  url.searchParams.set('ad_reached_countries', 'US');
  url.searchParams.set('search_terms', candidateName);
  url.searchParams.set('ad_delivery_date_min', `${CYCLE - 1}-01-01`);
  url.searchParams.set(
    'fields',
    'id,ad_creation_time,ad_delivery_start_time,ad_delivery_stop_time,ad_creative_bodies,page_name,spend,impressions,currency,ad_snapshot_url',
  );
  url.searchParams.set('limit', '50');
  const res = await fetch(url);
  if (!res.ok) {
    log('ads', `Meta ${res.status} for ${candidateName} (${state})`);
    return null;
  }
  const json = await res.json();
  return (json.data ?? []).map((a) => ({
    id: a.id,
    page: a.page_name,
    body: (a.ad_creative_bodies ?? [])[0] ?? null,
    // Meta publishes ranges, never exact spend. Keep them as ranges.
    spendLower: a.spend?.lower_bound ? Number(a.spend.lower_bound) : null,
    spendUpper: a.spend?.upper_bound ? Number(a.spend.upper_bound) : null,
    impressionsLower: a.impressions?.lower_bound ? Number(a.impressions.lower_bound) : null,
    impressionsUpper: a.impressions?.upper_bound ? Number(a.impressions.upper_bound) : null,
    start: a.ad_delivery_start_time ?? null,
    stop: a.ad_delivery_stop_time ?? null,
    url: a.ad_snapshot_url ?? null,
  }));
}

export async function run() {
  const races = JSON.parse(await readFile(join(OUT, 'races.json'), 'utf8'));
  const out = {};

  if (!META_TOKEN) {
    log('ads', 'META_AD_TOKEN not set — FEC independent expenditures only.');
  }

  for (const race of races.races) {
    const entry = { outsideSpending: [], platformAds: {}, totals: { outside: 0 } };
    try {
      entry.outsideSpending = await fecIndependentExpenditures(race.state);
      entry.totals.outside = entry.outsideSpending.reduce((a, e) => a + (e.amount ?? 0), 0);
    } catch (err) {
      log('ads', `${race.state} FEC IE failed: ${err.message}`);
    }

    for (const c of race.candidates) {
      const ads = await metaAds(c.name, race.state);
      if (ads?.length) entry.platformAds[c.id] = ads;
    }

    out[race.id] = entry;
    await new Promise((r) => setTimeout(r, 150));
  }

  await writeJSON('overlays/ads.json', {
    meta: {
      syncedAt: new Date().toISOString(),
      sources: [
        'FEC Schedule E (independent expenditures) — itemised and exact',
        META_TOKEN ? 'Meta Ad Library API — spend and impressions as BANDS' : 'Meta Ad Library — not synced (no token)',
        'Google Ads Transparency — no public API; linked from the UI',
        'FCC political file — per-station, not bulk-queryable; linked from the UI',
      ],
      caveat:
        'Platform figures are ranges by publisher policy, not estimates by us. Broadcast ' +
        'spend, still the largest share of Senate ad money, is not in any of these feeds.',
    },
    races: out,
  });

  const withData = Object.values(out).filter((e) => e.outsideSpending.length).length;
  log('ads', `${withData}/${races.races.length} races with itemised outside spending`);
  return { races: withData };
}

if (import.meta.url === `file://${process.argv[1]}`) await run();
