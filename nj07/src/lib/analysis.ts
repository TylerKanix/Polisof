/**
 * Derived measures.
 *
 * Everything here is computed in the open from certified totals — nothing is
 * modelled, weighted or forecast. Where a figure is an estimate rather than a
 * count (a split municipality prorated into a district total), it says so and
 * the UI marks it.
 *
 * Sign convention throughout: **positive is Republican**, matching the colour
 * ramp. A margin of −8 is D+8.
 */
import type { DistrictFile, Municipality, RaceResult, PartyLetter } from './types';

export const HOUSE_24 = 'g2024/ushouse';
export const PRES_24 = 'g2024/president';
export const SEN_24 = 'g2024/ussenate';
export const PRES_16 = 'g2016/president';
export const HOUSE_16 = 'g2016/ushouse';
export const HOUSE_18 = 'g2018/ushouse';
export const SEN_18 = 'g2018/ussenate';

export interface TwoParty {
  d: number;
  r: number;
  /** (R − D) as a share of the two-party vote, in points. Positive = R. */
  margin: number;
  /** R − D in votes. */
  net: number;
  total: number;
}

/** Two-party summary of a race. Null when the race is absent for that town. */
export function twoParty(result: RaceResult | undefined | null): TwoParty | null {
  if (!result) return null;
  const of = (p: PartyLetter) =>
    result.cands.filter((c) => c.party === p).reduce((a, c) => a + c.votes, 0);
  const d = of('D');
  const r = of('R');
  if (d + r === 0) return null;
  return { d, r, margin: ((r - d) / (r + d)) * 100, net: r - d, total: result.total };
}

export const marginOf = (m: Municipality, key: string) => twoParty(m.results[key])?.margin ?? null;

/**
 * Movement between two elections, in points. Positive means the town moved
 * toward the Republicans.
 */
export function swing(m: Municipality, from: string, to: string): number | null {
  const a = marginOf(m, from);
  const b = marginOf(m, to);
  return a === null || b === null ? null : b - a;
}

/**
 * How far a candidate ran ahead of the top of their own ticket in the same
 * town, in points. Positive means the down-ballot Republican beat Trump's
 * margin there — the split-ticket measure this district turns on.
 */
export function overperformance(m: Municipality, race: string, against: string): number | null {
  const a = marginOf(m, race);
  const b = marginOf(m, against);
  return a === null || b === null ? null : a - b;
}

export function turnoutRate(m: Municipality, election = 'g2024'): number | null {
  const t = m.turnout[election];
  if (!t || !t.registered || !t.ballots) return null;
  return (t.ballots / t.registered) * 100;
}

/** The House district a town voted in for a given election. */
export const districtIn = (m: Municipality, key: string) => m.results[key]?.cd ?? null;

/**
 * A town's contribution to the district's net margin, in votes. These sum to
 * the district's net, which is what makes "where the race is decided" a
 * statement about arithmetic rather than about vibes.
 */
export function netContribution(m: Municipality, key: string): number | null {
  const tp = twoParty(m.results[key]);
  if (!tp) return null;
  // A split town's presidential vote is not all district vote; scale it the
  // way the district totals do, and only for races that are not district-only.
  const scale = key.endsWith('/ushouse') ? 1 : m.districtShare;
  return tp.net * scale;
}

export interface DistrictSummary {
  key: string;
  d: number;
  r: number;
  margin: number;
  net: number;
  total: number;
  leader: { name: string; party: PartyLetter | null; votes: number } | null;
  runnerUp: { name: string; party: PartyLetter | null; votes: number } | null;
  prorated: boolean;
  municipalities: number;
}

export function districtSummary(file: DistrictFile, key: string): DistrictSummary | null {
  const t = file.district[key];
  if (!t) return null;
  const of = (p: PartyLetter) =>
    t.cands.filter((c) => c.party === p).reduce((a, c) => a + c.votes, 0);
  const d = of('D');
  const r = of('R');
  const [leader, runnerUp] = t.cands;
  return {
    key,
    d,
    r,
    margin: d + r === 0 ? 0 : ((r - d) / (r + d)) * 100,
    net: r - d,
    total: t.total,
    leader: leader ?? null,
    runnerUp: runnerUp ?? null,
    prorated: t.prorated,
    municipalities: t.municipalities,
  };
}

