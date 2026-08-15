/**
 * The analytic layer.
 *
 * Everything here is DERIVED from certified results and published census
 * estimates — never asserted. That matters for two of the things this app
 * claims to show: which counties a campaign might flip, and which coalitions
 * it is building. Both are usually somebody's opinion pasted into a slide.
 * Here they are computed, the inputs are on screen, and the formula is in this
 * file where it can be argued with.
 *
 * Sign convention throughout: POSITIVE = Republican margin, negative =
 * Democratic. Two-party unless stated.
 */
import type { CountyCensus, CountyResult, PartyLetter, ResultsFile, StateTotals } from './types';

export const YEARS = [2016, 2020, 2024] as const;
export const Y16 = 0;
export const Y20 = 1;
export const Y24 = 2;

/** Two-party margin in percentage points, R-positive. */
export function margin(rep: number | null, dem: number | null): number | null {
  if (rep === null || dem === null) return null;
  const two = rep + dem;
  if (!two) return null;
  return (100 * (rep - dem)) / two;
}

export const countyMargin = (c: CountyResult, y: number) => margin(c.r[y], c.d[y]);
export const stateMargin = (s: StateTotals, y: number) => margin(s.r[y], s.d[y]);

/** Positive = county moved toward Republicans between the two cycles. */
export function swing(c: CountyResult, from = Y20, to = Y24): number | null {
  const a = countyMargin(c, from);
  const b = countyMargin(c, to);
  return a === null || b === null ? null : b - a;
}

// ── Baseline rating ────────────────────────────────────────────────────────

export interface Baseline {
  presLean: number;
  incumbencyAdj: number;
  expected: number;
  rating: string;
  favored: 'D' | 'R' | null;
  competitiveness: number;
  explain: string[];
}

/**
 * A transparent prior, not a forecast. It says what the seat looks like before
 * anyone campaigns: recent presidential lean, nudged by how much of an
 * incumbency advantage the seat's holder actually carries.
 *
 * 2024 is weighted more heavily than 2020 because it is the more recent read
 * on the same electorate. Incumbency is worth less to an appointee who has
 * never faced these voters, and nothing at all in an open seat.
 */
export function baselineRating(opts: {
  state: StateTotals | undefined;
  incumbentParty: PartyLetter | null;
  open: boolean;
  appointed: boolean;
}): Baseline | null {
  const { state, incumbentParty, open, appointed } = opts;
  if (!state) return null;
  const m24 = stateMargin(state, Y24);
  const m20 = stateMargin(state, Y20);
  if (m24 === null && m20 === null) return null;

  const presLean =
    m24 !== null && m20 !== null ? 0.65 * m24 + 0.35 * m20 : (m24 ?? m20 ?? 0);

  const explain: string[] = [];
  explain.push(
    `Presidential lean ${fmtMargin(presLean)} — 2024 (${fmtMargin(m24)}) weighted 65%, 2020 (${fmtMargin(m20)}) 35%.`,
  );

  let incumbencyAdj = 0;
  if (open) {
    explain.push('Open seat: no incumbency advantage applied.');
  } else if (incumbentParty === 'D' || incumbentParty === 'R') {
    const magnitude = appointed ? 1.5 : 3.5;
    incumbencyAdj = incumbentParty === 'R' ? magnitude : -magnitude;
    explain.push(
      appointed
        ? `Appointed incumbent: ${magnitude} pts toward ${incumbentParty} — an appointee has never faced this electorate.`
        : `Elected incumbent: ${magnitude} pts toward ${incumbentParty}.`,
    );
  }

  const expected = presLean + incumbencyAdj;
  const abs = Math.abs(expected);
  const rating =
    abs < 3
      ? 'Tossup'
      : `${abs < 8 ? 'Lean' : abs < 15 ? 'Likely' : 'Solid'} ${expected > 0 ? 'R' : 'D'}`;

  return {
    presLean,
    incumbencyAdj,
    expected,
    rating,
    favored: abs < 3 ? null : expected > 0 ? 'R' : 'D',
    competitiveness: Math.max(0, 1 - abs / 25),
    explain,
  };
}

export const fmtMargin = (m: number | null | undefined) =>
  m === null || m === undefined ? '—' : `${m > 0 ? 'R' : 'D'}+${Math.abs(m).toFixed(1)}`;

// ── Flip targets ───────────────────────────────────────────────────────────

export interface FlipTarget {
  fips: string;
  name: string;
  margin24: number;
  margin20: number | null;
  swing: number | null;
  votes24: number;
  shareOfState: number;
  persuadable: number;
  netMargin: number;
  turnoutChange: number | null;
  reason: string;
}

