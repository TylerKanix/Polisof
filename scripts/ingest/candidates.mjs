/**
 * Resolve the hand-authored roster against the primary congressional record.
 *
 * Source: unitedstates/congress-legislators (public domain / CC0) — the
 * canonical dataset behind GovTrack and ProPublica.
 *
 * Why this exists: a candidate's age, party and office history are facts with
 * an authoritative record, so they are looked up rather than typed. A wrong
 * Bioguide ID fails silently — it renders a different person's face — so IDs
 * are never hand-entered; they are matched from name + state + chamber, and
 * anything that fails to resolve is reported loudly instead of guessed.
 *
 * Emits races.json — the dossier spine the whole app reads.
 */
import { parse } from 'yaml';
import { fetchCached, writeJSON, log } from '../lib/util.mjs';
import { RACES, FORMER_MEMBERS, VERIFIED_THROUGH, ELECTION_DAY } from '../lib/roster.mjs';
import { ABBR_TO_FIPS, STATES } from '../lib/states.mjs';

const BASE = 'https://raw.githubusercontent.com/unitedstates/congress-legislators/main';
const TYPE_LABEL = { sen: 'US Senator', rep: 'US Representative' };
const PARTY_CODE = { Democrat: 'D', Republican: 'R', Independent: 'I' };