/**
 * Towns ranked by how much of the district's margin they supply.
 *
 * This answers a different question from "which town is reddest": a 40-point
 * town of four thousand people moves fewer votes than a 6-point town of thirty
 * thousand, and a campaign spends against the second one.
 */
export function decisive(municipalities: Municipality[], key: string) {
  return municipalities
    .map((m) => ({ muni: m, net: netContribution(m, key) ?? 0, tp: twoParty(m.results[key]) }))
    .filter((x) => x.tp)
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
}

/**
 * What closing the gap would take.
 *
 * Not a forecast — an identity. Given the certified 2024 result, this is the
 * number of net votes the losing side was short, and the swing that would have
 * been needed across the towns that actually cast ballots.
 */
export function pathToVictory(file: DistrictFile, electionId = 'g2024') {
  const s = certifiedHouse(file, electionId);
  if (!s) return null;
  const twoPartyTotal = s.d + s.r;
  const netShort = Math.abs(s.net);
  return {
    trailing: s.net > 0 ? ('D' as const) : ('R' as const),
    netShort,
    /** Points of uniform swing that would have tied it. */
    swingNeeded: (netShort / twoPartyTotal) * 100,
    /** Voters who would have had to switch, which is half the net. */
    switchers: Math.ceil(netShort / 2),
    twoPartyTotal,
  };
}

/** Towns whose lines changed: they are in NJ-07 now but voted elsewhere in 2018. */
export function territoryChange(municipalities: Municipality[]) {
  const groups = new Map<string, Municipality[]>();
  for (const m of municipalities) {
    const cd = districtIn(m, HOUSE_18);
    const key = cd === null ? 'unknown' : String(cd);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }
  const added = municipalities.filter((m) => {
    const cd = districtIn(m, HOUSE_18);
    return cd !== null && cd !== 7;
  });
  return { groups, added };
}

/** District-wide 2024 turnout, summed over the towns that reported both figures. */
export function districtTurnout(municipalities: Municipality[], election = 'g2024') {
  let registered = 0;
  let ballots = 0;
  let towns = 0;
  for (const m of municipalities) {
    const t = m.turnout[election];
    if (!t?.registered || !t?.ballots) continue;
    registered += t.registered;
    ballots += t.ballots;
    towns++;
  }
  return towns
    ? { registered, ballots, rate: (ballots / registered) * 100, towns }
    : null;
}

/** Rank of one town within a list, by a metric. 1 is highest. */
export function rankOf(
  municipalities: Municipality[],
  target: Municipality,
  value: (m: Municipality) => number | null,
) {
  const scored = municipalities
    .map((m) => ({ m, v: value(m) }))
    .filter((x): x is { m: Municipality; v: number } => x.v !== null)
    .sort((a, b) => b.v - a.v);
  const i = scored.findIndex((x) => x.m.geoid === target.geoid);
  return i < 0 ? null : { rank: i + 1, of: scored.length };
}

/**
 * The district's own House race, as certified.
 *
 * Distinct from `districtSummary`, and the distinction matters: that one
 * answers "how did today's 94 towns vote", which for a statewide race is the
 * standard way to state a district's lean. For a House race it is not a
 * question with an answer — 29 of today's towns voted in another district's
 * election — and reporting it as though it were is how a panel ends up saying
 * Lance beat Malinowski in 2018, which is the opposite of what happened.
 */
export function certifiedHouse(file: DistrictFile, electionId: string) {
  const r = file.certifiedHouse?.[electionId];
  if (!r) return null;
  const of = (p: PartyLetter) =>
    r.cands.filter((c) => c.party === p).reduce((a, c) => a + c.votes, 0);
  const d = of('D');
  const r_ = of('R');
  return {
    ...r,
    d,
    r: r_,
    margin: d + r_ === 0 ? 0 : ((r_ - d) / (r_ + d)) * 100,
    net: r_ - d,
    winner: r.cands[0] ?? null,
    runnerUp: r.cands[1] ?? null,
    /** True when the district's lines have changed since. */
    linesChanged: r.townsStillInDistrict < r.towns,
  };
}
