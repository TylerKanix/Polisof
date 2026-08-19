/**
 * Integrity checks on the built datasets.
 *
 *   npm run audit
 *
 * Two kinds of check. Internal consistency — no town casts more votes than it
 * has ballots, margins sum to the district, every race is present everywhere —
 * catches a pipeline that has drifted. And a regression pin on the three
 * certified House results, which is the check that actually matters: this
 * project once displayed Leonard Lance beating Tom Malinowski in 2018, which
 * is the opposite of what happened, and no internal-consistency check would
 * ever have noticed. Numbers that can be verified against the outside world
 * are written down here so they cannot quietly change.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { OUT, log } from './lib/util.mjs';

/**
 * Certified NJ-07 results, from the official canvass. If the build stops
 * reproducing these, the build is wrong — not this table.
 */
const CERTIFIED = {
  g2016: { winner: 'Leonard Lance', R: 185850, D: 148188, margin: 11.27 },
  g2018: { winner: 'Tom Malinowski', R: 150785, D: 166985, margin: -5.1 },
  g2024: { winner: 'Thomas H. Kean, Jr.', R: 223320, D: 200016, margin: 5.5 },
};

const failures = [];
/**
 * Notes are aggregated rather than listed per town. One candidate filed under
 * a slogan in one county and a party in another produces the same finding in
 * all 94 towns, and 94 identical lines is not a report — it is a wall that
 * hides the one line that matters.
 */
const noteCounts = new Map();
const note = (message) => noteCounts.set(message, (noteCounts.get(message) ?? 0) + 1);
const check = (ok, message) => {
  if (!ok) failures.push(message);
};

const twoParty = (cands) => {
  const of = (p) => cands.filter((c) => c.party === p).reduce((a, c) => a + c.votes, 0);
  const d = of('D');
  const r = of('R');
  return { d, r, margin: d + r === 0 ? 0 : ((r - d) / (r + d)) * 100 };
};

export async function run() {
  const district = JSON.parse(await readFile(join(OUT, 'district.json'), 'utf8'));
  const { municipalities, meta } = district;

  // ---- The certified pin ---------------------------------------------------
  for (const [id, want] of Object.entries(CERTIFIED)) {
    const got = district.certifiedHouse?.[id];
    if (!got) {
      failures.push(`${id}: no certified House result emitted`);
      continue;
    }
    const tp = twoParty(got.cands);
    check(
      got.cands[0]?.name === want.winner,
      `${id}: winner is "${got.cands[0]?.name}", certified winner is "${want.winner}"`,
    );
    check(tp.r === want.R, `${id}: R vote ${tp.r}, certified ${want.R}`);
    check(tp.d === want.D, `${id}: D vote ${tp.d}, certified ${want.D}`);
    check(
      Math.abs(tp.margin - want.margin) < 0.05,
      `${id}: margin ${tp.margin.toFixed(2)}, certified ${want.margin}`,
    );
  }

  // ---- Internal consistency ------------------------------------------------
  const expected = [
    'g2024/president',
    'g2024/ussenate',
    'g2024/ushouse',
    'g2016/president',
    'g2013/governor',
    'g2017/governor',
  ];
  for (const m of municipalities) {
    for (const key of expected) {
      check(Boolean(m.results[key]), `${m.name}: missing ${key}`);
    }

    const t = m.turnout.g2024;
    if (t?.registered && t?.ballots) {
      const rate = (t.ballots / t.registered) * 100;
      check(
        rate > 20 && rate <= 100,
        `${m.name}: 2024 turnout ${rate.toFixed(1)}% is outside a believable range`,
      );
      // Two towns report more votes than ballots. That is a discrepancy in
      // the certification, carried and published as `sourceAnomalies`; what
      // would be a bug is a *large* one, which would mean rows landing in the
      // wrong town.
      for (const [key, res] of Object.entries(m.results)) {
        if (!key.startsWith('g2024') || res.total <= t.ballots) continue;
        const excess = res.total - t.ballots;
        const message = `${m.name}: ${key} has ${res.total} votes against ${t.ballots} ballots (+${excess})`;
        if (excess > 100 || excess / t.ballots > 0.05) failures.push(message);
        else note(`${message} — carried as a source anomaly`);
      }
    }

    for (const [key, res] of Object.entries(m.results)) {
      const tp = twoParty(res.cands);
      const other = res.total - tp.d - tp.r;
      check(other >= 0, `${m.name}: ${key} two-party vote exceeds the total`);
      const share = res.total ? other / res.total : 0;
      if (share > 0.12) {
        note(`${key}: over 12% outside the two major parties`);
      }
      // A disagreement about a major party moves a margin, so it fails. A
      // disagreement about which slogan counts as which minor party does not,
      // so it is reported and left to a human.
      for (const c of res.cands) {
        if (!c.partyConflict) continue;
        const major = c.partyConflict.some((p) => p === 'D' || p === 'R');
        const message = `${m.name}: ${key} — ${c.name} is filed under ${c.partyConflict.join(' and ')}`;
        if (major) failures.push(message);
        else note(`${key} — ${c.name} is filed under ${c.partyConflict.join(' and ')}`);
      }
    }
  }

  // ---- Town margins must sum to the district's -----------------------------
  for (const key of ['g2024/ushouse', 'g2024/president']) {
    const total = district.district[key];
    if (!total) continue;
    let net = 0;
    for (const m of municipalities) {
      const res = m.results[key];
      if (!res) continue;
      if (key.endsWith('/ushouse') && res.cd !== meta.district) continue;
      const tp = twoParty(res.cands);
      net += (tp.r - tp.d) * (key.endsWith('/ushouse') ? 1 : m.districtShare);
    }
    const districtNet = twoParty(total.cands).r - twoParty(total.cands).d;
    check(
      Math.abs(net - districtNet) < 2,
      `${key}: towns sum to a net of ${Math.round(net)}, district total says ${districtNet}`,
    );
  }

  // ---- No town may be missing from the map --------------------------------
  const geo = JSON.parse(await readFile(join(OUT, 'geo', 'munis.json'), 'utf8'));
  const drawn = new Set(geo.objects.munis.geometries.map((g) => String(g.id)));
  for (const m of municipalities) {
    check(drawn.has(m.geoid), `${m.name}: has results but no polygon on the map`);
  }
  check(
    drawn.size === municipalities.length,
    `map draws ${drawn.size} polygons for ${municipalities.length} municipalities`,
  );

  // ---- Report --------------------------------------------------------------
  for (const [n, count] of [...noteCounts].sort((a, b) => b[1] - a[1])) {
    log('audit', `note  ${n}${count > 1 ? `  (${count} towns)` : ''}`);
  }
  if (failures.length) {
    for (const f of failures) log('audit', `FAIL  ${f}`);
    throw new Error(`${failures.length} integrity check(s) failed`);
  }
  log(
    'audit',
    `ok — ${municipalities.length} municipalities, ${Object.keys(CERTIFIED).length} certified ` +
      'results reproduced, town margins reconcile to the district',
  );
  return { municipalities: municipalities.length, notes: noteCounts.size };
}

if (import.meta.url === `file://${process.argv[1]}`) await run();