const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents: "Luján" -> "Lujan"
    .toLowerCase()
    .replace(/[^a-z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

function officeHistory(terms) {
  const out = [];
  for (const t of terms) {
    const label = TYPE_LABEL[t.type] ?? t.type;
    const seat = t.type === 'rep' ? `${t.state}-${String(t.district).padStart(2, '0')}` : t.state;
    const last = out[out.length - 1];
    // Consecutive terms in one seat read as a single stint, not eight rows.
    if (last && last.label === label && last.seat === seat) {
      last.end = t.end;
      last.terms++;
    } else out.push({ label, seat, start: t.start, end: t.end, terms: 1 });
  }
  return out;
}

/** Every name a record might reasonably be matched by. */
function nameKeys(p) {
  const n = p.name ?? {};
  const keys = new Set();
  const lasts = [n.last, ...(n.official_full ? [] : [])].filter(Boolean);
  const firsts = [n.first, n.nickname, n.middle].filter(Boolean);
  if (n.official_full) keys.add(norm(n.official_full));
  for (const f of firsts) for (const l of lasts) keys.add(norm(`${f} ${l}`));
  return keys;
}

function slim(p, { incumbent }) {
  const terms = p.terms ?? [];
  const latest = terms[terms.length - 1] ?? {};
  const history = officeHistory(terms);
  return {
    bioguide: p.id.bioguide,
    fecIds: p.id.fec ?? [],
    fullName: p.name.official_full ?? `${p.name.first} ${p.name.last}`,
    birthday: p.bio?.birthday ?? null,
    recordParty: PARTY_CODE[latest.party] ?? null,
    recordState: latest.state ?? null,
    chamber: latest.type ?? null,
    district: latest.district ?? null,
    seatClass: latest.class ?? null,
    termEnd: latest.end ?? null,
    history,
    yearsInCongress: Math.round(
      history.reduce(
        (a, h) => a + (new Date(h.end) - new Date(h.start)) / (365.25 * 864e5),
        0,
      ),
    ),
    incumbentMember: incumbent,
  };
}

export async function run() {
  const current = parse(await fetchCached(`${BASE}/legislators-current.yaml`, 'legislators-current.yaml'));
  const historical = parse(
    await fetchCached(`${BASE}/legislators-historical.yaml`, 'legislators-historical.yaml'),
  );

  // name -> [record]. Current members win ties; historical are only consulted
  // for people the roster explicitly marks as former members, because names
  // like "Mike Rogers" exist in both files for different states.
  const index = new Map();
  const add = (p, incumbent) => {
    const rec = slim(p, { incumbent });
    for (const key of nameKeys(p)) {
      if (!index.has(key)) index.set(key, []);
      index.get(key).push(rec);
    }
  };
  for (const p of current) add(p, true);

  const formerWanted = new Map(FORMER_MEMBERS.map((f) => [norm(f.name), f]));
  for (const p of historical) {
    const keys = nameKeys(p);
    let want = null;
    for (const k of keys) if (formerWanted.has(k)) want = formerWanted.get(k);
    if (!want) continue;
    const latest = (p.terms ?? [])[(p.terms ?? []).length - 1] ?? {};
    if (latest.state !== want.state || latest.type !== want.type) continue;
    add(p, false);
  }

  /**
   * Pick the record for a name. `state` disambiguates same-name members
   * (Mike Rogers serves for AL today and served for MI until 2015); when a
   * name is ambiguous and no state matches, resolution fails rather than
   * silently taking the first hit.
   */
  function resolve(name, { state, preferFormer = false } = {}) {
    const hits = index.get(norm(name)) ?? [];
    if (!hits.length) return null;
    const scoped = state ? hits.filter((h) => h.recordState === state) : hits;
    const pool = scoped.length ? scoped : hits;
    if (pool.length === 1) return pool[0];
    const byIncumbency = pool.filter((h) => h.incumbentMember !== preferFormer);
    if (byIncumbency.length === 1) return byIncumbency[0];
    return null; // genuinely ambiguous
  }

  // ── Which seats are up is DERIVED, not declared ─────────────────────────
  // A hand-maintained list of races goes stale the moment a senator resigns or
  // is appointed, and it goes stale silently. Terms ending 2027-01-03 are the
  // regular Class II cycle; terms ending on election day itself are appointees
  // filling a vacancy who must face voters now.
  const seatsUp = [];
  for (const p of current) {
    const t = (p.terms ?? []).at(-1);
    if (!t || t.type !== 'sen') continue;
    if (t.end !== '2027-01-03' && t.end !== ELECTION_DAY) continue;
    seatsUp.push({
      state: t.state,
      seatClass: t.class,
      special: t.end === ELECTION_DAY,
      appointed: t.how === 'appointment',
      how: t.how ?? 'election',
      record: slim(p, { incumbent: true }),
      recordParty: PARTY_CODE[t.party] ?? null,
    });
  }
  log('candidates', `${seatsUp.length} seats up in 2026, derived from the congressional record`);

  // Seats NOT on the ballot are the floor both parties start from. Counting
  // them from the record (rather than a remembered "Republicans hold 53")
  // keeps the chamber math honest when a seat changes hands mid-cycle.
  const upStates = new Set(seatsUp.map((s) => `${s.state}-${s.seatClass}`));
  const holdover = { D: 0, R: 0, I: 0 };
  for (const p of current) {
    const t = (p.terms ?? []).at(-1);
    if (!t || t.type !== 'sen') continue;
    if (upStates.has(`${t.state}-${t.class}`)) continue;
    const code = PARTY_CODE[t.party] ?? 'I';
    holdover[code] = (holdover[code] ?? 0) + 1;
  }
  log('candidates', `holdover seats — D ${holdover.D}, R ${holdover.R}, I ${holdover.I}`);

  const rosterByState = new Map();
  for (const r of RACES) rosterByState.set(`${r.state}${r.special ? ':special' : ''}`, r);

  const unresolved = [];
  const drift = [];
  const races = [];

  for (const seat of seatsUp) {
    const race =
      rosterByState.get(`${seat.state}:special`) ??
      rosterByState.get(seat.state) ??
      { state: seat.state, candidates: [] };
    const stateFips = ABBR_TO_FIPS[seat.state];
    const formerByName = new Map(FORMER_MEMBERS.map((f) => [norm(f.name), f]));

    // The roster names a sitting senator the record no longer shows in that
    // seat: an appointment or resignation landed after the verification date.
    const rosterIncumbent =
      race.incumbent ?? race.candidates?.find((c) => c.status === 'incumbent')?.name ?? null;
    if (rosterIncumbent && norm(rosterIncumbent) !== norm(seat.record.fullName)) {
      const looseMatch = norm(seat.record.fullName).includes(norm(rosterIncumbent).split(' ').at(-1));
      if (!race.open && !looseMatch) {
        drift.push(
          `${seat.state}: roster says "${rosterIncumbent}", record says "${seat.record.fullName}"` +
            (seat.appointed ? ' (appointed)' : ''),
        );
      }
    }

    // Drop the roster's own incumbent entry — the record supplies that person,
    // and keeping both would double-list them (or list the wrong one).
    const challengers = (race.candidates ?? []).filter((c) => c.status !== 'incumbent');

    const candidates = challengers.map((c, i) => {
      const former = formerByName.get(norm(c.name));
      const rec = resolve(c.name, {
        // A former member's record lives under the state they served, which is
        // not always the state they are running in (Scott Brown: MA -> NH).
        state: former ? former.state : race.state,
        preferFormer: Boolean(former),
      });
      if (!rec && !c.office && !c.occupation) {
        unresolved.push(`${race.state}: ${c.name} (no record, no hand-authored office)`);
      }
      return {
        id: `${race.state}-${norm(c.name).replace(/ /g, '-')}`,
        name: c.name,
        party: c.party,
        status: c.status,
        seatOrder: i,
        // Hand-authored, only for people with no congressional record.
        office: c.office ?? null,
        occupation: c.occupation ?? null,
        note: c.note ?? null,
        appointed: c.appointed ?? false,
        birthYear: c.birthYear ?? null,
        birthYearConfidence: c.birthYear ? (c.birthYearConfidence ?? 'reported') : null,
        record: rec
          ? {
              bioguide: rec.bioguide,
              fecIds: rec.fecIds,
              fullName: rec.fullName,
              birthday: rec.birthday,
              history: rec.history,
              yearsInCongress: rec.yearsInCongress,
              chamber: rec.chamber,
              district: rec.district,
              recordState: rec.recordState,
              sittingMember: rec.incumbentMember,
            }
          : null,
        // Filled by `npm run sync:fec`; null means unreported, never zero.
        finance: null,
      };
    });

    // The sitting senator, built straight from the record. A retiring senator
    // is still shown as the seat's holder but is not on the ballot, so they
    // are not added to the candidate list.
    const inc = seat.record;
    const incumbentEntry = {
      id: `${seat.state}-${norm(inc.fullName).replace(/ /g, '-')}`,
      name: inc.fullName,
      party: seat.recordParty,
      status: 'incumbent',
      seatOrder: -1,
      office: null,
      occupation: null,
      note: seat.appointed
        ? 'Appointed to fill a vacancy; facing voters for the first time in this seat.'
        : null,
      appointed: seat.appointed,
      birthYear: null,
      birthYearConfidence: null,
      record: {
        bioguide: inc.bioguide,
        fecIds: inc.fecIds,
        fullName: inc.fullName,
        birthday: inc.birthday,
        history: inc.history,
        yearsInCongress: inc.yearsInCongress,
        chamber: inc.chamber,
        district: inc.district,
        recordState: inc.recordState,
        sittingMember: true,
      },
      finance: null,
    };

    races.push({
      id: seat.special ? `${seat.state}-special` : seat.state,
      state: seat.state,
      stateFips,
      stateName: STATES[stateFips].name,
      seatClass: seat.seatClass,
      special: seat.special,
      open: Boolean(race.open),
      openReason: race.openReason ?? null,
      specialReason: race.specialReason ?? null,
      note: race.note ?? null,
      fieldUnverified: race.fieldUnverified ?? null,
      seatHolder: {
        name: inc.fullName,
        bioguide: inc.bioguide,
        party: seat.recordParty,
        appointed: seat.appointed,
        how: seat.how,
        retiring: Boolean(race.open),
        yearsInCongress: inc.yearsInCongress,
        birthday: inc.birthday,
      },
      candidates: race.open ? candidates : [incumbentEntry, ...candidates],
    });
  }

  const resolvedCount = races.flatMap((r) => r.candidates).filter((c) => c.record).length;
  const totalCount = races.flatMap((r) => r.candidates).length;

  await writeJSON(
    'races.json',
    {
      meta: {
        cycle: 2026,
        electionDay: ELECTION_DAY,
        verifiedThrough: VERIFIED_THROUGH,
        generatedAt: new Date().toISOString().slice(0, 10),
        identitySource: 'unitedstates/congress-legislators (CC0)',
        rosterSource: 'hand-authored from public reporting; see scripts/lib/roster.mjs',
        warning:
          `Candidate fields are verified through ${VERIFIED_THROUGH}. Primaries held after ` +
          'that date are not reflected — a multi-candidate field of one party may already ' +
          'have resolved to a nominee.',
        races: races.length,
        candidates: totalCount,
        candidatesResolvedToRecord: resolvedCount,
        holdover,
        chamberSize: 100,
        // Surfaced in the UI: seats where the record moved after the roster
        // was verified, so a reader knows exactly which dossiers to distrust.
        rosterDrift: drift,
      },
      races,
    },
    { pretty: true },
  );

  log('candidates', `${races.length} races, ${resolvedCount}/${totalCount} matched to a congressional record`);
  if (drift.length) log('candidates', `ROSTER DRIFT (record wins):\n  ${drift.join('\n  ')}`);
  if (unresolved.length) {
    log('candidates', `WARN unresolved without fallback:\n  ${unresolved.join('\n  ')}`);
  }
  return { races: races.length, resolved: resolvedCount, total: totalCount, drift: drift.length };
}

if (import.meta.url === `file://${process.argv[1]}`) await run();