/**
 * Counties ranked by how much of the state's decision actually sits in them.
 *
 * Closeness alone is a trap: a 50/50 county of 4,000 voters cannot decide
 * anything. Size alone is worse — it just lists the biggest metros every time.
 * The score multiplies a county's share of the statewide vote by how
 * unresolved it is, giving "persuadable mass": the votes genuinely in play.
 */
export function flipTargets(
  results: ResultsFile,
  stateFips: string,
  limit = 12,
): FlipTarget[] {
  const counties = Object.entries(results.counties).filter(([, c]) => c.s === stateFips);
  const stateVotes = counties.reduce((a, [, c]) => a + (c.t[Y24] ?? 0), 0);
  if (!stateVotes) return [];

  const rows: FlipTarget[] = [];
  for (const [fips, c] of counties) {
    const m24 = countyMargin(c, Y24);
    const m20 = countyMargin(c, Y20);
    const votes = c.t[Y24] ?? 0;
    if (m24 === null || !votes) continue;
    const share = votes / stateVotes;
    // Closeness decays over 35 points: past that a county is not in play, it
    // is a turnout problem, which the coalition view handles instead.
    const closeness = Math.max(0, 1 - Math.abs(m24) / 35);
    const sw = m20 === null ? null : m24 - m20;
    const prevVotes = c.t[Y20] ?? 0;
    rows.push({
      fips,
      name: c.n,
      margin24: m24,
      margin20: m20,
      swing: sw,
      votes24: votes,
      shareOfState: share * 100,
      persuadable: share * closeness * 100,
      netMargin: ((c.r[Y24] ?? 0) - (c.d[Y24] ?? 0)),
      turnoutChange: prevVotes ? ((votes - prevVotes) / prevVotes) * 100 : null,
      reason: '',
    });
  }

  rows.sort((a, b) => b.persuadable - a.persuadable);
  for (const r of rows) r.reason = flipReason(r);
  return rows.slice(0, limit);
}

function flipReason(r: FlipTarget): string {
  const parts: string[] = [];
  if (Math.abs(r.margin24) < 5) parts.push('decided by under 5 points');
  else if (Math.abs(r.margin24) < 12) parts.push('single-digit-to-low-double-digit margin');
  if (r.shareOfState > 8) parts.push(`${r.shareOfState.toFixed(1)}% of the statewide vote`);
  if (r.swing !== null && Math.abs(r.swing) >= 4)
    parts.push(`swung ${Math.abs(r.swing).toFixed(1)} pts ${r.swing > 0 ? 'R' : 'D'} since 2020`);
  if (r.turnoutChange !== null && r.turnoutChange > 8)
    parts.push(`turnout up ${r.turnoutChange.toFixed(0)}%`);
  return parts.length ? parts.join('; ') : 'contributes weight without a decisive margin';
}

/** Counties that moved most between cycles, weighted so tiny counties do not dominate. */
export function biggestSwings(
  results: ResultsFile,
  stateFips: string,
  limit = 8,
): FlipTarget[] {
  const all = flipTargets(results, stateFips, Number.MAX_SAFE_INTEGER);
  return all
    .filter((r) => r.swing !== null && r.shareOfState > 0.4)
    .sort((a, b) => Math.abs(b.swing!) * b.shareOfState - Math.abs(a.swing!) * a.shareOfState)
    .slice(0, limit);
}

// ── Coalitions ─────────────────────────────────────────────────────────────

export interface Bloc {
  id: string;
  label: string;
  description: string;
  counties: number;
  votes: number;
  shareOfState: number;
  margin24: number | null;
  margin20: number | null;
  swing: number | null;
  netVotes: number;
  turnoutChange: number | null;
}

/**
 * Every county falls in exactly one PLACE bloc (a settlement-type taxonomy
 * built from density, education and growth) and any number of OVERLAY blocs
 * (demographic concentrations that cut across geography).
 *
 * The thresholds are conventional political-geography cuts, stated here rather
 * than hidden: an operative who disagrees can see the number and discount it.
 */
