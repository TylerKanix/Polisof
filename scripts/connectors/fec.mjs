/**
 * FEC connector — campaign finance.
 *
 * Fills `candidate.finance` in races.json: cash on hand, receipts,
 * disbursements and debts, with the filing period they cover.
 *
 *   FEC_API_KEY=your-key npm run sync:fec
 *
 * Get a key free at https://api.data.gov/signup/ (instant). Without one this
 * falls back to DEMO_KEY, which is rate-limited to roughly 30 requests/hour —
 * enough to try it, not enough to sync the whole map.
 *
 * Matching: candidates are looked up by name, scoped to state + Senate +
 * cycle 2026. A candidate whose name matches more than one active filer is
 * left NULL rather than guessed — the wrong committee's cash on hand is worse
 * than a blank, because a blank is visibly a blank.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { OUT, writeJSON, log } from '../lib/util.mjs';

const API = 'https://api.open.fec.gov/v1';
const KEY = process.env.FEC_API_KEY || 'DEMO_KEY';
const CYCLE = 2026;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path, params = {}) {
  const url = new URL(`${API}${path}`);
  url.searchParams.set('api_key', KEY);
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(k, x));
    else if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url);
  if (res.status === 429) throw new Error('FEC rate limit reached — set FEC_API_KEY for a real key');
  if (!res.ok) throw new Error(`FEC ${res.status} for ${path}`);
  return res.json();
}

const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z ]/g, '')
    .trim();

/** FEC stores names as "LAST, FIRST MIDDLE". Compare on the name parts. */
function nameMatches(fecName, ourName) {
  const a = new Set(norm(fecName.replace(',', ' ')).split(/\s+/).filter(Boolean));
  const parts = norm(ourName).split(/\s+/).filter(Boolean);
  const last = parts[parts.length - 1];
  const first = parts[0];
  return a.has(last) && a.has(first);
}

async function financeFor(candidate, race) {
  // A resolved congressional record often already carries the FEC ID.
  let candidateId = candidate.record?.fecIds?.[0] ?? null;

  if (!candidateId) {
    const search = await api('/candidates/search/', {
      q: candidate.name,
      office: 'S',
      state: race.state,
      cycle: CYCLE,
      per_page: 20,
    });
    const hits = (search.results ?? []).filter((r) => nameMatches(r.name, candidate.name));
    if (hits.length === 0) return { status: 'no-filer' };
    if (hits.length > 1) {
      // Prefer one still marked as an active candidate for this cycle.
      const active = hits.filter((h) => (h.election_years ?? []).includes(CYCLE));
      if (active.length !== 1) return { status: 'ambiguous', matches: hits.map((h) => h.candidate_id) };
      candidateId = active[0].candidate_id;
    } else candidateId = hits[0].candidate_id;
  }

  const totals = await api(`/candidate/${candidateId}/totals/`, { cycle: CYCLE, per_page: 1 });
  const t = (totals.results ?? [])[0];
  if (!t) return { status: 'no-totals', candidateId };

  return {
    status: 'ok',
    finance: {
      cashOnHand: t.last_cash_on_hand_end_period ?? null,
      raised: t.receipts ?? null,
      spent: t.disbursements ?? null,
      debts: t.last_debts_owed_by_committee ?? null,
      coverageEnd: t.coverage_end_date ? String(t.coverage_end_date).slice(0, 10) : null,
      fecCandidateId: candidateId,
      source: 'FEC /candidate/{id}/totals',
      asOf: new Date().toISOString().slice(0, 10),
    },
  };
}

export async function run() {
  const path = join(OUT, 'races.json');
  const file = JSON.parse(await readFile(path, 'utf8'));

  if (KEY === 'DEMO_KEY') {
    log('fec', 'WARNING using DEMO_KEY (~30 req/hr). Set FEC_API_KEY for a full sync.');
  }

  let filled = 0;
  let skipped = 0;
  const problems = [];

  for (const race of file.races) {
    for (const c of race.candidates) {
      try {
        const result = await financeFor(c, race);
        if (result.status === 'ok') {
          c.finance = result.finance;
          filled++;
        } else {
          c.finance = null;
          skipped++;
          problems.push(`${race.state} ${c.name}: ${result.status}`);
        }
      } catch (err) {
        c.finance = null;
        skipped++;
        problems.push(`${race.state} ${c.name}: ${err.message}`);
        if (String(err.message).includes('rate limit')) {
          log('fec', 'stopping early — rate limited');
          await writeBack(file, filled, skipped, problems);
          return { filled, skipped, rateLimited: true };
        }
      }
      // Courtesy pacing; the API is generous but not free.
      await sleep(120);
    }
  }

  await writeBack(file, filled, skipped, problems);
  log('fec', `${filled} candidates funded, ${skipped} left null`);
  if (problems.length) log('fec', `unresolved:\n  ${problems.slice(0, 20).join('\n  ')}`);
  return { filled, skipped };
}

async function writeBack(file, filled, skipped, problems) {
  file.meta.finance = {
    syncedAt: new Date().toISOString(),
    source: 'Federal Election Commission API',
    cycle: CYCLE,
    filled,
    unresolved: skipped,
    notes: problems.slice(0, 40),
    disclaimer:
      'Cash on hand is as of the committee\'s last filing, not today. Candidates who ' +
      'have not filed, or whose name matched more than one active filer, are left null.',
  };
  await writeJSON('races.json', file, { pretty: true });
}

if (import.meta.url === `file://${process.argv[1]}`) await run();
