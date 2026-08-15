/** Candidate-level derivations shared by the hover card and the dossier. */
import { ageFrom, year } from './format';
import type { Candidate, Race } from './types';

/** Exact age where a birthday is on record; otherwise a stated birth year. */
export function candidateAge(c: Candidate): { age: number | null; exact: boolean } {
  const exact = ageFrom(c.record?.birthday);
  if (exact !== null) return { age: exact, exact: true };
  if (c.birthYear) return { age: new Date().getUTCFullYear() - c.birthYear, exact: false };
  return { age: null, exact: false };
}

/**
 * What this person did before now.
 *
 * For anyone with a congressional record this is read off their term history,
 * so it cannot drift. For everyone else it is the hand-authored office or
 * occupation, which is the only part a dataset cannot supply.
 */
export function describeOffice(c: Candidate): { primary: string; secondary: string | null } {
  const rec = c.record;
  if (rec && rec.history.length) {
    const current = rec.history[rec.history.length - 1];
    const seat = current.label === 'US Representative' ? `${current.seat}` : current.seat;
    const label = `${current.label}${current.label === 'US Representative' ? `, ${seat}` : ''}`;
    const span = `${year(current.start)}–${current.end < new Date().toISOString() ? year(current.end) : 'present'}`;

    // The stint before the current one is the "previously held" line.
    const prior = rec.history.length > 1 ? rec.history[rec.history.length - 2] : null;
    const priorLabel = prior
      ? `Previously ${prior.label}${prior.label === 'US Representative' ? `, ${prior.seat}` : `, ${prior.seat}`} (${year(prior.start)}–${year(prior.end)})`
      : c.office ?? c.occupation;

    return { primary: `${label} · ${span}`, secondary: priorLabel ?? null };
  }
  if (c.office) return { primary: c.office, secondary: c.occupation };
  if (c.occupation) return { primary: c.occupation, secondary: null };
  return { primary: 'No prior public office on record', secondary: null };
}

/**
 * The two or three candidates a glance should show: one per party, strongest
 * first. An independent with a real base (Nebraska) is not dropped to fit a
 * two-column layout.
 */
export function headToHead(race: Race, limit = 3): Candidate[] {
  const byParty = new Map<string, Candidate>();
  const rank = (c: Candidate) =>
    (c.status === 'incumbent' ? 0 : c.status === 'declared' ? 1 : 2) * 100 + c.seatOrder;
  for (const c of race.candidates) {
    const cur = byParty.get(c.party);
    if (!cur || rank(c) < rank(cur)) byParty.set(c.party, c);
  }
  const order = ['D', 'R', 'I', 'L', 'G'];
  const picked = order
    .map((p) => byParty.get(p))
    .filter((c): c is Candidate => Boolean(c));
  // Lead with the seat holder's party so the incumbent is always on the left.
  const holder = race.seatHolder.party;
  picked.sort((a, b) => (a.party === holder ? -1 : b.party === holder ? 1 : 0));
  return picked.slice(0, limit);
}

/** Everyone not shown in the head-to-head, for the "rest of the field" line. */
export function restOfField(race: Race, shown: Candidate[]): Candidate[] {
  const ids = new Set(shown.map((c) => c.id));
  return race.candidates.filter((c) => !ids.has(c.id));
}

export function raceLabel(race: Race): string {
  if (race.special) return `${race.stateName} · Special`;
  return race.stateName;
}

export function seatContext(race: Race): string {
  if (race.open) return race.openReason ?? 'Open seat.';
  if (race.special) return race.specialReason ?? 'Special election.';
  if (race.seatHolder.appointed)
    return `${race.seatHolder.name} was appointed to this seat and faces voters for the first time.`;
  return `${race.seatHolder.name} is seeking re-election.`;
}
