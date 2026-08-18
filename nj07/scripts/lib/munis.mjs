/**
 * Municipality name resolution.
 *
 * New Jersey's certified returns name the same town four different ways
 * depending on which county clerk typed them: `Alexandria Twp`, `Alexandria
 * Township`, `Alexandria`, `Township of Alexandria`. Precinct rows bury the
 * name in front of a ward/district designator that is itself county-specific
 * (`Bedminster D 1`, `Belleville 1-1`, `Andover Twp, District 3`).
 *
 * Every name is therefore resolved against the state's own boundary file
 * rather than against a hand-typed list: a row that does not match a real
 * municipality is reported, never guessed at. The one hazard this must not
 * fall into is the Clinton problem — Hunterdon contains both `Clinton Town`
 * and `Clinton Township`, so a matcher that discards the type suffix silently
 * merges two different electorates. Type is part of the key, and a name that
 * cannot be typed unambiguously is returned as ambiguous.
 */

/** Canonical municipality types, longest spellings first so they match first. */
const TYPES = [
  ['township', ['township', 'twp', 'twsp', 'tp']],
  ['borough', ['borough', 'boro', 'bor', 'boro']],
  ['village', ['village', 'vlg']],
  ['city', ['city']],
  ['town', ['town']],
];

const TYPE_OF = new Map();
for (const [canon, spellings] of TYPES) for (const s of spellings) TYPE_OF.set(s, canon);

/**
 * Clerk spellings that are the same place. Kept deliberately tiny and
 * general — these are orthographic, not a per-town mapping table.
 */
const WORD_ALIASES = new Map([
  ['mt', 'mount'],
  ['st', 'saint'],
]);

/**
 * Lowercase, split on punctuation *including hyphens* and collapse
 * whitespace. `Parsippany-Troy Hills` and `Parsippany - Troy Hills` have to
 * come out identical, so the hyphen is a separator rather than a letter.
 */