const PLACE_BLOCS: {
  id: string;
  label: string;
  description: string;
  test: (c: CountyCensus) => boolean;
}[] = [
  {
    id: 'urban-core',
    label: 'Urban core',
    description: 'Over 2,000 people per square mile',
    test: (c) => (c.density ?? 0) > 2000,
  },
  {
    id: 'dense-suburb',
    label: 'Educated suburb',
    description: '400-2,000 per sq mi, 32%+ with a bachelor’s degree',
    test: (c) => (c.density ?? 0) > 400 && (c.pctBAplus ?? 0) >= 32,
  },
  {
    id: 'working-suburb',
    label: 'Working suburb',
    description: '400-2,000 per sq mi, under 32% with a degree',
    test: (c) => (c.density ?? 0) > 400,
  },
  {
    id: 'exurb',
    label: 'Growing exurb',
    description: '90-400 per sq mi with net in-migration',
    test: (c) => (c.density ?? 0) > 90 && (c.netMigration ?? 0) > 1.5,
  },
  {
    id: 'small-city',
    label: 'Small city & town',
    description: '90-400 per sq mi, flat or declining population',
    test: (c) => (c.density ?? 0) > 90,
  },
  {
    id: 'rural-degree',
    label: 'Rural, higher-education',
    description: 'Under 90 per sq mi, 24%+ with a degree',
    test: (c) => (c.pctBAplus ?? 0) >= 24,
  },
  {
    id: 'rural',
    label: 'Rural, non-college',
    description: 'Under 90 per sq mi, under 24% with a degree',
    test: () => true,
  },
];

const OVERLAY_BLOCS: {
  id: string;
  label: string;
  description: string;
  test: (c: CountyCensus) => boolean;
}[] = [
  {
    id: 'majority-minority',
    label: 'Majority-minority',
    description: 'Under 50% non-Hispanic white',
    test: (c) => (c.pctWhiteNH ?? 100) < 50,
  },
  {
    id: 'black-plurality',
    label: 'Black population 30%+',
    description: '30% or more Black, non-Hispanic',
    test: (c) => (c.pctBlackNH ?? 0) >= 30,
  },
  {
    id: 'latino',
    label: 'Hispanic population 25%+',
    description: '25% or more Hispanic or Latino',
    test: (c) => (c.pctHispanic ?? 0) >= 25,
  },
  {
    id: 'retirees',
    label: 'Retiree-heavy',
    description: '21% or more aged 65+',
    test: (c) => (c.pct65plus ?? 0) >= 21,
  },
  {
    id: 'college-town',
    label: 'College town',
    description: '11%+ of residents enrolled in higher education',
    test: (c) => (c.pctInCollege ?? 0) >= 11,
  },
  {
    id: 'veterans',
    label: 'Veteran-heavy',
    description: '11%+ of adults are veterans',
    test: (c) => (c.pctVeteran ?? 0) >= 11,
  },
  {
    id: 'distressed',
    label: 'Economically distressed',
    description: 'Poverty 18%+ or unemployment 6%+',
    test: (c) => (c.pctPoverty ?? 0) >= 18 || (c.unemployment ?? 0) >= 6,
  },
];

export function classifyCounty(census: CountyCensus | undefined): string | null {
  if (!census) return null;
  return PLACE_BLOCS.find((b) => b.test(census))?.id ?? null;
}

function aggregate(
  ids: string[],
  results: ResultsFile,
  stateVotes: number,
  meta: { id: string; label: string; description: string },
): Bloc | null {
  let r24 = 0, d24 = 0, r20 = 0, d20 = 0, t24 = 0, t20 = 0;
  for (const fips of ids) {
    const c = results.counties[fips];
    if (!c) continue;
    r24 += c.r[Y24] ?? 0;
    d24 += c.d[Y24] ?? 0;
    r20 += c.r[Y20] ?? 0;
    d20 += c.d[Y20] ?? 0;
    t24 += c.t[Y24] ?? 0;
    t20 += c.t[Y20] ?? 0;
  }
  if (!t24) return null;
  const m24 = margin(r24, d24);
  const m20 = margin(r20, d20);
  return {
    ...meta,
    counties: ids.length,
    votes: t24,
    shareOfState: (t24 / stateVotes) * 100,
    margin24: m24,
    margin20: m20,
    swing: m24 !== null && m20 !== null ? m24 - m20 : null,
    netVotes: r24 - d24,
    turnoutChange: t20 ? ((t24 - t20) / t20) * 100 : null,
  };
}

