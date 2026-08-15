/**
 * Kalshi connector — regulated prediction-market prices for each seat.
 *
 *   npm run sync:kalshi
 *
 * Kalshi's market data endpoints are public and need no key; only trading
 * does. Prices are in cents and read directly as an implied probability, which
 * is why they sit beside the computed baseline rather than inside it: one is a
 * market, the other is arithmetic on past results, and blending them would
 * hide which is which.
 *
 * Emits overlays/markets.json. The dossier renders it when present and shows
 * the connector prompt when not.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { OUT, writeJSON, log } from '../lib/util.mjs';

const API = 'https://api.elections.kalshi.com/trade-api/v2';

async function api(path, params = {}) {
  const url = new URL(`${API}${path}`);
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, String(v));
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Kalshi ${res.status} for ${path}`);
  return res.json();
}

/** Walk the cursor until the event list is exhausted. */
async function allEvents(seriesTicker) {
  const out = [];
  let cursor;
  do {
    const page = await api('/events', {
      series_ticker: seriesTicker,
      status: 'open',
      limit: 200,
      cursor,
    });
    out.push(...(page.events ?? []));
    cursor = page.cursor || undefined;
  } while (cursor);
  return out;
}

export async function run() {
  const races = JSON.parse(await readFile(join(OUT, 'races.json'), 'utf8'));
  const byState = new Map(races.races.map((r) => [r.state, r]));

  // Kalshi groups Senate control and individual seats under separate series.
  // Ticker conventions change between cycles, so several candidates are tried
  // and whichever resolves is used, rather than hard-coding one guess.
  const CANDIDATE_SERIES = ['KXSENATE', 'SENATE', 'KXSENATERACE', 'CONTROL'];

  const events = [];
  for (const series of CANDIDATE_SERIES) {
    try {
      const found = await allEvents(series);
      if (found.length) {
        log('kalshi', `series ${series}: ${found.length} open events`);
        events.push(...found);
      }
    } catch (err) {
      log('kalshi', `series ${series} unavailable (${err.message})`);
    }
  }

  if (!events.length) {
    log('kalshi', 'no open Senate events found — check series tickers at kalshi.com');
  }

  const markets = {};
  for (const ev of events) {
    // Match an event to a state by its two-letter code appearing in the ticker
    // or the title, e.g. KXSENATE-26-GA or "Georgia Senate".
    const state = [...byState.keys()].find(
      (abbr) =>
        new RegExp(`(^|[^A-Z])${abbr}([^A-Z]|$)`).test(ev.event_ticker ?? '') ||
        (ev.title ?? '').includes(byState.get(abbr).stateName),
    );
    if (!state) continue;

    let detail;
    try {
      detail = await api('/markets', { event_ticker: ev.event_ticker, limit: 100 });
    } catch {
      continue;
    }

    markets[state] = {
      eventTicker: ev.event_ticker,
      title: ev.title,
      url: `https://kalshi.com/markets/${(ev.series_ticker ?? '').toLowerCase()}`,
      markets: (detail.markets ?? []).map((m) => ({
        ticker: m.ticker,
        subtitle: m.yes_sub_title ?? m.subtitle ?? null,
        // Cents map 1:1 onto an implied probability.
        lastPrice: m.last_price ?? null,
        yesBid: m.yes_bid ?? null,
        yesAsk: m.yes_ask ?? null,
        volume: m.volume ?? null,
        openInterest: m.open_interest ?? null,
        closeTime: m.close_time ?? null,
      })),
    };
  }

  await writeJSON('overlays/markets.json', {
    meta: {
      source: 'Kalshi trade-api v2 (public market data)',
      syncedAt: new Date().toISOString(),
      note:
        'Prices in cents equal implied probability. Shown alongside the computed ' +
        'baseline, never blended into it — a market and an arithmetic prior are ' +
        'different claims.',
      states: Object.keys(markets).length,
    },
    markets,
  });

  log('kalshi', `${Object.keys(markets).length} states with live markets`);
  return { states: Object.keys(markets).length };
}

if (import.meta.url === `file://${process.argv[1]}`) await run();
