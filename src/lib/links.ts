/**
 * Deep links to the primary sources.
 *
 * Ad buys, filings, appearance calendars and prediction-market prices cannot be
 * bundled offline: they are live, and several are licensed. What CAN be shipped
 * is the doorway — a pre-filtered link straight into the authoritative source,
 * built from identifiers already on the candidate record. A link that lands on
 * the right query is worth more than a stale copy of the answer.
 */
import type { Candidate, Race } from './types';

const enc = encodeURIComponent;

/** FEC candidate page when the committee ID is known, else a scoped search. */
export function fecLink(c: Candidate, race: Race): string {
  const id = c.record?.fecIds?.[0] ?? c.finance?.fecCandidateId;
  if (id) return `https://www.fec.gov/data/candidate/${id}/?cycle=2026`;
  return `https://www.fec.gov/data/candidates/?q=${enc(c.name)}&state=${race.state}&office=S&cycle=2026&election_full=true`;
}

/** Independent expenditures for or against a candidate — the outside money. */
export function fecIndependentLink(race: Race): string {
  return `https://www.fec.gov/data/independent-expenditures/?data_type=processed&candidate_office=S&candidate_office_state=${race.state}&cycle=2026`;
}

/** Meta's ad library, filtered to political ads in the state. */
export function metaAdLink(c: Candidate, race: Race): string {
  return `https://www.facebook.com/ads/library/?active_status=all&ad_type=political_and_issue_ads&country=US&q=${enc(
    c.name,
  )}&search_type=keyword_unordered&media_type=all&regions[0]=${race.state}`;
}

/** Google's political ads transparency report. */
export function googleAdLink(c: Candidate): string {
  return `https://adstransparency.google.com/?region=US&political=true&query=${enc(c.name)}`;
}

/**
 * The FCC political file — every broadcast station's legally required record of
 * who bought time, for how much. The single best source for TV buys, and the
 * one most people forget exists.
 */
export function fccPoliticalFileLink(race: Race): string {
  return `https://publicfiles.fcc.gov/search/?q=${enc(race.stateName)}%20political%20file`;
}

/** Kalshi's election markets. */
export function kalshiLink(race: Race): string {
  return `https://kalshi.com/markets?query=${enc(`${race.stateName} Senate`)}`;
}

/** FiveThirtyEight-style poll aggregation is gone; go to the primary source. */
export function pollingLink(race: Race): string {
  return `https://projects.fivethirtyeight.com/polls/senate/2026/${enc(
    race.stateName.toLowerCase().replace(/ /g, '-'),
  )}/`;
}

export function ballotpediaLink(c: Candidate): string {
  return `https://ballotpedia.org/${enc(c.name.replace(/ /g, '_'))}`;
}

/** State-level campaign finance and election calendars vary; start at the SOS. */
export function stateElectionLink(race: Race): string {
  return `https://www.usa.gov/state-election-office?state=${enc(race.stateName)}`;
}

export function censusCountyLink(fips: string): string {
  return `https://data.census.gov/profile/?g=050XX00US${fips}`;
}