export function tokens(raw) {
  return String(raw)
    .toLowerCase()
    .replace(/[^a-z0-9']+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((w) => WORD_ALIASES.get(w) ?? w);
}

/**
 * Split a municipality name into base words plus its type.
 * Handles both `Alpha Borough` and `Borough of Alpha`.
 */
export function splitName(raw) {
  let t = tokens(raw);
  // `Township of Alexandria` → base [alexandria], type township
  if (t.length > 2 && TYPE_OF.has(t[0]) && t[1] === 'of') {
    return { base: t.slice(2), type: TYPE_OF.get(t[0]) };
  }
  const last = t[t.length - 1];
  if (t.length > 1 && TYPE_OF.has(last)) {
    return { base: t.slice(0, -1), type: TYPE_OF.get(last) };
  }
  return { base: t, type: null };
}

/**
 * Vote-mode of a precinct row, read from the designator the clerk appended.
 * NJ reports machine, mail, early, provisional and overseas ballots as
 * separate precinct rows; collapsing them would throw away the single most
 * useful thing about the file.
 */
export function voteMode(precinct) {
  const s = String(precinct).toLowerCase();
  if (/\b(vote by mail|vbm|mail[- ]?in|mail ballots?|absentee)\b/.test(s)) return 'mail';
  if (/\bprovisional/.test(s)) return 'provisional';
  if (/\b(overseas|federal|uocava)\b/.test(s)) return 'overseas';
  if (/\bearly voting|\bearly\b/.test(s)) return 'early';
  if (/\bemergency\b/.test(s)) return 'provisional';
  return 'machine';
}

/** True for rows that are clerk subtotals rather than a place. */
export function isTotalRow(name) {
  const s = String(name).trim().toLowerCase();
  return s === 'total' || s === 'totals' || s === 'county total' || s === '';
}

/**
 * An index of the municipalities that actually exist in a county, built from
 * the state boundary file. `resolve()` returns the municipality a returns row
 * belongs to, or a reason it could not be resolved.
 */
export class MuniIndex {
  constructor() {
    /** county (lowercase) → array of {geoid, name, base, type} */
    this.byCounty = new Map();
    /** county → Map(code → muni), learned from the rows a county actually filed. */
    this.codes = new Map();
  }

  /**
   * Teach the index the abbreviation codes a county's own rows use. Returns
   * the codes it could not pin down so the caller can report them.
   */
  learnCodes(county, observed) {
    const key = String(county).toLowerCase();
    const list = this.byCounty.get(key) ?? [];
    const { codes, unresolved } = deriveCodes(list, observed);
    this.codes.set(key, codes);
    return unresolved;
  }

  add({ county, name, geoid, ...rest }) {
    const key = county.toLowerCase();
    const { base, type } = splitName(name);
    if (!this.byCounty.has(key)) this.byCounty.set(key, []);
    this.byCounty.get(key).push({ geoid, name, base, type, county: key, ...rest });
  }

  all() {
    return [...this.byCounty.values()].flat();
  }

  get(geoid) {
    return this.all().find((m) => m.geoid === geoid) ?? null;
  }

  /**
   * Match a returns row to a municipality.
   *
   * The comparison is on **letters, not words**, because clerks disagree about
   * where the spaces go: Hunterdon writes `Highbridge` for High Bridge, and
   * Somerset writes `Bernards ville` for Bernardsville. Word-wise, that second
   * one is indistinguishable from Bernards Township — which sits next door and
   * would have quietly absorbed 3,754 of its neighbour's votes.
   *
   * Longest matched name wins, so `Bernards ville` reaches Bernardsville while
   * `Bernards District 1` stops at Bernards. Where two towns share the whole
   * name — Morris has a Chatham Borough and a Chatham Township — the word
   * after the match is read as a type and must settle it. An unsettled tie
   * comes back ambiguous and is reported rather than guessed at.
   */
  resolve(county, rawName) {
    const list = this.byCounty.get(String(county).toLowerCase());
    if (!list) return { ok: false, reason: 'unknown-county' };
    let t = tokens(rawName);
    if (!t.length) return { ok: false, reason: 'empty' };

    // Warren's clerk inverts the name — `Township of Mansfield District 6`.
    // Lift the leading type off so the rest matches like every other county.
    let leadType = null;
    if (t.length > 2 && TYPE_OF.has(t[0]) && t[1] === 'of') {
      leadType = TYPE_OF.get(t[0]);
      t = t.slice(2);
    }

    const letters = t.join('');
    // Where each token ends in letter-space, so the word after a match can be
    // found again once the spaces have been taken out.
    const ends = [];
    let acc = 0;
    for (const w of t) {
      acc += w.length;
      ends.push(acc);
    }

    let best = [];
    let bestLen = -1;
    for (const m of list) {
      const base = m.base.join('');
      if (!letters.startsWith(base)) continue;
      if (base.length > bestLen) {
        bestLen = base.length;
        best = [m];
      } else if (base.length === bestLen) best.push(m);
    }

    if (best.length === 1) return { ok: true, muni: best[0] };
    if (best.length > 1) {
      const after = ends.indexOf(bestLen);
      const typed = leadType ?? (after >= 0 ? TYPE_OF.get(t[after + 1]) : undefined);
      const narrowed = best.filter((m) => m.type === typed);
      if (narrowed.length === 1) return { ok: true, muni: narrowed[0] };
      return {
        ok: false,
        reason: 'ambiguous',
        candidates: best.map((m) => m.name),
        candidateMunis: best,
      };
    }

    // No whole name matched. A row may still name a town by only part of it —
    // Essex files South Orange Village Township as `South Orange 7` — so fall
    // back to the longest run of leading *words* the row and a name share.
    let partial = [];
    let partialLen = 0;
    for (const m of list) {
      let k = 0;
      while (k < m.base.length && k < t.length && t[k] === m.base[k]) k++;
      if (k === 0) continue;
      if (k > partialLen) {
        partialLen = k;
        partial = [m];
      } else if (k === partialLen) partial.push(m);
    }
    if (partial.length === 1) return { ok: true, muni: partial[0], viaPartial: true };
    if (partial.length > 1) {
      const typed = leadType ?? TYPE_OF.get(t[partialLen]);
      const narrowed = partial.filter((m) => m.type === typed);
      if (narrowed.length === 1) return { ok: true, muni: narrowed[0], viaPartial: true };
      return {
        ok: false,
        reason: 'ambiguous',
        candidates: partial.map((m) => m.name),
        candidateMunis: partial,
      };
    }

    const learned = this.codes.get(String(county).toLowerCase());
    const muni = learned?.get(t[0]);
    if (muni) return { ok: true, muni, viaCode: t[0] };
    return { ok: false, reason: 'no-match' };
  }
}

/**
 * Union County files its provisional and overseas ballots under two-letter
 * codes — `WE W2 Provisional Ballots`, `NP Provisional Ballots`. The scheme is
 * "first two letters of the first word, unless that collides, then initials",
 * which is not a rule worth trusting blind.
 *
 * So it is solved rather than assumed: each municipality proposes the codes it
 * plausibly owns, and constraint propagation assigns codes that only one town
 * can hold until nothing is left to deduce. A code that stays contested is
 * returned unassigned and its rows are reported, not guessed at. If a clerk
 * ever changes the scheme the build says so instead of quietly moving votes
 * between towns.
 */
export function deriveCodes(munis, observed) {
  const wanted = new Set([...observed].map((c) => c.toLowerCase()));
  const options = new Map();
  for (const m of munis) {
    const codes = new Set();
    const first = m.base[0] ?? '';
    if (first.length >= 2) codes.add(first.slice(0, 2));
    if (m.base.length > 1) codes.add(m.base.map((w) => w[0]).join(''));
    const live = [...codes].filter((c) => wanted.has(c));
    if (live.length) options.set(m, new Set(live));
  }

  const assigned = new Map();
  for (let pass = 0; pass < munis.length + 1; pass++) {
    let progress = false;

    // A town with one code left must hold it.
    for (const [m, codes] of options) {
      if (codes.size !== 1) continue;
      const code = [...codes][0];
      assigned.set(code, m);
      options.delete(m);
      for (const other of options.values()) other.delete(code);
      progress = true;
    }

    // A code only one town can hold must belong to it.
    const holders = new Map();
    for (const [m, codes] of options)
      for (const c of codes) (holders.get(c) ?? holders.set(c, []).get(c)).push(m);
    for (const [code, ms] of holders) {
      if (ms.length !== 1 || assigned.has(code)) continue;
      assigned.set(code, ms[0]);
      options.delete(ms[0]);
      for (const other of options.values()) other.delete(code);
      progress = true;
    }

    if (!progress) break;
  }

  const unresolved = [...wanted].filter((c) => !assigned.has(c));
  return { codes: assigned, unresolved };
}

/** Build an index from the NJGIN municipal boundary features. */
export function indexFromBoundaries(features, counties) {
  const keep = counties ? new Set(counties.map((c) => c.toLowerCase())) : null;
  const idx = new MuniIndex();
  for (const f of features) {
    const p = f.properties;
    const county = String(p.county ?? '').toLowerCase();
    if (keep && !keep.has(county)) continue;
    idx.add({
      county,
      name: p.mun_label,
      geoid: p.census2010,
      type_: p.mun_type,
      sqMiles: p.sq_miles,
      pop2010: p.pop2010,
    });
  }
  return idx;
}

/** Levenshtein distance, capped — never asked about more than a few edits. */
export function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 99;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

/**
 * Rescue rows a clerk misspelled — `Finden` for Linden, `Patterson` for
 * Paterson.
 *
 * A correction is only allowed under conditions that make it checkable rather
 * than plausible: the town it would name must be **entirely absent** from that
 * section of the file (a real Linden row existing there means `Finden` is
 * something else), the misspelling must be within a couple of characters, and
 * exactly one missing town may qualify. Anything short of that stays
 * unresolved and gets reported. Every correction that does fire is returned so
 * it can be shown in the provenance panel instead of disappearing into the
 * totals.
 *
 * The tolerance scales with the length of the name rather than sitting at one
 * edit: scanned returns merge `rn` into `m`, which costs two edits, and
 * `Bemardsville` is not a plausible second town in a county that has a
 * Bernardsville and is missing it. Two edits out of thirteen characters is a
 * different claim from two edits out of four, so short names stay at one.
 */
export function rescueMisspelling(index, county, rawName, resolvedGeoids) {
  const list = index.byCounty.get(String(county).toLowerCase());
  if (!list) return null;
  const t = tokens(rawName);
  if (!t.length || t[0].length < 4) return null;

  const near = (a, b) => {
    if (!b) return false;
    const budget = Math.max(a.length, b.length) >= 10 ? 2 : 1;
    return editDistance(a, b) <= budget;
  };

  const hits = list.filter(
    (m) =>
      !resolvedGeoids.has(m.geoid) &&
      m.base[0] &&
      (near(t[0], m.base[0]) || near(t[0], m.base.join(''))),
  );
  if (hits.length === 1) return hits[0];
  if (!hits.length) return null;

  // `Febanon` is one edit from both Lebanon Borough and Lebanon Township, and
  // in 2018 both are missing from the Senate section. The type word settles it
  // here for the same reason it does in resolve().
  const typed =
    t.length > 2 && TYPE_OF.has(t[0]) && t[1] === 'of' ? TYPE_OF.get(t[0]) : TYPE_OF.get(t[1]);
  const narrowed = hits.filter((m) => m.type === typed);
  return narrowed.length === 1 ? narrowed[0] : null;
}