export function coalitions(
  results: ResultsFile,
  census: Record<string, CountyCensus>,
  stateFips: string,
): { place: Bloc[]; overlay: Bloc[]; unclassified: number } {
  const fipsList = Object.keys(results.counties).filter(
    (f) => results.counties[f].s === stateFips,
  );
  const stateVotes = fipsList.reduce((a, f) => a + (results.counties[f].t[Y24] ?? 0), 0);
  if (!stateVotes) return { place: [], overlay: [], unclassified: 0 };

  const placeGroups = new Map<string, string[]>();
  const overlayGroups = new Map<string, string[]>();
  let unclassified = 0;

  for (const fips of fipsList) {
    const c = census[fips];
    if (!c) {
      unclassified++;
      continue;
    }
    const placeId = PLACE_BLOCS.find((b) => b.test(c))?.id;
    if (placeId) {
      if (!placeGroups.has(placeId)) placeGroups.set(placeId, []);
      placeGroups.get(placeId)!.push(fips);
    }
    for (const o of OVERLAY_BLOCS) {
      if (!o.test(c)) continue;
      if (!overlayGroups.has(o.id)) overlayGroups.set(o.id, []);
      overlayGroups.get(o.id)!.push(fips);
    }
  }

  const place = PLACE_BLOCS.map((b) =>
    aggregate(placeGroups.get(b.id) ?? [], results, stateVotes, b),
  )
    .filter((b): b is Bloc => b !== null)
    .sort((a, b) => b.shareOfState - a.shareOfState);

  const overlay = OVERLAY_BLOCS.map((b) =>
    aggregate(overlayGroups.get(b.id) ?? [], results, stateVotes, b),
  )
    .filter((b): b is Bloc => b !== null)
    .sort((a, b) => b.shareOfState - a.shareOfState);

  return { place, overlay, unclassified };
}

// ── Path to victory ────────────────────────────────────────────────────────

export interface PathStep {
  label: string;
  detail: string;
  netVotes: number;
}

/**
 * What the trailing party has to find, and where.
 *
 * Expressed in net votes rather than points, because that is the unit a field
 * program is actually budgeted in: doors, calls and mail buy people, not
 * percentages.
 */
export function pathToVictory(
  results: ResultsFile,
  census: Record<string, CountyCensus>,
  stateFips: string,
  trailing: 'D' | 'R',
): { deficit: number; totalVotes: number; steps: PathStep[] } {
  const state = results.states[stateFips];
  const totalVotes = state?.t[Y24] ?? 0;
  const net = (state?.r[Y24] ?? 0) - (state?.d[Y24] ?? 0);
  const deficit = trailing === 'D' ? net : -net;

  const targets = flipTargets(results, stateFips, 6);
  const { place } = coalitions(results, census, stateFips);

  const steps: PathStep[] = [];

  // 1. Narrow the margin in the genuinely contested counties.
  const contested = targets.filter((t) => Math.abs(t.margin24) < 20).slice(0, 4);
  for (const t of contested) {
    const gain = Math.round(t.votes24 * 0.02);
    steps.push({
      label: t.name,
      detail: `A 2-point margin shift in ${t.name} (${t.votes24.toLocaleString()} votes cast) nets ~${gain.toLocaleString()}.`,
      netVotes: gain,
    });
  }

  // 2. Turn out the blocs already voting your way.
  const friendly = place
    .filter((b) => (trailing === 'D' ? (b.margin24 ?? 0) < -8 : (b.margin24 ?? 0) > 8))
    .slice(0, 2);
  for (const b of friendly) {
    const gain = Math.round(b.votes * 0.03 * (Math.abs(b.margin24 ?? 0) / 100));
    steps.push({
      label: `${b.label} turnout`,
      detail: `3% more turnout across the ${b.label.toLowerCase()} bloc, at its current ${fmtMargin(b.margin24)} margin, nets ~${gain.toLocaleString()}.`,
      netVotes: gain,
    });
  }

  return { deficit, totalVotes, steps };
}

// ── Chamber math ───────────────────────────────────────────────────────────

export interface ChamberMath {
  holdoverD: number;
  holdoverR: number;
  holdoverI: number;
  contested: number;
  projectedD: number;
  projectedR: number;
  tossups: number;
  majorityAt: number;
}

/**
 * Seats not on the ballot are a fixed floor both sides start from. The Senate
 * has 100 seats; 35 are up, so 65 are held over. Independents are counted
 * separately rather than folded into whoever they caucus with, because a
 * caucus decision is a choice, not a datum.
 */
export function chamberMath(
  ratings: { favored: 'D' | 'R' | null }[],
  holdover: { D: number; R: number; I: number },
): ChamberMath {
  const projectedD = holdover.D + ratings.filter((r) => r.favored === 'D').length;
  const projectedR = holdover.R + ratings.filter((r) => r.favored === 'R').length;
  return {
    holdoverD: holdover.D,
    holdoverR: holdover.R,
    holdoverI: holdover.I,
    contested: ratings.length,
    projectedD,
    projectedR,
    tossups: ratings.filter((r) => r.favored === null).length,
    majorityAt: 51,
  };
}
